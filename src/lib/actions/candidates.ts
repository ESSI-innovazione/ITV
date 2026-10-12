"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ImportRow = {
  email: string;
  fullName: string;
  adaOverall: number | null;
  dimensions: Record<string, number> | null;
  password: string;
  status: "created" | "error";
  error?: string;
};

function tempPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

/**
 * Parses `name,email,ada_overall[,dim_x,dim_y...]` CSV. A header row is optional;
 * columns starting with `dim_` become ADA dimensions.
 */
export async function parseCandidatesCsv(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { header: [] as string[], rows: [] as string[][] };
  const split = (l: string) => l.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
  const first = split(lines[0]);
  const hasHeader = first.some((c) => /email/i.test(c));
  const header = hasHeader ? first.map((c) => c.toLowerCase()) : ["name", "email", "ada_overall"];
  const rows = (hasHeader ? lines.slice(1) : lines).map(split);
  return { header, rows };
}

/** Creates (or updates) candidates with ADA scores. Staff only (enforced in the RPC). */
export async function importCandidates(formData: FormData): Promise<{ rows: ImportRow[]; error?: string }> {
  const csv = String(formData.get("csv") ?? "");
  const { header, rows } = await parseCandidatesCsv(csv);
  if (!rows.length) return { rows: [], error: "Nessuna riga trovata." };

  const idx = (name: RegExp) => header.findIndex((h) => name.test(h));
  const iName = idx(/^(name|nome|full_name)$/);
  const iEmail = idx(/email/);
  const iAda = idx(/^(ada|ada_overall|score|punteggio)$/);
  const dimCols = header.map((h, i) => ({ h, i })).filter(({ h }) => h.startsWith("dim_"));
  if (iEmail < 0) return { rows: [], error: "Colonna email mancante." };

  const supabase = await createClient();
  const out: ImportRow[] = [];

  for (const r of rows) {
    const email = r[iEmail] ?? "";
    const fullName = iName >= 0 ? r[iName] ?? "" : email.split("@")[0];
    const adaRaw = iAda >= 0 ? Number(r[iAda]) : NaN;
    const adaOverall = Number.isFinite(adaRaw) ? Math.max(0, Math.min(100, Math.round(adaRaw))) : null;
    const dims = dimCols.reduce<Record<string, number>>((acc, { h, i }) => {
      const v = Number(r[i]);
      if (Number.isFinite(v)) acc[h.replace(/^dim_/, "")] = v;
      return acc;
    }, {});
    const dimensions = Object.keys(dims).length ? dims : null;
    const password = tempPassword();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      out.push({ email, fullName, adaOverall, dimensions, password: "", status: "error", error: "Email non valida" });
      continue;
    }

    const { error } = await supabase.rpc("admin_create_candidate", {
      p_email: email,
      p_full_name: fullName,
      p_password: password,
      p_ada_overall: adaOverall,
      p_ada_dimensions: dimensions,
      p_role: "candidate",
    });
    out.push({
      email, fullName, adaOverall, dimensions, password: error ? "" : password,
      status: error ? "error" : "created",
      error: error ? (error.message.includes("forbidden") ? "Non autorizzato" : error.message) : undefined,
    });
  }

  revalidatePath("/studio/candidates");
  return { rows: out };
}

/** Sets or updates a single candidate's ADA score. */
export async function setAdaScore(candidateId: string, overall: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ada_profiles")
    .upsert({ candidate_id: candidateId, overall, source: "manual", assessed_at: new Date().toISOString() }, { onConflict: "candidate_id" });
  revalidatePath("/studio/candidates");
  return { ok: !error, error: error?.message };
}
