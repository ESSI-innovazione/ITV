import { Suspense } from "react";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { GraduationCap, ShieldCheck, ShieldX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Verifica certificato" };

type Verified = {
  id: string;
  valid: boolean;
  issued_at: string;
  score: number | null;
  candidate_name: string;
  course_title: string;
  duration_min: number | null;
};

/** Public page: anyone with the certificate ID (or its QR) can confirm it. No session needed. */
export default function VerifyPage({ params }: PageProps<"/verify/[id]">) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </span>
          <span className="text-xl font-bold uppercase tracking-wide">ITV Academy</span>
        </div>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Verify params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Verify({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Anonymous client: the RPC is security-definer and returns only non-sensitive fields.
  const supabase = createBareClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await supabase.rpc("verify_certificate", { p_id: id.toUpperCase() });
  const cert = data as Verified | null;

  if (!cert) {
    return (
      <div className="widget p-8 text-center">
        <ShieldX className="mx-auto size-12 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Certificato non trovato</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nessun certificato con codice <span className="font-mono">{id}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="widget p-8">
      <div className="flex items-center gap-3">
        {cert.valid ? <ShieldCheck className="size-10 text-green" /> : <ShieldX className="size-10 text-destructive" />}
        <div>
          <h1 className="text-xl font-semibold">{cert.valid ? "Certificato valido" : "Certificato revocato"}</h1>
          <p className="font-mono text-xs text-muted-foreground">{cert.id}</p>
        </div>
      </div>
      <dl className="mt-6 space-y-3 text-sm">
        <Row label="Intestatario" value={cert.candidate_name} />
        <Row label="Corso" value={cert.course_title} />
        {cert.duration_min && <Row label="Durata" value={`${cert.duration_min} minuti`} />}
        {cert.score !== null && <Row label="Punteggio" value={`${Math.round(Number(cert.score))}%`} />}
        <Row label="Rilasciato il" value={new Date(cert.issued_at).toLocaleDateString("it-IT")} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
