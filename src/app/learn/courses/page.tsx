import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, Clock, Play, ScrollText, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Widget } from "@/components/app/widget";
import { requireUser } from "@/lib/auth";
import { getAssignedCourses } from "@/lib/learner";

export const metadata = { title: "I miei corsi" };

const typeIcon = { slides: BookOpen, scroll: ScrollText, scorm: Package } as const;

export default function MyCoursesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <CourseGrid />
    </Suspense>
  );
}

async function CourseGrid() {
  const user = await requireUser();
  const rows = await getAssignedCourses(user.id);

  if (rows.length === 0) {
    return (
      <Widget className="p-10 text-center">
        <p className="text-muted-foreground">Nessun corso assegnato per ora.</p>
      </Widget>
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => {
        const Icon = typeIcon[r.course.type as keyof typeof typeIcon] ?? BookOpen;
        const overdue = r.dueAt && new Date(r.dueAt) < new Date() && r.progress.status !== "completed" && r.progress.status !== "certified";
        return (
          <li key={r.assignmentId}>
            <Widget className="flex h-full flex-col p-0">
              <div className="flex h-28 items-center justify-center rounded-t-lg bg-gradient-to-br from-navy via-violet-dark to-violet text-white">
                <Icon className="size-10 opacity-80" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{r.course.title}</h3>
                  <StatusBadge status={r.progress.status} />
                </div>
                <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {r.course.durationMin ? `${r.course.durationMin} min` : "—"}
                  </span>
                  {r.dueAt && (
                    <span className={overdue ? "font-medium text-destructive" : ""}>
                      Scadenza {new Date(r.dueAt).toLocaleDateString("it-IT")}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-3">
                  <Progress value={r.progress.percent} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{r.progress.percent}%</span>
                  <Button size="sm" render={<Link href={`/learn/courses/${r.course.id}`} />}>
                    <Play className="size-3.5" />
                    {r.progress.status === "not_started" ? "Inizia" : "Apri"}
                  </Button>
                </div>
              </div>
            </Widget>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    not_started: { label: "Da iniziare", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "In corso", cls: "bg-primary/15 text-primary" },
    completed: { label: "Completato", cls: "bg-green/20 text-green" },
    certified: { label: "Certificato", cls: "bg-yellow/25 text-orange" },
  };
  const s = map[status] ?? map.not_started;
  return <Badge className={`shrink-0 rounded-full ${s.cls}`}>{s.label}</Badge>;
}
