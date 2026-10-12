"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Award, Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Widget } from "@/components/app/widget";
import { cn } from "@/lib/utils";
import {
  answerQuestion,
  startAttempt,
  submitAttempt,
  type AttemptResult,
  type QuizQuestion,
  type StartedAttempt,
} from "@/lib/actions/quiz";

export type QuizMeta = {
  id: string;
  title: string;
  mode: "quiz" | "survey";
  intro: { headline?: string; description?: string; hero_url?: string };
  theme: { accent?: string; bg_image?: string; dark?: boolean };
  pass_mark: number;
  attempts_allowed: number;
  attempts_used: number;
  best_score: number | null;
  certificate_id: string | null;
  course: { id: string; title: string } | null;
};

type Phase = { kind: "intro" } | { kind: "question"; attempt: StartedAttempt; i: number } | { kind: "result"; result: AttemptResult };

type Feedback = { correct: boolean; explanation: string | null; correct_answer: string[] };

/**
 * iSpring-style cinematic quiz: hero intro card → one question per card with a
 * live score top-right → results with review and certificate. All scoring is server-side.
 */
export function QuizPlayer({ quiz }: { quiz: QuizMeta }) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [answer, setAnswer] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const accent = quiz.theme.accent ?? "#ff2d7a";
  const heroStyle = useMemo(
    () => ({
      backgroundImage: quiz.theme.bg_image
        ? `linear-gradient(90deg, rgba(20,15,60,.92) 0%, rgba(20,15,60,.55) 60%, rgba(20,15,60,.2) 100%), url(${quiz.theme.bg_image})`
        : "radial-gradient(120% 120% at 100% 0%, #3b1f7a 0%, #1b1442 45%, #120c33 100%)",
      backgroundSize: "cover",
      backgroundPosition: "center",
    }),
    [quiz.theme.bg_image],
  );

  const begin = () =>
    start(async () => {
      setError(null);
      const r = await startAttempt(quiz.id);
      if (!r.ok) return setError(r.error);
      setCorrectCount(0);
      setAnswer([]);
      setFeedback(null);
      setPhase({ kind: "question", attempt: r.data, i: 0 });
    });

  const send = () => {
    if (phase.kind !== "question") return;
    const q = phase.attempt.questions[phase.i];
    start(async () => {
      setError(null);
      const r = await answerQuestion(phase.attempt.attempt_id, q.id, answer);
      if (!r.ok) return setError(r.error);
      if ("correct" in r.data) {
        if (r.data.correct) setCorrectCount((c) => c + 1);
        setFeedback(r.data);
      } else {
        advance();
      }
    });
  };

  const advance = () => {
    if (phase.kind !== "question") return;
    setFeedback(null);
    setAnswer([]);
    const next = phase.i + 1;
    if (next < phase.attempt.questions.length) {
      setPhase({ ...phase, i: next });
    } else {
      start(async () => {
        const r = await submitAttempt(phase.attempt.attempt_id);
        if (!r.ok) return setError(r.error);
        setPhase({ kind: "result", result: r.data });
      });
    }
  };

  const total = phase.kind === "question" ? phase.attempt.questions.length : 0;
  const liveScore = total ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="widget overflow-hidden p-3 sm:p-4">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-lg text-white" style={heroStyle}>
          {phase.kind === "question" && quiz.mode === "quiz" && (
            <span className="absolute top-4 right-5 text-xs text-white/80">
              Il tuo punteggio: <span className="font-semibold text-white">{liveScore} su 100</span>
            </span>
          )}

          {phase.kind === "intro" && (
            <div className="flex min-h-[420px] flex-col justify-center p-8 sm:p-12 lg:w-3/5">
              <p className="mb-4 text-sm font-semibold" style={{ color: accent }}>{quiz.title}</p>
              <h2 className="text-3xl leading-tight font-bold sm:text-5xl">{quiz.intro.headline ?? quiz.title}</h2>
              {quiz.intro.description && <p className="mt-6 max-w-xl text-base text-white/85 sm:text-lg">{quiz.intro.description}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-white/70">
                <span>Soglia: {quiz.pass_mark}%</span>
                <span>Tentativi: {quiz.attempts_used}/{quiz.attempts_allowed}</span>
                {quiz.best_score !== null && <span>Miglior punteggio: {quiz.best_score}%</span>}
              </div>
            </div>
          )}

          {phase.kind === "question" && (
            <QuestionCard
              q={phase.attempt.questions[phase.i]}
              index={phase.i}
              total={total}
              accent={accent}
              answer={answer}
              setAnswer={setAnswer}
              feedback={feedback}
            />
          )}

          {phase.kind === "result" && <ResultCard result={phase.result} accent={accent} />}
        </div>

        {/* Action row (outside the hero, like the iSpring player) */}
        <div className="flex items-center justify-between gap-3 px-1 pt-3">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex items-center gap-2">
            {phase.kind === "intro" && (
              quiz.attempts_used >= quiz.attempts_allowed ? (
                <span className="text-sm text-muted-foreground">Tentativi esauriti</span>
              ) : (
                <Button size="lg" onClick={begin} disabled={pending} style={{ backgroundColor: accent }} className="font-semibold uppercase tracking-wide">
                  {quiz.attempts_used > 0 ? "Riprova" : "Inizia quiz"} <ChevronRight className="size-4" />
                </Button>
              )
            )}
            {phase.kind === "question" && !feedback && (
              <Button size="lg" onClick={send} disabled={pending || answer.length === 0} style={{ backgroundColor: accent }} className="font-semibold uppercase tracking-wide">
                Invia
              </Button>
            )}
            {phase.kind === "question" && feedback && (
              <Button size="lg" onClick={advance} disabled={pending} style={{ backgroundColor: accent }} className="font-semibold uppercase tracking-wide">
                {phase.i + 1 < total ? "Continua" : "Vedi il risultato"} <ArrowRight className="size-4" />
              </Button>
            )}
            {phase.kind === "result" && (
              <>
                {quiz.course && (
                  <Button variant="outline" render={<Link href={`/learn/courses/${quiz.course.id}`} />}>Torna al corso</Button>
                )}
                {!phase.result.passed && phase.result.attempts_used < phase.result.attempts_allowed && (
                  <Button onClick={begin} disabled={pending} style={{ backgroundColor: accent }}>
                    <RotateCcw className="size-4" /> Riprova
                  </Button>
                )}
                {phase.result.certificate_id && (
                  <Button render={<Link href={`/learn/certificates`} />} style={{ backgroundColor: accent }}>
                    <Award className="size-4" /> Vedi certificato
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {phase.kind === "result" && phase.result.review && <ReviewList review={phase.result.review} />}
    </div>
  );
}

function QuestionCard({
  q, index, total, accent, answer, setAnswer, feedback,
}: {
  q: QuizQuestion; index: number; total: number; accent: string;
  answer: string[]; setAnswer: (a: string[]) => void; feedback: Feedback | null;
}) {
  const multi = q.type === "multiple";
  const toggle = (id: string) => {
    if (feedback) return;
    if (multi) setAnswer(answer.includes(id) ? answer.filter((a) => a !== id) : [...answer, id]);
    else setAnswer([id]);
  };

  return (
    <div className="grid min-h-[420px] gap-8 p-8 sm:p-12 lg:grid-cols-5">
      <div className={cn("flex flex-col justify-center", q.image_url ? "lg:col-span-3" : "lg:col-span-5")}>
        <p className="mb-3 text-sm" style={{ color: accent }}>Domanda {index + 1} di {total}</p>
        <h2 className="text-2xl leading-snug font-semibold sm:text-3xl">{q.stem}</h2>

        {(q.type === "single" || q.type === "multiple" || q.type === "truefalse" || q.type === "likert") && (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {q.options.map((o) => {
              const selected = answer.includes(o.id);
              const isRight = feedback?.correct_answer.map((c) => c.toLowerCase()).includes(o.id.toLowerCase());
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => toggle(o.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base transition",
                      "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
                      feedback && isRight && "bg-green/25",
                      feedback && selected && !isRight && "bg-pink/25",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center border-2 border-white/70",
                        multi ? "rounded-sm" : "rounded-full",
                        selected && "border-transparent",
                      )}
                      style={selected ? { backgroundColor: accent } : undefined}
                    >
                      {selected && <Check className="size-4" />}
                    </span>
                    <span>{o.text}</span>
                    {feedback && isRight && <Check className="ml-auto size-4 text-green" />}
                    {feedback && selected && !isRight && <X className="ml-auto size-4 text-pink" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {q.type === "short" && (
          <Input
            className="mt-8 h-12 max-w-md border-white/40 bg-white/10 text-white placeholder:text-white/50"
            placeholder="Scrivi la risposta…"
            value={answer[0] ?? ""}
            onChange={(e) => setAnswer(e.target.value ? [e.target.value] : [])}
            disabled={!!feedback}
          />
        )}

        {q.type === "free" && (
          <Textarea
            className="mt-8 max-w-xl border-white/40 bg-white/10 text-white placeholder:text-white/50"
            placeholder="La tua risposta…"
            value={answer[0] ?? ""}
            onChange={(e) => setAnswer(e.target.value ? [e.target.value] : [])}
          />
        )}

        {feedback && (
          <div className={cn("mt-6 rounded-lg p-4 text-sm", feedback.correct ? "bg-green/20" : "bg-pink/20")}>
            <p className="font-semibold">{feedback.correct ? "Esatto!" : "Non proprio."}</p>
            {feedback.explanation && <p className="mt-1 text-white/90">{feedback.explanation}</p>}
          </div>
        )}
      </div>

      {q.image_url && (
        <div className="hidden items-center justify-center lg:col-span-2 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image_url} alt="" className="max-h-80 rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, accent }: { result: AttemptResult; accent: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center sm:p-12">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Punteggio ${result.score}%`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke={result.passed ? "#43bc13" : accent} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, result.score) / 100)} transform="rotate(-90 70 70)"
        />
        <text x="70" y="78" textAnchor="middle" fill="white" fontSize="28" fontWeight="700">{Math.round(result.score)}%</text>
      </svg>
      <h2 className="mt-6 text-3xl font-bold">{result.passed ? "Quiz superato!" : "Non è andata"}</h2>
      <p className="mt-2 text-white/80">
        {result.correct} risposte corrette su {result.total} · soglia {result.pass_mark}%
      </p>
      {result.certificate_id && (
        <p className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-sm">
          <Award className="mr-1 inline size-4 text-yellow" /> Certificato <span className="font-mono">{result.certificate_id}</span>
        </p>
      )}
      {!result.passed && (
        <p className="mt-4 text-sm text-white/70">Tentativi usati: {result.attempts_used}/{result.attempts_allowed}</p>
      )}
    </div>
  );
}

function ReviewList({ review }: { review: NonNullable<AttemptResult["review"]> }) {
  const label = (q: (typeof review)[number], ids: string[] | null) =>
    (ids ?? []).map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(", ") || "—";
  return (
    <Widget title="Rivedi le risposte">
      <ol className="divide-y">
        {review.map((q, i) => (
          <li key={q.id} className="flex gap-3 py-4 text-sm">
            <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white", q.correct ? "bg-green" : "bg-pink")}>
              {q.correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{i + 1}. {q.stem}</p>
              <p className="mt-1 text-muted-foreground">La tua risposta: {label(q, q.your_answer)}</p>
              {!q.correct && <p className="text-muted-foreground">Risposta corretta: {label(q, q.correct_answer)}</p>}
              {q.explanation && <p className="mt-1 text-xs text-muted-foreground">{q.explanation}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Widget>
  );
}
