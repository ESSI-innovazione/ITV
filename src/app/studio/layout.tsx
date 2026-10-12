import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { requireUser, STAFF_ROLES } from "@/lib/auth";

export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return (
    <AppShell nav="studio" area="Studio" profileHref="/studio/settings">
      <Suspense>
        <Gate />
      </Suspense>
      {children}
    </AppShell>
  );
}

/** Redirects candidates out of the Studio. Renders nothing. */
async function Gate() {
  await requireUser(STAFF_ROLES);
  return null;
}
