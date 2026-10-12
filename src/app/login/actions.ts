"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor, type Role } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

async function signInAndRedirect(email: string, password: string): Promise<LoginState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Email o password non corretti." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(homeFor((profile?.role as Role) ?? "candidate"));
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Inserisci email e password." };
  return signInAndRedirect(email, password);
}

/** DEMO_MODE only: one-click login as a seeded demo account. */
export async function signInDemo(role: "author" | "candidate"): Promise<LoginState> {
  if (process.env.DEMO_MODE !== "true") return { error: "Modalità demo disattivata." };
  const email = role === "author" ? "docente@demo.itv" : "candidato@demo.itv";
  return signInAndRedirect(email, "demo1234");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
