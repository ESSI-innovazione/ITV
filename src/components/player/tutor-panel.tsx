"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TutorPanelProps = {
  courseId: string;
  courseTitle: string;
  /** Jump the player to a slide (0-based). */
  onCite: (index: number) => void;
  suggestions?: string[];
};

/** Renders text with clickable [Slide n] citations. */
function CitedText({ text, onCite }: { text: string; onCite: (i: number) => void }) {
  const parts = text.split(/(\[Slide \d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[Slide (\d+)\]$/.exec(p);
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        const n = Number(m[1]);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCite(n - 1)}
            className="mx-0.5 inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
          >
            Slide {n}
          </button>
        );
      })}
    </>
  );
}

export function TutorPanel({ courseId, courseTitle, onCite, suggestions = [] }: TutorPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/tutor", body: { courseId } }),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    void sendMessage({ text: q });
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Chiedimi qualsiasi cosa su <span className="font-medium text-foreground">{courseTitle}</span>. Cito le slide: clicca per aprirle.
            </p>
            {suggestions.length > 0 && (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => ask(s)} className="w-full rounded-lg bg-muted px-3 py-2 text-left hover:bg-accent">
                      <Sparkles className="mr-2 inline size-3.5 text-primary" />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Bot className="size-3.5" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
              )}
            >
              {m.parts.map((p, i) =>
                p.type === "text" ? (
                  m.role === "assistant" ? <CitedText key={i} text={p.text} onCite={onCite} /> : <Fragment key={i}>{p.text}</Fragment>
                ) : null,
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Il tutor sta pensando…
          </div>
        )}
        {error && <p className="text-xs text-destructive">{/rate_limited|429/.test(error.message) ? "Hai raggiunto il limite di domande per oggi." : "Errore del tutor. Riprova."}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t pt-3"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Fai una domanda sul corso…" disabled={busy} />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Invia">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
