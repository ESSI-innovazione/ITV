import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Widget } from "@/components/app/widget";
import { SlideCanvas } from "@/components/player/slide-canvas";
import { requireUser, STAFF_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlayerSlide } from "@/lib/learner";
import { CourseActions, RegenerateSlideButton } from "./course-actions";

export const maxDuration = 120;

const bandMeta: Record<string, { label: string; cls: string }> = {
  foundation: { label: "Livello base", cls: "bg-yellow/20 text-orange" },
  intermediate: { label: "Livello intermedio", cls: "bg-cyan/20 text-blue" },
  advanced: { label: "Livello avanzato", cls: "bg-green/20 text-green" },
};
const statusMeta: Record<string, { label: string; cls: string }> = {
  draft: { label: "Bozza", cls: "bg-muted text-muted-foreground" },
  in_review: { label: "In revisione", cls: "bg-yellow/25 text-orange" },
  approved: { label: "Approvato", cls: "bg-cyan/20 text-blue" },
  published: { label: "Pubblicato", cls: "bg-green/20 text-green" },
  archived: { label: "Archiviato", cls: "bg-muted text-muted-foreground" },
};

export default function CourseReviewPage({ params }: PageProps<"/studio/courses/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(STAFF_ROLES);
  const supabase = await createClient();

  type Raw = {
    id: string; title: string; description: string | null; type: string; status: string; ada_band: string | null;
    duration_min: number | null; issue_certificate: boolean;
    modules: Array<{ id: string; title: string; position: number; objectives: string[]; slides: Array<{
      id: string; position: number; layout: PlayerSlide["layout"]; title: string; bullets: unknown; speaker_notes: string | null; image_url: string | null; video_url: string | null;
    }> }> | null;
    quizzes: Array<{ id: string; title: string; pass_mark: number; questions: Array<{
      id: string; position: number; type: string; stem: string; options: Array<{ id: string; text: string }>; correct: string[]; difficulty: string; explanation: string | null;
    }> }> | null;
  };
  const { data } = (await supabase
    .from("courses")
    .select("id, title, description, type, status, ada_band, duration_min, issue_certificate, modules(id, title, position, objectives, slides(id, position, layout, title, bullets, speaker_notes, image_url, video_url)), quizzes(id, title, pass_mark, questions(id, position, type, stem, options, correct, difficulty, explanation))")
    .eq("id", id)
    .maybeSingle()) as unknown as { data: Raw | null };
  if (!data) notFound();

  const modules = (data.modules ?? []).sort((a, b) => a.position - b.position);
  const quiz = data.quizzes?.[0] ?? null;
  const questions = (quiz?.questions ?? []).sort((a, b) => a.position - b.position);
  const slideCount = modules.reduce((n, m) => n + m.slides.length, 0);
  const band = data.ada_band ? bandMeta[data.ada_band] : null;
  const status = statusMeta[data.status] ?? statusMeta.draft;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className={`rounded-full ${status.cls}`}>{status.label}</Badge>
            {band && <Badge className={`rounded-full ${band.cls}`}>{band.label}</Badge>}
            <span className="text-xs text-muted-foreground">{modules.length} moduli · {slideCount} slide · {questions.length} domande · {data.duration_min ?? "—"} min</span>
          </div>
          <h2 className="text-2xl font-semibold">{data.title}</h2>
          {data.description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{data.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href={`/learn/courses/${data.id}`} />}>
            <Eye className="size-4" /> Anteprima
          </Button>
          <Button variant="outline" render={<Link href="/studio/assignments" />} disabled={data.status !== "published"}>
            <Send className="size-4" /> Assegna
          </Button>
          <CourseActions courseId={data.id} status={data.status} />
        </div>
      </div>

      {modules.map((m, mi) => (
        <Widget key={m.id} title={`Modulo ${mi + 1} · ${m.title}`}>
          {m.objectives.length > 0 && (
            <p className="mb-4 text-xs text-muted-foreground">Obiettivi: {m.objectives.join(" · ")}</p>
          )}
          <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[...m.slides].sort((a, b) => a.position - b.position).map((s) => {
              const slide: PlayerSlide = {
                id: s.id, position: s.position, layout: s.layout, title: s.title,
                bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : [],
                speakerNotes: s.speaker_notes, imageUrl: s.image_url, videoUrl: s.video_url, moduleTitle: m.title,
              };
              return (
                <li key={s.id} className="space-y-2">
                  <SlideCanvas slide={slide} className="text-xs" />
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-3 text-xs text-muted-foreground">{s.speaker_notes}</p>
                    <RegenerateSlideButton courseId={data.id} slideId={s.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Widget>
      ))}

      {quiz && (
        <Widget title={`${quiz.title} · soglia ${quiz.pass_mark}%`}>
          <ol className="divide-y">
            {questions.map((q, i) => (
              <li key={q.id} className="py-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 w-6 shrink-0 text-muted-foreground">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{q.stem}</p>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {q.options.map((o) => {
                        const ok = q.correct.map((c) => c.toLowerCase()).includes(o.id.toLowerCase());
                        return (
                          <li key={o.id} className={ok ? "font-medium text-green" : "text-muted-foreground"}>
                            {ok ? "✓" : "○"} {o.text}
                          </li>
                        );
                      })}
                    </ul>
                    {q.explanation && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
                  </div>
                  <Badge className="rounded-full bg-muted text-muted-foreground">{q.difficulty}</Badge>
                </div>
              </li>
            ))}
          </ol>
        </Widget>
      )}
    </div>
  );
}
