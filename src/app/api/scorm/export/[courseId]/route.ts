import { NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/api-auth";
import { buildScormZip, loadScoCourse } from "@/lib/scorm/export";

/** GET /api/scorm/export/[courseId] — SCORM 1.2 package of a slide course (docs/SPEC.md §8.1). */
export async function GET(_request: Request, ctx: RouteContext<"/api/scorm/export/[courseId]">) {
  const denied = await requireStaffApi();
  if (denied) return denied;

  const { courseId } = await ctx.params;
  const course = await loadScoCourse(courseId);
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!course.slides.length) return NextResponse.json({ error: "course_has_no_slides" }, { status: 400 });

  const zip = await buildScormZip(course);
  const name = course.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "corso";
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}-scorm12.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
