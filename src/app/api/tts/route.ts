import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_CHARS = 4000;

/**
 * Server-side narration. Returns MP3 for the given text when TTS_PROVIDER=openai
 * (and OPENAI_API_KEY) is configured; otherwise 501 so the client falls back to
 * the browser voice. Provider calls stay here so keys never reach the client.
 */
export async function POST(request: NextRequest) {
  if (process.env.TTS_PROVIDER !== "openai" || !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "tts_not_configured" }, { status: 501 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { text?: string; lang?: string } | null;
  const text = body?.text?.trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: process.env.TTS_VOICE ?? "alloy",
      input: text,
      response_format: "mp3",
      instructions: `Narra in modo chiaro e professionale, come un docente di e-learning. Lingua: ${body?.lang ?? "it-IT"}.`,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "tts_failed", status: upstream.status }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
}
