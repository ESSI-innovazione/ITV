import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { CertificatePdf } from "@/components/certificate/certificate-pdf";
import { createClient } from "@/lib/supabase/server";

/** PDF for a certificate. RLS: the candidate sees their own, staff see all. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/certificates/[id]/pdf">) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: cert } = await supabase
    .from("certificates")
    .select("id, score, issued_at, revoked_at, candidate:profiles(full_name), course:courses(title, duration_min)")
    .eq("id", id)
    .maybeSingle();
  if (!cert) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (cert.revoked_at) return NextResponse.json({ error: "revoked" }, { status: 410 });

  const candidate = cert.candidate as unknown as { full_name: string } | null;
  const course = cert.course as unknown as { title: string; duration_min: number | null } | null;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyUrl = `${base}/verify/${cert.id}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256, color: { dark: "#16365f" } });

  const buffer = await renderToBuffer(
    <CertificatePdf
      data={{
        id: cert.id,
        candidateName: candidate?.full_name ?? "",
        courseTitle: course?.title ?? "",
        durationMin: course?.duration_min ?? null,
        score: cert.score === null ? null : Number(cert.score),
        issuedAt: cert.issued_at,
        verifyUrl,
        qrDataUrl,
      }}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificato-${cert.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
