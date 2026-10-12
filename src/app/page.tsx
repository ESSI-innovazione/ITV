import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";

/** Root: send the visitor to their area, or to login. */
export default function RootPage() {
  return (
    <Suspense>
      <Redirector />
    </Suspense>
  );
}

async function Redirector() {
  const user = await getCurrentUser();
  redirect(user ? homeFor(user.role) : "/login");
  return null;
}
