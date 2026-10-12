import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "author" | "reviewer" | "candidate";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
};

export const STAFF_ROLES: Role[] = ["admin", "author", "reviewer"];

/** Home route for a role, used after login and for wrong-area redirects. */
export function homeFor(role: Role) {
  return role === "candidate" ? "/learn" : "/studio";
}

/**
 * Data Access Layer entry point. Reads the session cookie, so callers must
 * render inside <Suspense>. Deduplicated per request with React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.full_name || profile.email,
    email: profile.email,
    role: profile.role as Role,
    avatarUrl: profile.avatar_url,
  };
});

/** Like getCurrentUser, but redirects to /login (or the user's own area) instead of returning null. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
