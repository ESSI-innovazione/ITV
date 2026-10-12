"use client";

import { useActionState, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn, signInDemo, type LoginState } from "./actions";

export function LoginForm({ demo }: { demo: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, undefined);
  const [demoPending, startDemo] = useTransition();
  const [demoError, setDemoError] = useState<string | undefined>();
  const error = state?.error ?? demoError;

  function loginAs(role: "author" | "candidate") {
    setDemoError(undefined);
    startDemo(async () => {
      const result = await signInDemo(role);
      if (result?.error) setDemoError(result.error);
    });
  }

  return (
    <Card className="widget border-0">
      <CardHeader>
        <CardTitle>Accedi</CardTitle>
        <CardDescription>Entra nella tua area formativa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Accesso…" : "Accedi"}
          </Button>
        </form>

        {demo && (
          <>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">Demo</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" disabled={demoPending} onClick={() => loginAs("author")}>
                <Sparkles className="size-4" />
                Entra come docente
              </Button>
              <Button variant="secondary" disabled={demoPending} onClick={() => loginAs("candidate")}>
                Entra come candidato
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
