import "server-only";
import { createClient } from "@/lib/supabase/server";
import { generateGammaDeck } from "@/lib/ai/gamma-deck";
import { generateStructured, type Usage } from "@/lib/ai/provider";
import { researchTopic, type Source } from "@/lib/ai/research";
import {
  BAND_RULES,
  CourseSlidesSchema,
  GenerateCourseInputSchema,
  OutlineSchema,
  QuizSchema,
  SlideSchema,
  type Band,
  type GenerateCourseInput,
  type Outline,
} from "@/lib/ai/schemas";

type Supa = Awaited<ReturnType<typeof createClient>>;
type BandProgress = "outline" | "slides" | "quiz" | "gamma" | "done";

const SYSTEM = `Sei un instructional designer senior di ITV Academy e crei corsi e-learning in italiano.
Scrivi contenuti accurati, concreti e verificabili; quando citi norme usa riferimenti precisi (articolo, decreto).
Adatta profondità e linguaggio al livello del candidato indicato. Rispondi solo con JSON conforme allo schema.`;

function buildContext(sources: Source[], sourceText?: string) {
  const parts: string[] = [];
  if (sourceText?.trim()) parts.push(`### Materiale fornito dal docente\n${sourceText.trim().slice(0, 20000)}`);
  let budget = 10000;
  sources.forEach((s, i) => {
    if (budget <= 0) return;
    const chunk = `### Fonte ${i + 1}: ${s.title} (${s.url})\n${s.content.slice(0, Math.min(3500, budget))}`;
    budget -= chunk.length;
    parts.push(chunk);
  });
  return parts.length ? parts.join("\n\n") : "(nessuna fonte: usa le tue conoscenze, restando prudente e generale)";
}

function outlinePrompt(input: GenerateCourseInput, band: Band, context: string) {
  const r = BAND_RULES[band];
  return `Progetta la struttura di un corso a diapositive.
Argomento: ${input.topic}
${input.brief ? `Brief del docente: ${input.brief}\n` : ""}Livello del candidato (punteggio ADA): ${r.label}. ${r.depth}
Durata target: ${input.durationMin} minuti. Totale diapositive tra ${r.slides[0]} e ${r.slides[1]}, distribuite in 3–5 moduli (slideCount per modulo).
Lingua: ${input.language === "it" ? "italiano" : "inglese"}.

Fonti disponibili:
${context}`;
}

function slidesPrompt(input: GenerateCourseInput, band: Band, outline: Outline, context: string) {
  const r = BAND_RULES[band];
  const plan = outline.modules
    .map((m, i) => `${i + 1}. "${m.title}" — ${m.slideCount} diapositive. Obiettivi: ${m.objectives.join("; ")}. Punti chiave: ${m.keyPoints.join("; ")}`)
    .join("\n");
  return `Scrivi TUTTE le diapositive del corso "${outline.title}", modulo per modulo, nell'ordine e con il numero di diapositive indicato.
Livello: ${r.label}. ${r.depth}
Lingua: ${input.language === "it" ? "italiano" : "inglese"}.

Piano dei moduli:
${plan}

Regole: la primissima diapositiva ha layout "title" e presenta il corso; l'ultimissima ha layout "summary" e riepiloga; varia i layout (bullets, two-column, image-left, quote); massimo 5 punti per diapositiva, ognuno breve (max 15 parole); titoli di slide univoci; le speakerNotes sono la narrazione completa letta da una voce sintetica (2–5 frasi, tono da docente, niente elenchi puntati).

Fonti:
${context}`;
}

function quizPrompt(band: Band, outline: Outline, slideTitles: string[], slideText: string) {
  const r = BAND_RULES[band];
  const n = r.questions;
  const counts = {
    easy: Math.round(n * r.mix.easy),
    hard: Math.round(n * r.mix.hard),
  };
  const medium = n - counts.easy - counts.hard;
  return `Crea il quiz finale del corso "${outline.title}" per il livello ${r.label}.
Numero esatto di domande: ${n} (${counts.easy} easy, ${medium} medium, ${counts.hard} hard).
Tipi ammessi: single (una sola risposta corretta, 4 opzioni con id a,b,c,d), multiple (2–3 corrette su 4–5 opzioni), truefalse (opzioni esattamente [{"id":"true","text":"Vero"},{"id":"false","text":"Falso"}]).
Ogni domanda deve essere verificabile dal contenuto delle diapositive, con "sourceSlideTitle" scelto ESATTAMENTE tra: ${slideTitles.map((t) => `"${t}"`).join(", ")}.
"explanation" spiega perché la risposta è corretta in 1–2 frasi. "headline" è un titolo accattivante per la copertina; "description" invita a mettersi alla prova.

Contenuto delle diapositive:
${slideText}`;
}

