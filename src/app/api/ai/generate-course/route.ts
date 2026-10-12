import { NextResponse, type NextRequest } from "next/server";
import { startGeneration } from "@/lib/actions/generation";
import { requireStaffApi } from "@/lib/api-auth";

export const maxDuration = 300;

/**
 * POST /api/ai/generate-course — starts a generation job (docs/SPEC.md §11).
 * Same entry point as the "Crea con IA" form; useful for scripts and integrations.
 * Body: GenerateCourseInput. Response: { jobId }.
 */
export async function POST(request: NextRequest) {
  const denied = await requireStaffApi();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const r = await startGeneration(body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ jobId: r.jobId }, { status: 202 });
}
