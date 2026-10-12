"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Assigns one course to many candidates (idempotent on the unique pair). Staff only via RLS. */
export async function assignCourse(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const candidateIds = formData.getAll("candidateIds").map(String).filter(Boolean);
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;
  if (!courseId || !candidateIds.length) return { ok: false, error: "Scegli un corso e almeno un candidato." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("assignments").upsert(
    candidateIds.map((candidate_id) => ({ course_id: courseId, candidate_id, assigned_by: user?.id ?? null, due_at: dueAt })),
    { onConflict: "course_id,candidate_id" },
  );
  revalidatePath("/studio/assignments");
  revalidatePath("/studio/candidates");
  return { ok: !error, error: error?.message, count: candidateIds.length };
}

export async function removeAssignment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  revalidatePath("/studio/assignments");
  return { ok: !error, error: error?.message };
}
