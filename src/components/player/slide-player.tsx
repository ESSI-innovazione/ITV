"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Presentation,
  ScrollText,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Widget } from "@/components/app/widget";
import { SlideCanvas } from "@/components/player/slide-canvas";
import { useNarration } from "@/components/player/use-narration";
import { recordSlideView } from "@/lib/actions/progress";
import { cn } from "@/lib/utils";
import type { PlayerCourse } from "@/lib/learner";

type SlidePlayerProps = {
  course: PlayerCourse;
  initialIndex: number;
  initialViewed: string[];
  serverTts: boolean;
};

/** Text the narrator reads for a slide: speaker notes, or the visible content as a fallback. */
function narrationText(slide: PlayerCourse["slides"][number]) {
  return slide.speakerNotes?.trim() || [slide.title, ...slide.bullets].join(". ");
}

export function SlidePlayer({ course, initialIndex, initialViewed, serverTts }: SlidePlayerProps) {
  const slides = course.slides;
  const totalItems = slides.length + (course.quiz ? 1 : 0);
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(slides.length - 1, 0)));
  const [viewed, setViewed] = useState<Set<string>>(() => new Set(initialViewed));
  const [playing, setPlaying] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<"slides" | "gamma">("slides");
  const [, startTransition] = useTransition();
  const stageRef = useRef<HTMLDivElement>(null);
  const narration = useNarration({ serverTts });

  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const percent = Math.round((viewed.size / Math.max(1, totalItems)) * 100);

  // Persist the view + resume position whenever the slide changes.
  useEffect(() => {
    if (!slide) return;
    setViewed((v) => (v.has(slide.id) ? v : new Set(v).add(slide.id)));
    startTransition(() => {
      void recordSlideView({ courseId: course.id, slideId: slide.id, index, totalItems });
    });
  }, [slide, index, course.id, totalItems]);

  const goTo = useCallback(
    (i: number) => {
      narration.stop();
      setIndex(Math.min(Math.max(i, 0), slides.length - 1));
    },
    [narration, slides.length],
  );

  // "Video" mode: narrate the current slide, then advance. Stops on the last slide.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (!playing || !slide) return;
    let active = true;
    (async () => {
      await narration.speak(narrationText(slide));
      if (!active || !playingRef.current) return;
      await new Promise((r) => setTimeout(r, 700));
      if (!active || !playingRef.current) return;
      if (index < slides.length - 1) setIndex(index + 1);
      else setPlaying(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index]);

  const togglePlay = useCallback(() => {
    if (playing) {
      narration.stop();
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  }, [playing, narration]);

  // Keyboard: ← → navigate, space play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "ArrowLeft") goTo(index - 1);
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo, togglePlay]);

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().then(() => setFullscreen(true));
    } else {
      void document.exitFullscreen?.().then(() => setFullscreen(false));
    }
  };

  if (!slide) {
    return <Widget className="p-10 text-center text-muted-foreground">Questo corso non ha ancora diapositive.</Widget>;
  }

  const gamma = course.gamma;

  if (view === "gamma" && gamma) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="truncate text-lg font-semibold">{course.title}</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setView("slides")}>
              <LayoutGrid className="size-4" /> Slide narrate
            </Button>
            {gamma.hasExport && (
              <Button size="sm" render={<a href={`/api/gamma/${gamma.deckId}/export`} />}>
                <Download className="size-4" /> Scarica PPTX
              </Button>
            )}
            {gamma.gammaUrl && (
              <Button variant="ghost" size="sm" render={<a href={gamma.gammaUrl} target="_blank" rel="noopener" />}>
                <ExternalLink className="size-4" /> Apri in Gamma
              </Button>
            )}
          </div>
        </div>
        {gamma.gammaId ? (
          <div className="widget overflow-hidden">
            <iframe
              src={`https://gamma.app/embed/${gamma.gammaId}`}
              title={`Deck Gamma – ${course.title}`}
              className="aspect-video w-full"
              allow="fullscreen"
              allowFullScreen
            />
          </div>
        ) : (
          <Widget className="p-10 text-center text-muted-foreground">Il deck è pronto: aprilo in Gamma con il pulsante qui sopra.</Widget>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[160px_1fr]">
      {/* Thumbnails */}
      <aside className="hidden lg:block">
        <ol className="sticky top-6 max-h-[calc(100vh-6rem)] space-y-2 overflow-y-auto pr-1">
          {slides.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "w-full rounded-lg p-1 text-left outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-ring",
                  i === index ? "ring-2 ring-primary" : "hover:bg-muted",
                )}
              >
                <SlideCanvas slide={s} thumbnail />
                <span className="mt-1 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                  <span>{i + 1}</span>
                  {viewed.has(s.id) && <span className="size-1.5 rounded-full bg-green" />}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* Stage */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{slide.moduleTitle}</p>
            <h2 className="truncate text-lg font-semibold">{course.title}</h2>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Slide {index + 1} di {slides.length}
            </span>
            <Progress value={percent} className="h-1.5 w-32" />
            <span className="w-9 text-right">{percent}%</span>
          </div>
        </div>

        <div ref={stageRef} className={cn("rounded-lg bg-navy/5", fullscreen && "flex items-center justify-center bg-black p-6")}>
          <div className={cn("w-full", fullscreen && "max-h-full max-w-[177vh]")}>
            <SlideCanvas slide={slide} className="shadow-widget" />
          </div>
        </div>

        {/* Controls */}
        <Widget className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Precedente">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="lg" onClick={togglePlay} disabled={!narration.supported} className="min-w-36">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {playing ? "Pausa" : "Riproduci"}
            </Button>
            <Button variant="outline" size="icon" onClick={() => goTo(index + 1)} disabled={isLast} aria-label="Successiva">
              <ChevronRight className="size-4" />
            </Button>

            <span className={cn("ml-2 flex items-center gap-1.5 text-xs text-muted-foreground", narration.speaking && "text-primary")}>
              <Volume2 className={cn("size-4", narration.speaking && "animate-pulse")} />
              {narration.mode === "server" ? "Voce HD" : "Voce del browser"}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {gamma && (
                <Button variant="outline" size="sm" onClick={() => { narration.stop(); setPlaying(false); setView("gamma"); }}>
                  <Presentation className="size-4" /> Deck Gamma
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-md border px-2.5 py-1.5 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                  {narration.rate}×
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Velocità</DropdownMenuLabel>
                  {[0.8, 1, 1.2, 1.5].map((r) => (
                    <DropdownMenuItem key={r} onClick={() => narration.setRate(r)}>
                      {r}×{r === narration.rate && " ✓"}
                    </DropdownMenuItem>
                  ))}
                  {narration.mode === "browser" && narration.voices.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Voce</DropdownMenuLabel>
                      {narration.voices.slice(0, 8).map((v) => (
                        <DropdownMenuItem key={v.name} onClick={() => narration.setVoiceName(v.name)}>
                          {v.name.replace(/Microsoft |Google /, "")}
                          {v.name === narration.voiceName && " ✓"}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={() => setShowNotes((s) => !s)} aria-label="Trascrizione" aria-pressed={showNotes}>
                <ScrollText className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label="Schermo intero">
                {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </div>
          </div>
        </Widget>

        {showNotes && (
          <Widget title="Trascrizione">
            <p className={cn("text-sm leading-relaxed", narration.speaking && "text-foreground")}>{narrationText(slide)}</p>
          </Widget>
        )}

        {isLast && (
          <Widget className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-green/15 text-green">
                <ClipboardCheck className="size-6" />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold">Hai visto tutte le diapositive</h3>
                <p className="text-sm text-muted-foreground">
                  {course.quiz ? "Supera il quiz finale per completare il corso e ottenere il certificato." : "Il corso è completato."}
                </p>
              </div>
              {course.quiz && (
                <Button render={<Link href={`/learn/quizzes/${course.quiz.id}`} />}>Vai al quiz</Button>
              )}
            </div>
          </Widget>
        )}
      </div>
    </div>
  );
}
