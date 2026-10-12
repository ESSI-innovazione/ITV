"use server";

import { createClient } from "@/lib/supabase/server";

export type QuizQuestion = {
  id: string;
  type: "single" | "multiple" | "truefalse" | "short" | "matching" | "ordering" | "likert" | "free";
  stem: string;
  options: Array<{ id: string; text: string }>;
  image_url: string | null;
  difficulty: "easy" | "medium" | "hard";
};

export type StartedAttempt = {
  attempt_id: string;
  questions: QuizQuestion[];
  attempts_used: number;
  attempts_allowed: number;
  pass_mark: number;
  feedback_mode: "immediate" | "end";
  time_limit_s: number | null;
};

export type AnswerFeedback = { correct: boolean; explanation: string | null; correct_answer: string[] } | { saved: true };

export type AttemptResult = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  pass_mark: number;
  certificate_id: string | null;
  attempts_used: number;
  attempts_allowed: number;
  review: Array<{
    id: string;
    stem: string;
    options: Array<{ id: string; text: string }>;
    your_answer: string[] | null;
    correct_answer: string[];
    explanation: string | null;
    correct: boolean;
  }> | null;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const messages: Record<string, string> = {
  no_attempts_left: "Hai esaurito i tentativi disponibili per questo quiz.",
  forbidden: "Questo quiz non è assegnato a te.",
  quiz_not_found: "Quiz non trovato.",
  attempt_not_open: "Il tentativo non è più aperto.",
};

function friendly(message: string) {
  const key = Object.keys(messages).find((k) => message.includes(k));
  return key ? messages[key] : "Si è verificato un errore. Riprova.";
}

/** All scoring logic lives in Postgres (security definer); these are thin RPC wrappers. */
export async function startAttempt(quizId: string): Promise<Result<StartedAttempt>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as StartedAttempt };
}

export async function answerQuestion(attemptId: string, questionId: string, answer: string[]): Promise<Result<AnswerFeedback>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("answer_quiz_question", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_answer: answer,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as AnswerFeedback };
}

export async function submitAttempt(attemptId: string): Promise<Result<AttemptResult>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt_id: attemptId });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as AttemptResult };
}
