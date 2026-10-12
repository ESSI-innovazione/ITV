import { Suspense } from "react";
import Link from "next/link";
import { Award, BookOpen, Clock, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Widget } from "@/components/app/widget";
import { requireUser } from "@/lib/auth";
import { getAssignedCourses } from "@/lib/learner";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

const bandLabel: Record<string, { label: string; className: string }> = {
  foundation: { label: "Livello base", className: "bg-yellow/20 text-orange" },
  intermediate: { label: "Livello intermedio", className: "bg-cyan/20 text-blue" },
  advanced: { label: "Livello avanzato", className: "bg-green/20 text-green" },
};

export default function LearnDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const supabase = await createClient();

  const [rows, { data: ada }, { data: certificates }] = await Promise.all([
    getAssignedCourses(user.id),
    supabase.from("ada_profiles").select("overall, band").eq("candidate_id", user.id).maybeSingle(),
    supabase.from("certificates").select("id, issued_at, course:courses(title)").eq("candidate_id", user.id).is("revoked_at", null),
  ]);

  const done = (s: string) => s === "completed" || s === "certified";
  const completed = rows.filter((r) => done(r.progress.status)).length;
  const overall = rows.length ? Math.round(rows.reduce((s, r) => s + r.progress.percent, 0) / rows.length) : 0;
  const next = rows.find((r) => r.progress.status === "in_progress") ?? rows.find((r) => r.progress.status === "not_started");
  const band = ada ? bandLabel[ada.band] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Ciao, {user.name.split(" ")[0]} 👋</h2>
          <p className="text-sm text-muted-foreground">Ecco il tuo percorso formativo.</p>
        </div>
        {band && <Badge className={`rounded-full px-3 py-1 ${band.className}`}>{band.label} · ADA {ada!.overall}</Badge>}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Widget title="Avanzamento">
          <div className="flex items-center gap-5">
            <ProgressRing value={overall} />
            <div className="text-sm">
              <p className="text-2xl font-semibold">{completed}/{rows.length}</p>
              <p className="text-muted-foreground">corsi completati</p>
            </div>
          </div>
        </Widget>

        <Widget title="Continua da dove eri" className="md:col-span-2">
          {next ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BookOpen className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{next.course.title}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Progress value={next.progress.percent} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{next.progress.percent}%</span>
                </div>
              </div>
              <Button render={<Link href={`/learn/courses/${next.course.id}`} />}>
                <Play className="size-4" />
                {next.progress.status === "in_progress" ? "Riprendi" : "Inizia"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun corso assegnato. Torna più tardi!</p>
          )}
        </Widget>
      </div>

      <Widget title="I tuoi corsi" actions={<Button variant="ghost" size="sm" render={<Link href="/learn/courses" />}>Vedi tutti</Button>}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Quando un docente ti assegnerà un corso lo troverai qui.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.slice(0, 6).map((r) => (
              <li key={r.assignmentId} className="rounded-lg bg-muted p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{r.course.title}</p>
                  <StatusBadge status={r.progress.status} />
                </div>
                <Progress value={r.progress.percent} className="h-1.5" />
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {r.course.durationMin ? `${r.course.durationMin} min` : "—"}
                  </span>
                  <Link href={`/learn/courses/${r.course.id}`} className="font-medium text-primary hover:underline">
                    Apri
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Widget>

      <Widget title="Certificati" actions={<Button variant="ghost" size="sm" render={<Link href="/learn/certificates" />}>Vedi tutti</Button>}>
        {!certificates?.length ? (
          <p className="text-sm text-muted-foreground">Completa un corso e supera il quiz per ottenere il tuo primo certificato.</p>
        ) : (
          <ul className="divide-y">
            {certificates.map((c) => {
              const course = c.course as unknown as { title: string } | null;
              return (
                <li key={c.id} className="flex items-center gap-3 py-3 text-sm">
                  <Award className="size-5 text-yellow" />
                  <span className="flex-1 font-medium">{course?.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Widget>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    not_started: { label: "Da iniziare", cls: "bg-card text-muted-foreground" },
    in_progress: { label: "In corso", cls: "bg-primary/15 text-primary" },
    completed: { label: "Completato", cls: "bg-green/20 text-green" },
    certified: { label: "Certificato", cls: "bg-yellow/25 text-orange" },
  };
  const s = map[status] ?? map.not_started;
  return <Badge className={`shrink-0 rounded-full ${s.cls}`}>{s.label}</Badge>;
}

function ProgressRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${value}% completato`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
      <circle
        cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
        transform="rotate(-90 44 44)" className="text-primary"
      />
      <text x="44" y="49" textAnchor="middle" className="fill-foreground text-base font-semibold">{value}%</text>
    </svg>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36 md:col-span-2" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
