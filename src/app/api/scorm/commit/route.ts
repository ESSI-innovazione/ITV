import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Cmi = Record<string, unknown>;
const get = (o: unknown, path: string) => path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Cmi)[k] : undefined), o);

/**
 * POST /api/scorm/commit?packageId=… — scorm-again posts { cmi } here (dataCommitFormat: json).
 * Persists the CMI and mirrors completion/score into the course progress.
 */
export async function POST(request: NextRequest) {
  const packageId = request.nextUrl.searchParams.get("packageId");
  if (!packageId) return NextResponse.json({ result: false, errorCode: 201 }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ result: false, errorCode: 301 }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { cmi?: Cmi } | null;
  const cmi = body?.cmi ?? {};

  const { data: pkg } = await supabase.from("scorm_packages").select("course_id, version").eq("id", packageId).maybeSingle();
  if (!pkg) return NextResponse.json({ result: false, errorCode: 101 }, { status: 404 });

  await supabase
    .from("scorm_runtime")
    .upsert({ package_id: packageId, candidate_id: user.id, cmi, updated_at: new Date().toISOString() }, { onConflict: "package_id,candidate_id" });

  // SCORM 1.2 vs 2004 field names.
  const status12 = String(get(cmi, "core.lesson_status") ?? "");
  const completion = String(get(cmi, "completion_status") ?? "");
  const success = String(get(cmi, "success_status") ?? "");
  const rawScore = Number(get(cmi, "core.score.raw") ?? get(cmi, "score.raw") ?? NaN);
  const done = ["completed", "passed"].includes(status12) || completion === "completed" || success === "passed";
  const failed = status12 === "failed" || success === "failed";

  const { data: progress } = await supabase
    .from("progress")
    .upsert(
      { course_id: pkg.course_id, candidate_id: user.id, status: "in_progress", updated_at: new Date().toISOString() },
      { onConflict: "course_id,candidate_id" },
    )
    .select("id, status")
    .single();

  if (progress) {
    const keep = progress.status === "completed" || progress.status === "certified";
    await supabase
      .from("progress")
      .update({
        status: keep ? progress.status : done ? "completed" : "in_progress",
        percent: done ? 100 : Number.isFinite(rawScore) ? Math.max(0, Math.min(99, Math.round(rawScore))) : failed ? 50 : 10,
        last_position: { lesson_location: get(cmi, "core.lesson_location") ?? get(cmi, "location") ?? null },
        completed_at: done && !keep ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progress.id);
  }

  return NextResponse.json({ result: true, errorCode: 0 });
}
