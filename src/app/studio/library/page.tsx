import { Suspense } from "react";
import Link from "next/link";
import { ClipboardCheck, FileText, Package, Plus, Presentation, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Widget } from "@/components/app/widget";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Libreria" };

const typeMeta = {
  slides: { label: "Presentazione con interazioni", icon: Presentation, cls: "bg-pink/15 text-pink" },
  scroll: { label: "Pagina", icon: FileText, cls: "bg-primary/15 text-primary" },
  scorm: { label: "Pacchetto SCORM", icon: Package, cls: "bg-green/15 text-green" },
  quiz: { label: "Quiz", icon: ClipboardCheck, cls: "bg-orange/15 text-orange" },
} as const;

const statusMeta: Record<string, { label: string; cls: string }> = {
  draft: { label: "Bozza", cls: "bg-muted text-muted-foreground" },
  in_review: { label: "In revisione", cls: "bg-yellow/25 text-orange" },
  approved: { label: "Approvato", cls: "bg-cyan/20 text-blue" },
  published: { label: "Pubblicato", cls: "bg-green/20 text-green" },
  archived: { label: "Archiviato", cls: "bg-muted text-muted-foreground" },
};

/** iSpring Cloud-style content table: Titolo · Tipo · Creato da · Modificato. */
export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Libreria</h2>
          <p className="text-sm text-muted-foreground">Tutti i contenuti: corsi, quiz e pacchetti SCORM.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Carica" render={<Link href="/studio/scorm" />}>
            <Upload className="size-4" />
          </Button>
          <Button variant="outline" className="border-primary/40 text-primary" render={<Link href="/studio/courses/new?type=slides&ai=1" />}>
            <Sparkles className="size-4" /> Crea corso con IA
          </Button>
          <Button render={<Link href="/studio" />}>
            <Plus className="size-4" /> Crea
          </Button>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-72" />}>
        <LibraryTable />
      </Suspense>
    </div>
  );
}

async function LibraryTable() {
  await requireUser(STAFF_ROLES);
  const supabase = await createClient();
  const [{ data: courses }, { data: quizzes }] = await Promise.all([
    supabase.from("courses").select("id, title, type, status, updated_at, author:profiles!courses_created_by_fkey(full_name)").order("updated_at", { ascending: false }),
    supabase.from("quizzes").select("id, title, created_at, course_id, author:profiles!quizzes_created_by_fkey(full_name)").order("created_at", { ascending: false }),
  ]);

  type Row = { id: string; title: string; kind: keyof typeof typeMeta; status: string | null; author: string; updated: string; href: string };
  const rows: Row[] = [
    ...(courses ?? []).map((c) => ({
      id: c.id, title: c.title, kind: c.type as Row["kind"], status: c.status,
      author: (c.author as unknown as { full_name: string } | null)?.full_name ?? "—",
      updated: c.updated_at, href: `/learn/courses/${c.id}`,
    })),
    ...(quizzes ?? []).map((q) => ({
      id: q.id, title: q.title, kind: "quiz" as const, status: null,
      author: (q.author as unknown as { full_name: string } | null)?.full_name ?? "—",
      updated: q.created_at, href: `/learn/quizzes/${q.id}`,
    })),
  ].sort((a, b) => a.title.localeCompare(b.title, "it"));

  if (!rows.length) {
    return <Widget className="p-10 text-center text-muted-foreground">La libreria è vuota. Crea il primo corso.</Widget>;
  }

  return (
    <Widget flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Titolo ↑</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Creato da</TableHead>
            <TableHead className="pr-6">Modificato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const t = typeMeta[r.kind];
            const s = r.status ? statusMeta[r.status] : null;
            return (
              <TableRow key={`${r.kind}-${r.id}`}>
                <TableCell className="pl-6">
                  <Link href={r.href} className="flex items-center gap-3 font-medium hover:text-primary">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.cls}`}>
                      <t.icon className="size-4" />
                    </span>
                    {r.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.label}</TableCell>
                <TableCell>{s ? <Badge className={`rounded-full ${s.cls}`}>{s.label}</Badge> : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.author}</TableCell>
                <TableCell className="pr-6 text-muted-foreground">
                  {new Date(r.updated).toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Widget>
  );
}
