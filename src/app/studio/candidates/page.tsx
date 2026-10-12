import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Widget } from "@/components/app/widget";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportDialog } from "./import-dialog";

export const metadata = { title: "Candidati" };

const band: Record<string, { label: string; cls: string }> = {
  foundation: { label: "Base", cls: "bg-yellow/20 text-orange" },
  intermediate: { label: "Intermedio", cls: "bg-cyan/20 text-blue" },
  advanced: { label: "Avanzato", cls: "bg-green/20 text-green" },
};

export default function CandidatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Candidati</h2>
          <p className="text-sm text-muted-foreground">Punteggio ADA, corsi assegnati e avanzamento.</p>
        </div>
        <ImportDialog />
      </div>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <CandidatesTable />
      </Suspense>
    </div>
  );
}

async function CandidatesTable() {
  await requireUser(STAFF_ROLES);
  const supabase = await createClient();
  const [{ data: profiles }, { data: ada }, { data: assignments }, { data: progress }, { data: certs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at").eq("role", "candidate").order("full_name"),
    supabase.from("ada_profiles").select("candidate_id, overall, band, dimensions"),
    supabase.from("assignments").select("candidate_id"),
    supabase.from("progress").select("candidate_id, percent, status"),
    supabase.from("certificates").select("candidate_id").is("revoked_at", null),
  ]);

  const count = (rows: { candidate_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.candidate_id === id).length;
  const adaBy = new Map((ada ?? []).map((a) => [a.candidate_id, a]));

  if (!profiles?.length) {
    return <Widget className="p-10 text-center text-muted-foreground">Nessun candidato. Importa un CSV per iniziare.</Widget>;
  }

  return (
    <Widget flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Candidato</TableHead>
            <TableHead>ADA</TableHead>
            <TableHead>Livello</TableHead>
            <TableHead>Dimensioni</TableHead>
            <TableHead>Corsi</TableHead>
            <TableHead>Avanzamento medio</TableHead>
            <TableHead className="pr-6">Certificati</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => {
            const a = adaBy.get(p.id);
            const prog = (progress ?? []).filter((r) => r.candidate_id === p.id);
            const avg = prog.length ? Math.round(prog.reduce((s, r) => s + r.percent, 0) / prog.length) : 0;
            const b = a ? band[a.band] : null;
            const dims = (a?.dimensions ?? {}) as Record<string, number>;
            return (
              <TableRow key={p.id}>
                <TableCell className="pl-6">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </TableCell>
                <TableCell className="font-semibold">{a?.overall ?? "—"}</TableCell>
                <TableCell>{b ? <Badge className={`rounded-full ${b.cls}`}>{b.label}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {Object.entries(dims).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}
                </TableCell>
                <TableCell>{count(assignments, p.id)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={avg} className="h-1.5 w-24" />
                    <span className="text-xs text-muted-foreground">{avg}%</span>
                  </div>
                </TableCell>
                <TableCell className="pr-6">{count(certs, p.id)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Widget>
  );
}
