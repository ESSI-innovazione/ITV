import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Widget } from "@/components/app/widget";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AssignForm } from "./assign-form";

export const metadata = { title: "Assegnazioni" };

export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Assegnazioni</h2>
        <p className="text-sm text-muted-foreground">Assegna i corsi pubblicati ai candidati e segui l&apos;avanzamento.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Content />
      </Suspense>
    </div>
  );
}

const statusMeta: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Da iniziare", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "In corso", cls: "bg-primary/15 text-primary" },
  completed: { label: "Completato", cls: "bg-green/20 text-green" },
  certified: { label: "Certificato", cls: "bg-yellow/25 text-orange" },
};

async function Content() {
  await requireUser(STAFF_ROLES);
  const supabase = await createClient();
  const [{ data: courses }, { data: candidates }, { data: ada }, { data: assignments }, { data: progress }] = await Promise.all([
    supabase.from("courses").select("id, title, status").eq("status", "published").order("title"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "candidate").order("full_name"),
    supabase.from("ada_profiles").select("candidate_id, overall"),
    supabase
      .from("assignments")
      .select("id, due_at, created_at, course:courses(id, title), candidate:profiles!assignments_candidate_id_fkey(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("progress").select("course_id, candidate_id, status, percent"),
  ]);

  const adaBy = new Map((ada ?? []).map((a) => [a.candidate_id, a.overall]));
  const progBy = new Map((progress ?? []).map((p) => [`${p.course_id}:${p.candidate_id}`, p]));

  return (
    <div className="space-y-6">
      <AssignForm
        courses={(courses ?? []).map((c) => ({ id: c.id, label: c.title }))}
        candidates={(candidates ?? []).map((c) => ({
          id: c.id, label: c.full_name, hint: adaBy.has(c.id) ? `ADA ${adaBy.get(c.id)}` : undefined,
        }))}
      />

      <Widget title="Assegnazioni attive" flush>
        {!assignments?.length ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nessuna assegnazione.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Corso</TableHead>
                <TableHead>Candidato</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="pr-6">Avanzamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a) => {
                const course = a.course as unknown as { id: string; title: string } | null;
                const cand = a.candidate as unknown as { id: string; full_name: string } | null;
                const p = course && cand ? progBy.get(`${course.id}:${cand.id}`) : undefined;
                const s = statusMeta[p?.status ?? "not_started"];
                const overdue = a.due_at && new Date(a.due_at) < new Date() && !["completed", "certified"].includes(p?.status ?? "");
                return (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-medium">{course?.title}</TableCell>
                    <TableCell>{cand?.full_name}</TableCell>
                    <TableCell className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {a.due_at ? new Date(a.due_at).toLocaleDateString("it-IT") : "—"}
                    </TableCell>
                    <TableCell><Badge className={`rounded-full ${s.cls}`}>{s.label}</Badge></TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center gap-2">
                        <Progress value={p?.percent ?? 0} className="h-1.5 w-24" />
                        <span className="text-xs text-muted-foreground">{p?.percent ?? 0}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Widget>
    </div>
  );
}
