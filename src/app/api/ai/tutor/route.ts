import { NextResponse, type NextRequest } from "next/server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { markModelFailed, pickModel } from "@/lib/ai/provider";
import { BAND_RULES, type Band } from "@/lib/ai/schemas";
import { getCurrentUser } from "@/lib/auth";
import { getCourseForPlayer } from "@/lib/learner";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.TUTOR_DAILY_LIMIT ?? 30);

/**
 * POST /api/ai/tutor — streaming course tutor (docs/SPEC.md §5.5).
 * The whole course fits in context, so grounding is the full slide text with
 * numbered slides; the model cites [Slide n] and the client makes them clickable.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { messages?: UIMessage[]; courseId?: string } | null;
  if (!body?.courseId || !Array.isArray(body.messages)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // RLS: returns null unless the course is assigned+published (or the caller is staff).
  const course = await getCourseForPlayer(body.courseId);
  if (!course) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabase = await createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("tutor_messages")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id)
    .eq("role", "user")
    .gte("created_at", since.toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: "rate_limited", message: `Hai raggiunto il limite di ${DAILY_LIMIT} domande al giorno.` }, { status: 429 });
  }

  const { data: ada } = await supabase.from("ada_profiles").select("band").eq("candidate_id", user.id).maybeSingle();
  const band = (ada?.band as Band | null) ?? "intermediate";

  const slidesText = course.slides
    .map((s, i) => `[Slide ${i + 1}] ${s.title}\n${s.bullets.map((b) => `- ${b}`).join("\n")}\nNote: ${s.speakerNotes ?? ""}`)
    .join("\n\n");

  const system = `Sei il tutor del corso "${course.title}" di ITV Academy. Rispondi in italiano, in modo chiaro e cordiale.
Livello del candidato: ${BAND_RULES[band].label}. ${BAND_RULES[band].depth}
Regole:
- Rispondi SOLO usando il contenuto del corso qui sotto. Se la domanda esce dal corso, dillo gentilmente e riporta al tema.
- Cita sempre le diapositive da cui prendi l'informazione con il formato esatto [Slide n], anche più di una.
- Non rivelare le risposte del quiz finale; se te le chiedono, invita a ripassare le slide pertinenti.
- Risposte brevi (max 120 parole), con un esempio pratico quando aiuta.

CONTENUTO DEL CORSO:
${slidesText}`;

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser?.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n") ?? "";

  const picked = pickModel("fast");
  const result = streamText({
    model: picked.model,
    system,
    messages: await convertToModelMessages(body.messages.slice(-12)),
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(45_000),
    // Streaming cannot fall back mid-response: remember the failure so the next request picks another model.
    onError: ({ error }) => {
      markModelFailed(picked.id, error);
      console.warn(`[tutor] ${picked.id} failed:`, error instanceof Error ? error.message.slice(0, 160) : error);
    },
    onFinish: async ({ text }) => {
      const citations = [...new Set([...text.matchAll(/\[Slide (\d+)\]/g)].map((m) => Number(m[1])))];
      const { error } = await supabase.from("tutor_messages").insert([
        { course_id: course.id, candidate_id: user.id, role: "user", content: lastUserText },
        { course_id: course.id, candidate_id: user.id, role: "assistant", content: text, citations },
      ]);
      if (error) console.warn("[tutor] persist failed:", error.message);
    },
  });

  return result.toUIMessageStreamResponse();
}
