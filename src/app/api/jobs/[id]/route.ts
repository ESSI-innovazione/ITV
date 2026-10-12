import { NextResponse } from "next/server";
import { getJob } from "@/lib/actions/generation";
import { requireStaffApi } from "@/lib/api-auth";

/** GET /api/jobs/[id] — generation job status (docs/SPEC.md §11). */
export async function GET(_request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const denied = await requireStaffApi();
  if (denied) return denied;

  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