type BandRun = {
  supabase: Supa;
  input: GenerateCourseInput;
  band: Band;
  context: string;
  createdBy: string | null;
  multi: boolean;
  onProgress: (p: BandProgress) => Promise<void>;
  logUsage: (u: Usage) => void;
};

async function generateForBand({ supabase, input, band, context, createdBy, multi, onProgress, logUsage }: BandRun) {
  const rules = BAND_RULES[band];

  await onProgress("outline");
  const outline = await generateStructured({
    kind: "main", schema: OutlineSchema, system: SYSTEM, prompt: outlinePrompt(input, band, context), onUsage: logUsage,
  });

  await onProgress("slides");
  // One call for the whole deck keeps us inside free-tier rate limits and improves coherence.
  const deck = await generateStructured({
    kind: "main", schema: CourseSlidesSchema, system: SYSTEM, prompt: slidesPrompt(input, band, outline, context), onUsage: logUsage, temperature: 0.6,
  });
  // Align by position with the outline; tolerate a module count mismatch.
  const moduleSlides = outline.modules.map((_, i) => deck.modules[i] ?? { title: outline.modules[i].title, slides: [] });

  const { data: course, error: cErr } = await supabase
    .from("courses")
    .insert({
      title: multi ? `${outline.title} · ${rules.label}` : outline.title,
      description: outline.description,
      type: "slides",
      status: "draft",
      language: input.language,
      duration_min: input.durationMin,
      ada_band: band,
      issue_certificate: input.issueCertificate,
      tags: ["ia"],
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (cErr || !course) throw new Error(`Impossibile creare il corso: ${cErr?.message}`);

  const slideIdByTitle = new Map<string, string>();
  const allSlides: Array<{ title: string; bullets: string[] }> = [];
  for (const [mi, m] of outline.modules.entries()) {
    const { data: mod, error: mErr } = await supabase
      .from("modules")
      .insert({ course_id: course.id, position: mi, title: m.title, objectives: m.objectives })
      .select("id")
      .single();
    if (mErr || !mod) throw new Error(`Impossibile creare il modulo: ${mErr?.message}`);

    const rows = moduleSlides[mi].slides.map((s, si) => ({
      module_id: mod.id, position: si, layout: s.layout, title: s.title, bullets: s.bullets, speaker_notes: s.speakerNotes,
    }));
    const { data: inserted, error: sErr } = await supabase.from("slides").insert(rows).select("id, title");
    if (sErr) throw new Error(`Impossibile salvare le slide: ${sErr.message}`);
    inserted?.forEach((s) => slideIdByTitle.set(s.title.trim().toLowerCase(), s.id));
    allSlides.push(...moduleSlides[mi].slides.map((s) => ({ title: s.title, bullets: s.bullets })));
  }

  // Gamma takes 1–3 min and is independent of the quiz: run it alongside.
  const gammaStep = input.generateGamma
    ? generateGammaDeck(course.id, supabase).catch((e) => console.warn("[gamma] deck failed:", e instanceof Error ? e.message : e))
    : Promise.resolve();

  if (input.generateQuiz) {
    await onProgress("quiz");
    const slideText = allSlides.map((s) => `- ${s.title}: ${s.bullets.join(" | ")}`).join("\n");
    const quiz = await generateStructured({
      kind: "main", schema: QuizSchema, system: SYSTEM,
      prompt: quizPrompt(band, outline, allSlides.map((s) => s.title), slideText), onUsage: logUsage,
    });
    const { data: q, error: qErr } = await supabase
      .from("quizzes")
      .insert({
        course_id: course.id,
        title: `Quiz finale – ${outline.title}`,
        mode: "quiz",
        intro: { headline: quiz.headline, description: quiz.description },
        theme: { accent: "#4d53e0", dark: true },
        feedback_mode: "immediate",
        pass_mark: rules.passMark,
        attempts_allowed: 3,
        shuffle: true,
        difficulty_mix: rules.mix,
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (qErr || !q) throw new Error(`Impossibile creare il quiz: ${qErr?.message}`);

    const { error: qsErr } = await supabase.from("questions").insert(
      quiz.questions.map((question, i) => ({
        quiz_id: q.id,
        position: i,
        type: question.type,
        stem: question.stem,
        options: question.options,
        correct: question.correct,
        difficulty: question.difficulty,
        explanation: question.explanation,
        source_slide_id: question.sourceSlideTitle ? slideIdByTitle.get(question.sourceSlideTitle.trim().toLowerCase()) ?? null : null,
      })),
    );
    if (qsErr) throw new Error(`Impossibile salvare le domande: ${qsErr.message}`);
  }

  if (input.generateGamma) {
    await onProgress("gamma");
    await gammaStep;
  }

  await onProgress("done");
  return course.id;
}

function overallStatus(progress: Record<string, BandProgress>) {
  const values = Object.values(progress);
  if (values.some((v) => v === "gamma")) return "gamma";
  if (values.some((v) => v === "quiz")) return "quiz";
  if (values.some((v) => v === "slides")) return "writing";
  return "outlining";
}

/** Runs a generation job end to end. Called via after() from the server action; errors land in the job row. */
export async function runGenerationJob(jobId: string) {
  const supabase = await createClient();
  const { data: job } = await supabase.from("generation_jobs").select("id, input, created_by").eq("id", jobId).single();
  if (!job) return;

  const progress: Record<string, BandProgress> = {};
  const patch = async (fields: Record<string, unknown>) =>
    supabase.from("generation_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);
  // supabase-js builders are lazy: the insert only runs when awaited/then-ed.
  const logUsage = (u: Usage) => {
    void supabase
      .from("usage_ledger")
      .insert({ kind: "llm", ref_id: jobId, model: u.model, tokens_in: u.inputTokens, tokens_out: u.outputTokens })
      .then(({ error }) => error && console.warn("[ai] usage log failed:", error.message));
  };

  try {
    const input = GenerateCourseInputSchema.parse(job.input);
    await patch({ status: "outlining", step: "Ricerca delle fonti", output: { progress } });

    const sources = input.useWebResearch ? await researchTopic(`${input.topic} ${input.brief ?? ""}`.trim()) : [];
    const context = buildContext(sources, input.sourceText);
    const sourceList = sources.map((s) => ({ title: s.title, url: s.url }));
    await patch({ step: `Fonti trovate: ${sources.length}`, output: { progress, sources: sourceList } });

    const courseIds = await Promise.all(
      input.bands.map((band) =>
        generateForBand({
          supabase, input, band, context, createdBy: job.created_by, multi: input.bands.length > 1, logUsage,
          onProgress: async (p) => {
            progress[band] = p;
            await patch({ status: overallStatus(progress), step: stepText(progress), output: { progress, sources: sourceList } });
          },
        }),
      ),
    );

    await patch({ status: "done", step: "Completato", output: { progress, sources: sourceList, courseIds }, course_id: courseIds[0] });
  } catch (e) {
    await patch({ status: "failed", error: e instanceof Error ? e.message : String(e), output: { progress } });
  }
}

function stepText(progress: Record<string, BandProgress>) {
  const label: Record<BandProgress, string> = { outline: "struttura", slides: "slide", quiz: "quiz", gamma: "deck Gamma", done: "fatto" };
  return Object.entries(progress).map(([b, p]) => `${BAND_RULES[b as Band].label}: ${label[p]}`).join(" · ");
}

/** Rewrites one slide following an instruction, keeping it coherent with its module and level. */
export async function regenerateSlide(slideId: string, instruction: string) {
  const supabase = await createClient();
  const { data: slide } = await supabase
    .from("slides")
    .select("id, layout, title, bullets, speaker_notes, module:modules(title, course:courses(title, ada_band, language))")
    .eq("id", slideId)
    .maybeSingle();
  if (!slide) throw new Error("Slide non trovata");
  const mod = slide.module as unknown as { title: string; course: { title: string; ada_band: Band | null; language: string } | null } | null;
  const band = mod?.course?.ada_band ?? "intermediate";

  const next = await generateStructured({
    kind: "main", schema: SlideSchema, system: SYSTEM, temperature: 0.7,
    prompt: `Riscrivi questa diapositiva del corso "${mod?.course?.title}" (modulo "${mod?.title}", livello ${BAND_RULES[band].label}) seguendo l'istruzione del docente.
Istruzione: ${instruction}
Diapositiva attuale: ${JSON.stringify({ layout: slide.layout, title: slide.title, bullets: slide.bullets, speakerNotes: slide.speaker_notes })}
Mantieni il tema e il livello; le speakerNotes restano una narrazione di 2–5 frasi.`,
  });

  const { error } = await supabase
    .from("slides")
    .update({ layout: next.layout, title: next.title, bullets: next.bullets, speaker_notes: next.speakerNotes })
    .eq("id", slideId);
  if (error) throw new Error(error.message);
  return next;
}
