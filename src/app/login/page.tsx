import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { signOut } from "./actions";

export const metadata = { title: "Accedi" };

export default function LoginPage() {
  const demo = process.env.DEMO_MODE === "true";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </span>
          <span className="text-xl font-bold uppercase tracking-wide">ITV Academy</span>
        </div>
        <Suspense>
          <SessionNotice />
        </Suspense>
        <LoginForm demo={demo} />
      </div>
    </main>
  );
}

const roleLabel: Record<string, string> = { admin: "Amministratore", author: "Autore", reviewer: "Revisore", candidate: "Candidato" };

/** Shown when a session already exists, so switching users is one click. */
async function SessionNotice() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="widget flex flex-wrap items-center gap-3 p-4 text-sm">
      <p className="min-w-0 flex-1">
        Sei già connesso come <span className="font-medium">{user.name}</span>{" "}
        <span className="text-muted-foreground">({roleLabel[user.role] ?? user.role})</span>.
      </p>
      <Button size="sm" render={<Link href={homeFor(user.role)} />}>
        Vai alla tua area <ArrowRight className="size-4" />
      </Button>
      <form action={signOut}>
        <Button size="sm" variant="outline" type="submit">
          <LogOut className="size-4" /> Esci e cambia utente
        </Button>
      </form>
    </div>
  );
}
