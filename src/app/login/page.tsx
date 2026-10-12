import { GraduationCap } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default function LoginPage() {
  const demo = process.env.DEMO_MODE === "true";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </span>
          <span className="text-xl font-bold uppercase tracking-wide">ITV Academy</span>
        </div>
        <LoginForm demo={demo} />
      </div>
    </main>
  );
}
