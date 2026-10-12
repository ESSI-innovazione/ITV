"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { regenerateSlide, runGenerationJob } from "@/lib/ai/generate-course";
import { GenerateCourseInputSchema } from "@/lib/ai/schemas";

export type JobView = {
  id: string;
  status: "queued" | "outlining" | "writing" | "gamma" | "quiz" | "done" | "failed";
  step: string | null;
  error: string | null;
  output: {
    progress?: Record<string, "outline" | "slides" | "quiz" | "done">;
    sources?: Array<{ title: string; url: string }>;
    courseIds?: string[];
  } | null;
};

/** Creates the job row and runs the pipeline after the response is sent (after()). */
export async function startGeneration(raw: unknown): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const parsed = GenerateCourseInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: job, error } = await supabase
    .from("generation_jobs")
    .insert({ kind: "course", input: parsed.data, status: "queued", step: "In coda", created_by: user.id })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: error?.message ?? "Impossibile creare il job" };

  after(() => runGenerationJob(job.id));
  return { ok: true, jobId: job.id };
}

export async function getJob(jobId: string): Promise<JobView | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("generation_jobs").select("id, status, step, error, output").eq("id", jobId).maybeSingle();
  return (data as JobView | null) ?? null;
}

export async function setCourseStatus(courseId: string, status: "draft" | "published" | "archived") {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({ status, updated_at: new Date().toISOString() }).eq("id", courseId);
  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath("/studio/library");
  revalidatePath("/studio/assignments");
  return { ok: !error, error: error?.message };
}

export async function regenerateSlideAction(courseId: string, slideId: string, instruction: string) {
  try {
    await regenerateSlide(slideId, instruction.trim() || "Rendi la diapositiva più chiara e concreta.");
    revalidatePath(`/studio/courses/${courseId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Errore" };
  }
}
