import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SlideLayout = "title" | "bullets" | "two-column" | "image-left" | "quote" | "summary";

export type PlayerSlide = {
  id: string;
  position: number;
  layout: SlideLayout;
  title: string;
  bullets: string[];
  speakerNotes: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  moduleTitle: string;
};

export type PlayerCourse = {
  id: string;
  title: string;
  description: string | null;
  type: "slides" | "scroll" | "scorm";
  durationMin: number | null;
  slides: PlayerSlide[];
  quiz: { id: string; title: string } | null;
  /** Latest completed Gamma deck, if any. */
  gamma: { deckId: string; gammaId: string | null; gammaUrl: string | null; hasExport: boolean } | null;
};

export type AssignedCourse = {
  assignmentId: string;
  dueAt: string | null;
  course: { id: string; title: string; type: string; coverUrl: string | null; durationMin: number | null };
  progress: { status: string; percent: number; lastPosition: { index?: number } | null };
};

/** Courses assigned to a candidate, with their progress row (or a default). */
export async function getAssignedCourses(candidateId: string): Promise<AssignedCourse[]> {
  const supabase = await createClient();
  const [{ data: assignments }, { data: progress }] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, due_at, course:courses(id, title, type, cover_url, duration_min)")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
    supabase.from("progress").select("course_id, status, percent, last_position").eq("candidate_id", candidateId),
  ]);

  const byCourse = new Map((progress ?? []).map((p) => [p.course_id, p]));

  return (assignments ?? []).flatMap((a) => {
    const c = a.course as unknown as AssignedCourse["course"] & { cover_url: string | null; duration_min: number | null } | null;
    if (!c) return [];
    const p = byCourse.get(c.id);
    return [{
      assignmentId: a.id,
      dueAt: a.due_at,
      course: { id: c.id, title: c.title, type: c.type, coverUrl: c.cover_url, durationMin: c.duration_min },
      progress: {
        status: p?.status ?? "not_started",
        percent: p?.percent ?? 0,
        lastPosition: (p?.last_position as { index?: number } | null) ?? null,
      },
    }];
  });
}

/** A course with its slides flattened in module/slide order, for the player. RLS limits this to assigned + published (or staff). */
export async function getCourseForPlayer(courseId: string): Promise<PlayerCourse | null> {
  const supabase = await createClient();

  type RawSlide = {
    id: string; position: number; layout: SlideLayout; title: string; bullets: unknown;
    speaker_notes: string | null; image_url: string | null; video_url: string | null;
  };
  type Mod = { id: string; title: string; position: number; slides: RawSlide[] };
  type RawCourse = {
    id: string; title: string; description: string | null; type: string; duration_min: number | null;
    modules: Mod[] | null; quizzes: Array<{ id: string; title: string }> | null;
  };

  // The nested select is too deep for supabase-js's query-string type parser, so the row is typed by hand.
  const { data } = (await supabase
    .from("courses")
    .select(
      "id, title, description, type, duration_min, modules(id, title, position, slides(id, position, layout, title, bullets, speaker_notes, image_url, video_url)), quizzes(id, title)",
    )
    .eq("id", courseId)
    .maybeSingle()) as unknown as { data: RawCourse | null };
  if (!data) return null;

  const modules = (data.modules ?? []).sort((a, b) => a.position - b.position);

  const slides: PlayerSlide[] = modules.flatMap((m) =>
    [...m.slides].sort((a, b) => a.position - b.position).map((s) => ({
      id: s.id,
      position: s.position,
      layout: s.layout,
      title: s.title,
      bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : [],
      speakerNotes: s.speaker_notes,
      imageUrl: s.image_url,
      videoUrl: s.video_url,
      moduleTitle: m.title,
    })),
  );

  const quizzes = data.quizzes ?? [];

  const { data: deck } = await supabase
    .from("gamma_decks")
    .select("id, gamma_id, gamma_url, export_url")
    .eq("course_id", courseId)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    type: data.type as PlayerCourse["type"],
    durationMin: data.duration_min,
    slides,
    quiz: quizzes[0] ?? null,
    gamma: deck ? { deckId: deck.id, gammaId: deck.gamma_id, gammaUrl: deck.gamma_url, hasExport: !!deck.export_url } : null,
  };
}

/** Which slide ids the candidate has already viewed, plus the saved position. */
export async function getPlayerProgress(courseId: string, candidateId: string) {
  const supabase = await createClient();
  const { data: progress } = await supabase
    .from("progress")
    .select("id, percent, status, last_position")
    .eq("course_id", courseId)
    .eq("candidate_id", candidateId)
    .maybeSingle();
  if (!progress) return { viewed: [] as string[], index: 0, percent: 0, status: "not_started" };

  const { data: items } = await supabase
    .from("item_progress")
    .select("item_id")
    .eq("progress_id", progress.id)
    .eq("item_type", "slide")
    .eq("completed", true);

  return {
    viewed: (items ?? []).map((i) => i.item_id),
    index: ((progress.last_position as { index?: number } | null)?.index) ?? 0,
    percent: progress.percent,
    status: progress.status,
  };
}
