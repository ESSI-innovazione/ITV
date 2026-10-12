import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth";

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <AppShell nav="learn" area="Area candidato" profileHref="/learn/portfolio">
      <Suspense>
        <Gate />
      </Suspense>
      {children}
    </AppShell>
  );
}

/** Any signed-in role may browse the learner area (staff use it to preview). */
async function Gate() {
  await requireUser();
  return null;
}
