import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser, STAFF_ROLES } from "@/lib/auth";

/** For route handlers: returns a 401/403 response to send, or null when the caller is staff. */
export async function requireStaffApi() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!STAFF_ROLES.includes(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}
