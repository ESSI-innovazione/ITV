import { z } from "zod";

/** ADA band → generation parameters (docs/SPEC.md §3.2). */
export const BAND_RULES = {
  foundation: {
    label: "Livello base",
    depth: "Parti dalle basi, usa un linguaggio semplice e molti esempi concreti della vita lavorativa quotidiana.",
    slides: [12, 15] as const,
    questions: 10,
    mix: { easy: 0.7, medium: 0.3, hard: 0 },
    passMark: 60,
  },
  intermediate: {
    label: "Livello intermedio",
    depth: "Bilancia concetti e pratica; dai per scontate le nozioni elementari e aggiungi casi applicativi.",
    slides: [10, 12] as const,
    questions: 12,
    mix: { easy: 0.3, medium: 0.5, hard: 0.2 },
    passMark: 70,
  },
  advanced: {
    label: "Livello avanzato",
    depth: "Salta le basi; approfondisci aspetti avanzati, casi studio, eccezioni, responsabilità e sanzioni.",
    slides: [8, 10] as const,
    questions: 15,
    mix: { easy: 0.1, medium: 0.4, hard: 0.5 },
    passMark: 80,
  },
} as const;

export type Band = keyof typeof BAND_RULES;

export const slideLayouts = ["title", "bullets", "two-column", "image-left", "quote", "summary"] as const;

export const OutlineSchema = z.object({
  title: z.string().describe("Titolo del corso"),
  description: z.string().describe("Descrizione in 1–2 frasi"),
  durationMin: z.number().int(),
  modules: z.array(
    z.object({
      title: z.string(),
      objectives: z.array(z.string()),
      slideCount: z.number().int(),
      keyPoints: z.array(z.string()).describe("Contenuti chiave da coprire"),
    }),
  ),
});
export type Outline = z.infer<typeof OutlineSchema>;

// No length caps here on purpose: Gemini compiles the JSON schema into a constrained
// decoder and nested arrays with maxLength/maxItems overflow it ("too many states").
// Stylistic limits live in the prompts; enums and required fields are what we enforce.
export const SlideSchema = z.object({
  layout: z.enum(slideLayouts),
  title: z.string(),
  bullets: z.array(z.string()),
  speakerNotes: z.string().describe("Narrazione completa che il docente legge su questa slide, 2–5 frasi"),
  imagePrompt: z.string().optional(),
});
export type Slide = z.infer<typeof SlideSchema>;

/** All slides of a course in one call, grouped by module in outline order. */
export const CourseSlidesSchema = z.object({
  modules: z.array(
    z.object({
      title: z.string().describe("Stesso titolo del modulo nella struttura"),
      slides: z.array(SlideSchema),
    }),
  ),
});
export type CourseSlides = z.infer<typeof CourseSlidesSchema>;

export const QuestionSchema = z.object({
  type: z.enum(["single", "multiple", "truefalse"]),
  stem: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  correct: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation: z.string(),
  sourceSlideTitle: z.string().optional().describe("Titolo della slide che giustifica la risposta"),
});
export const QuizSchema = z.object({
  headline: z.string().describe("Titolo accattivante per la copertina del quiz"),
  description: z.string(),
  questions: z.array(QuestionSchema),
});
export type GeneratedQuiz = z.infer<typeof QuizSchema>;

/** Input accepted by the "Crea con IA" form. */
export const GenerateCourseInputSchema = z.object({
  topic: z.string().min(3).max(200),
  brief: z.string().max(4000).optional(),
  sourceText: z.string().max(60000).optional(),
  language: z.enum(["it", "en"]).default("it"),
  durationMin: z.number().int().min(10).max(120).default(30),
  bands: z.array(z.enum(["foundation", "intermediate", "advanced"])).min(1),
  useWebResearch: z.boolean().default(true),
  generateQuiz: z.boolean().default(true),
  generateGamma: z.boolean().default(false),
  issueCertificate: z.boolean().default(true),
});
export type GenerateCourseInput = z.infer<typeof GenerateCourseInputSchema>;
