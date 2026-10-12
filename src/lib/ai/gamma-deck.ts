import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createGammaDeck, waitForGamma } from "@/lib/gamma";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Builds the `---`-separated markdown Gamma turns into cards, one per slide. */
function courseToMarkdown(course: { title: string; description: string | null }, slides: Array<{ title: string; bullets: string[]; layout: string }>) {
  const cards = slides.map((s) => {
    const body = s.bullets.length ? s.bullets.map((b) => `- ${b}`).join("\n") : "";
    return `# ${s.title}\n${body}`.trim();
  });
  // Gamma keeps the first card as the cover when it only has a title + short line.
  if (!slides.length || slides[0].layout !== "title") cards.unshift(`# ${course.title}\n${course.description ?? ""}`.trim());
  return cards.join("\n\n---\n\n");
}

/**
 * Generates a Gamma deck for a course from its stored slides and records it in
 * gamma_decks. Safe to call from after(): all failures land in the row.
 */
export async function generateGammaDeck(courseId: string, supabaseIn?: Supa) {
  const supabase = supabaseIn ?? (await createClient());

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, language, ada_band, modules(position, slides(position, layout, title, bullets))")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) throw new Error("Corso non trovato");

  type Mod = { position: number; slides: Array<{ position: number; layout: string; title: string; bullets: unknown }> };
  const slides = ((course.modules ?? []) as unknown as Mod[])
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => [...m.slides].sort((a, b) => a.position - b.position))
    .map((s) => ({ layout: s.layout, title: s.title, bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : [] }));
  if (!slides.length) throw new Error("Il corso non ha diapositive");

  const { data: row, error: rErr } = await supabase
    .from("gamma_decks")
    .insert({ course_id: courseId, ada_band: course.ada_band, status: "generating" })
    .select("id")
    .single();
  if (rErr || !row) throw new Error(rErr?.message ?? "gamma_decks insert failed");

  const patch = (fields: Record<string, unknown>) =>
    supabase.from("gamma_decks").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", row.id);

  try {
    const markdown = courseToMarkdown(course, slides);
    const numCards = markdown.split("\n---\n").length;
    const generationId = await createGammaDeck({
      title: course.title,
      markdown,
      numCards,
      language: course.language ?? "it",
      audience: "Lavoratori in formazione aziendale (e-learning)",
    });
    await patch({ gamma_generation_id: generationId });

    const result = await waitForGamma(generationId);
    if (result.status !== "completed") {
      await patch({ status: "failed", error: result.error?.message ?? "generazione fallita" });
      return { ok: false as const, deckId: row.id, error: result.error?.message };
    }
    await patch({
      status: "done",
      gamma_id: result.gammaId ?? null,
      gamma_url: result.gammaUrl ?? null,
      export_url: result.exportUrl ?? null,
      credits_used: result.credits?.deducted ?? null,
    });
    if (typeof result.credits?.deducted === "number") {
      void supabase
        .from("usage_ledger")
        .insert({ kind: "gamma", ref_id: row.id, credits: result.credits.deducted })
        .then(({ error }) => error && console.warn("[gamma] usage log failed:", error.message));
    }
    return { ok: true as const, deckId: row.id, gammaUrl: result.gammaUrl };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await patch({ status: "failed", error: message });
    return { ok: false as const, deckId: row.id, error: message };
  }
}
