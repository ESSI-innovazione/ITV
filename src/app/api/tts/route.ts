import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_CHARS = 4000;

/**
 * Server-side narration. Returns audio for the given text when a TTS provider is
 * configured (TTS_PROVIDER=gemini | openai); otherwise 501 so the client falls back
 * to the browser voice. Provider calls stay here so keys never reach the client.
 */
export async function POST(request: NextRequest) {
  const provider = process.env.TTS_PROVIDER;
  const configured =
    (provider === "gemini" && !!process.env.GOOGLE_GENERATIVE_AI_API_KEY) ||
    (provider === "openai" && !!process.env.OPENAI_API_KEY);
  if (!configured) return NextResponse.json({ error: "tts_not_configured" }, { status: 501 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { text?: string; lang?: string } | null;
  const text = body?.text?.trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  return provider === "gemini" ? geminiTts(text) : openaiTts(text, body?.lang ?? "it-IT");
}

/** Gemini TTS returns raw 16-bit PCM; wrap it in a WAV header so <audio> can play it. */
async function geminiTts(text: string) {
  const model = process.env.TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
  const voice = process.env.TTS_VOICE ?? "Kore";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Leggi con tono chiaro e professionale, come un docente di e-learning:\n${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "tts_failed", status: res.status }, { status: 502 });

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) return NextResponse.json({ error: "tts_empty" }, { status: 502 });

  const pcm = Buffer.from(part.inlineData.data, "base64");
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
  const wav = pcmToWav(pcm, rate, 1, 16);

  return new Response(new Uint8Array(wav), {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" },
  });
}

async function openaiTts(text: string, lang: string) {
  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: process.env.TTS_VOICE ?? "alloy",
      input: text,
      response_format: "mp3",
      instructions: `Narra in modo chiaro e professionale, come un docente di e-learning. Lingua: ${lang}.`,
    }),
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "tts_failed", status: upstream.status }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
}

function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
