import { NextResponse } from "next/server";
import { generateGammaDeck } from "@/lib/ai/gamma-deck";
import { gammaConfigured } from "@/lib/gamma";
import { requireStaffApi } from "@/lib/api-auth";

export const maxDuration = 300;

/** POST /api/gamma/generate/[courseId] — synchronous (waits for Gamma, 1–3 min). docs/SPEC.md §11. */
export async function POST(_request: Request, ctx: RouteContext<"/api/gamma/generate/[courseId]">) {
  const denied = await requireStaffApi();
  if (denied) return denied;
  if (!gammaConfigured()) return NextResponse.json({ error: "gamma_not_configured" }, { status: 501 });

  const { courseId } = await ctx.params;
  try {
    const r = await generateGammaDeck(courseId);
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
