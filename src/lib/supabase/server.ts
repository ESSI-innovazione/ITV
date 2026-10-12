import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createBareClient } from "@supabase/supabase-js";

/**
 * Request-scoped Supabase client (anon key + the user's session cookie).
 * Reads cookies(), so any component that calls it must sit inside <Suspense>.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: cookies are refreshed by proxy.ts instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS — use only in server code that must read
 * protected rows (quiz answers, scoring, certificate issuance, admin imports).
 */
export function createAdminClient() {
  return createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
