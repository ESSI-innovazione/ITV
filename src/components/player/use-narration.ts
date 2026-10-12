"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NarrationMode = "browser" | "server";

type Options = {
  /** Try the /api/tts route first; falls back to the browser voice if it is not configured. */
  serverTts: boolean;
  lang?: string;
};

/** Split long text so Chrome's speech engine does not cut off mid-utterance. */
function toSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;:])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Narrates text with either a server-generated MP3 (/api/tts) or the Web Speech API.
 * One utterance at a time; `speak` resolves when playback ends or is stopped.
 */
export function useNarration({ serverTts, lang = "it-IT" }: Options) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [mode, setMode] = useState<NarrationMode>(serverTts ? "server" : "browser");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelRef = useRef<() => void>(() => {});
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const local = all.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      setVoices(local.length ? local : all);
      setVoiceName((cur) => {
        if (cur) return cur;
        // Prefer the higher-quality cloud/online voices when the browser offers them.
        const preferred =
          local.find((v) => /google|natural|online|elsa|isabella|diego/i.test(v.name)) ?? local[0] ?? all[0];
        return preferred?.name ?? null;
      });
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [lang]);

  const stop = useCallback(() => {
    cancelRef.current();
    cancelRef.current = () => {};
    setSpeaking(false);
  }, []);

  const speakBrowser = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;
        synth.cancel();
        const chunks = toSentences(text);
        if (!chunks.length) return resolve();
        const voice = voices.find((v) => v.name === voiceName) ?? null;
        let i = 0;
        let cancelled = false;
        cancelRef.current = () => {
          cancelled = true;
          synth.cancel();
          resolve();
        };
        const next = () => {
          if (cancelled || i >= chunks.length) return resolve();
          const u = new SpeechSynthesisUtterance(chunks[i++]);
          u.lang = lang;
          u.rate = rateRef.current;
          if (voice) u.voice = voice;
          u.onend = next;
          u.onerror = () => resolve();
          synth.speak(u);
        };
        next();
      }),
    [voices, voiceName, lang],
  );

  const speakServer = useCallback(
    async (text: string): Promise<boolean> => {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (!res.ok) return false;
      const url = URL.createObjectURL(await res.blob());
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.playbackRate = rateRef.current;
        audioRef.current = audio;
        cancelRef.current = () => {
          audio.pause();
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
      return true;
    },
    [lang],
  );

  const speak = useCallback(
    async (text: string) => {
      stop();
      if (!text.trim()) return;
      setSpeaking(true);
      try {
        if (mode === "server") {
          const ok = await speakServer(text);
          if (ok) return;
          setMode("browser"); // route not configured: remember and fall back
        }
        if (supported) await speakBrowser(text);
      } finally {
        setSpeaking(false);
      }
    },
    [mode, stop, speakServer, speakBrowser, supported],
  );

  useEffect(() => () => cancelRef.current(), []);

  return { supported: supported || mode === "server", speaking, speak, stop, rate, setRate, voices, voiceName, setVoiceName, mode };
}
