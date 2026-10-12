import { Suspense } from "react";
import Link from "next/link";
import { Download, Package, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Widget } from "@/components/app/widget";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UploadForm } from "./upload-form";

export const metadata = { title: "SCORM" };

export default function ScormPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">SCORM</h2>
        <p className="text-sm text-muted-foreground">Esporta i corsi come pacchetti SCORM 1.2 per altri LMS, o importa pacchetti esistenti (iSpring, Articulate…).</p>
      </div>
      <UploadForm />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Tables />
      </Suspense>
    </div>
  );
}

async function Tables() {
  await requireUser(STAFF_ROLES);
  const supabase = await createClient();
  const [{ data: packages }, { data: courses }] = await Promise.all([
    supabase.from("scorm_packages").select("id, version, entry_point, manifest, created_at, course:courses(id, title, status)").order("created_at", { ascending: false }),
    supabase.from("courses").select("id, title, status, ada_band").eq("type", "slides").order("updated_at", { ascending: false }),
  ]);

  return (
    <>
      <Widget title="Pacchetti importati" flush>
        {!packages?.length ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nessun pacchetto importato.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Titolo</TableHead>
                <TableHead>Versione</TableHead>
                <TableHead>Lancio</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="pr-6"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((p) => {
                const course = p.course as unknown as { id: string; title: string; status: string } | null;
                const m = (p.manifest ?? {}) as { files?: number };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6">
                      <span className="flex items-center gap-2 font-medium"><Package className="size-4 text-green" /> {course?.title}</span>
                    </TableCell>
                    <TableCell><Badge className="rounded-full bg-muted text-muted-foreground">SCORM {p.version}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.entry_point}</TableCell>
                    <TableCell className="text-muted-foreground">{m.files ?? "—"}</TableCell>
                    <TableCell className="pr-6 text-right">
                      {course && (
                        <Button size="sm" variant="outline" render={<Link href={`/learn/courses/${course.id}`} />}>
                          <Play className="size-3.5" /> Anteprima
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Widget>

      <Widget title="Esporta corsi come SCORM 1.2" flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Corso</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(courses ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-6 font-medium">{c.title}</TableCell>
                <TableCell className="text-muted-foreground">{c.status}</TableCell>
                <TableCell className="pr-6 text-right">
                  <Button size="sm" render={<a href={`/api/scorm/export/${c.id}`} />}>
                    <Download className="size-3.5" /> Esporta .zip
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Widget>
    </>
  );
}
