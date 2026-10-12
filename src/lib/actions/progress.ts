"use server";

import { createClient } from "@/lib/supabase/server";

type RecordSlideViewInput = {
  courseId: string;
  slideId: string;
  /** Index of the slide in the flattened deck, saved as the resume position. */
  index: number;
  /** Slides + (1 if the course has a final quiz). Used for the percent. */
  totalItems: number;
};

/**
 * Marks a slide as viewed and recomputes the course progress.
 * Runs under the candidate's own session, so RLS limits writes to their rows.
 */
export async function recordSlideView(input: RecordSlideViewInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthenticated" };

  const { data: progress, error: pErr } = await supabase
    .from("progress")
    .upsert(
      { course_id: input.courseId, candidate_id: user.id, status: "in_progress", updated_at: new Date().toISOString() },
      { onConflict: "course_id,candidate_id", ignoreDuplicates: false },
    )
    .select("id, status")
    .single();
  if (pErr || !progress) return { ok: false as const, error: pErr?.message ?? "no progress row" };

  await supabase.from("item_progress").upsert(
    { progress_id: progress.id, item_type: "slide", item_id: input.slideId, completed: true, updated_at: new Date().toISOString() },
    { onConflict: "progress_id,item_type,item_id" },
  );

  const { count } = await supabase
    .from("item_progress")
    .select("id", { count: "exact", head: true })
    .eq("progress_id", progress.id)
    .eq("completed", true);

  const completedItems = count ?? 0;
  const percent = Math.min(100, Math.round((completedItems / Math.max(1, input.totalItems)) * 100));
  // Completion with a quiz is granted by the scoring action (M2); without a quiz, viewing everything completes.
  const allSlidesDone = completedItems >= input.totalItems;
  const keepStatus = progress.status === "completed" || progress.status === "certified";
  const status = keepStatus ? progress.status : allSlidesDone ? "completed" : "in_progress";

  await supabase
    .from("progress")
    .update({
      percent,
      status,
      last_position: { index: input.index },
      completed_at: status === "completed" && !keepStatus ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", progress.id);

  return { ok: true as const, percent, status };
}
