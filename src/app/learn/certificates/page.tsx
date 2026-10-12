import { Suspense } from "react";
import Link from "next/link";
import { Award, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Widget } from "@/components/app/widget";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Certificati" };

export default function CertificatesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48" />}>
      <CertificateList />
    </Suspense>
  );
}

async function CertificateList() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: certs } = await supabase
    .from("certificates")
    .select("id, score, issued_at, revoked_at, course:courses(title)")
    .eq("candidate_id", user.id)
    .order("issued_at", { ascending: false });

  if (!certs?.length) {
    return (
      <Widget className="p-10 text-center">
        <Award className="mx-auto size-10 text-yellow" />
        <p className="mt-3 text-muted-foreground">Nessun certificato ancora. Completa un corso e supera il quiz finale.</p>
      </Widget>
    );
  }

  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {certs.map((c) => {
        const course = c.course as unknown as { title: string } | null;
        return (
          <li key={c.id}>
            <Widget className="p-6">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-yellow/25 text-orange">
                  <Award className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold leading-snug">{course?.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Rilasciato il {new Date(c.issued_at).toLocaleDateString("it-IT")}
                    {c.score !== null && ` · ${Math.round(Number(c.score))}%`}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{c.id}</p>
                  {c.revoked_at && <p className="mt-1 text-xs font-medium text-destructive">Revocato</p>}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" render={<a href={`/api/certificates/${c.id}/pdf`} target="_blank" rel="noopener" />} disabled={!!c.revoked_at}>
                  <Download className="size-4" /> Scarica PDF
                </Button>
                <Button size="sm" variant="outline" render={<Link href={`/verify/${c.id}`} />}>
                  <ShieldCheck className="size-4" /> Pagina di verifica
                </Button>
              </div>
            </Widget>
          </li>
        );
      })}
    </ul>
  );
}
