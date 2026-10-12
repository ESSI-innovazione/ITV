import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { QuizPlayer, type QuizMeta } from "@/components/quiz/quiz-player";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default function QuizPage({ params }: PageProps<"/learn/quizzes/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[480px] max-w-5xl" />}>
      <Quiz params={params} />
    </Suspense>
  );
}

async function Quiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: quiz }, { data: attempts }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, mode, intro, theme, pass_mark, attempts_allowed, course_id, course:courses(id, title)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("quiz_attempts").select("score, passed").eq("quiz_id", id).eq("candidate_id", user.id).not("submitted_at", "is", null),
  ]);
  if (!quiz) notFound();

  const { data: cert } = quiz.course_id
    ? await supabase.from("certificates").select("id").eq("course_id", quiz.course_id).eq("candidate_id", user.id).is("revoked_at", null).maybeSingle()
    : { data: null };

  const scores = (attempts ?? []).map((a) => Number(a.score ?? 0));
  const meta: QuizMeta = {
    id: quiz.id,
    title: quiz.title,
    mode: quiz.mode as QuizMeta["mode"],
    intro: (quiz.intro ?? {}) as QuizMeta["intro"],
    theme: (quiz.theme ?? {}) as QuizMeta["theme"],
    pass_mark: quiz.pass_mark,
    attempts_allowed: quiz.attempts_allowed,
    attempts_used: scores.length,
    best_score: scores.length ? Math.max(...scores) : null,
    certificate_id: cert?.id ?? null,
    course: (quiz.course as unknown as QuizMeta["course"]) ?? null,
  };

  return <QuizPlayer quiz={meta} />;
}
