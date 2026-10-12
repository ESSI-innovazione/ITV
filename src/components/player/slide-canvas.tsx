import { Check, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerSlide } from "@/lib/learner";

type SlideCanvasProps = {
  slide: PlayerSlide;
  /** Compact rendering for thumbnails. */
  thumbnail?: boolean;
  className?: string;
};

/**
 * Renders one slide at 16:9 from its JSON (layout, title, bullets, image).
 * Pure and server-safe; the same component draws the main stage and thumbnails.
 */
export function SlideCanvas({ slide, thumbnail = false, className }: SlideCanvasProps) {
  const t = thumbnail;
  const base = cn(
    "relative aspect-video w-full overflow-hidden rounded-lg select-none",
    t ? "text-[6px] leading-tight" : "text-sm sm:text-base lg:text-lg",
    className,
  );

  switch (slide.layout) {
    case "title":
      return (
        <div className={cn(base, "bg-gradient-to-br from-navy via-violet-dark to-violet text-white")}>
          <div className={cn("flex h-full flex-col justify-end", t ? "p-2" : "p-8 lg:p-12")}>
            <h2 className={cn("font-bold", t ? "text-[10px]" : "text-2xl sm:text-4xl lg:text-5xl")}>{slide.title}</h2>
            {slide.bullets.length > 0 && (
              <p className={cn("text-white/80", t ? "mt-1" : "mt-4 text-base lg:text-xl")}>{slide.bullets.join(" · ")}</p>
            )}
          </div>
          <span className={cn("absolute rounded-full bg-pink/80", t ? "-top-2 -right-2 size-8" : "-top-16 -right-16 size-64")} />
        </div>
      );

    case "quote":
      return (
        <div className={cn(base, "bg-card")}>
          <div className={cn("flex h-full flex-col items-center justify-center text-center", t ? "p-2" : "p-8 lg:p-16")}>
            <Quote className={cn("text-pink", t ? "size-3" : "size-10")} />
            <p className={cn("font-medium", t ? "mt-1" : "mt-6 text-xl sm:text-2xl lg:text-3xl")}>{slide.title}</p>
            {slide.bullets[0] && <p className={cn("text-muted-foreground", t ? "mt-1" : "mt-4")}>— {slide.bullets[0]}</p>}
          </div>
        </div>
      );

    case "summary":
      return (
        <div className={cn(base, "bg-secondary")}>
          <div className={cn("flex h-full flex-col", t ? "p-2" : "p-8 lg:p-12")}>
            <SlideTitle title={slide.title} t={t} />
            <ul className={cn("flex-1 space-y-2", t ? "mt-1" : "mt-6 space-y-3")}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={cn("mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-green text-white", t ? "size-2" : "size-6")}>
                    <Check className={t ? "size-1.5" : "size-4"} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );

    case "image-left":
      return (
        <div className={cn(base, "grid grid-cols-5 bg-card")}>
          <div className="col-span-2 bg-gradient-to-br from-cyan/40 to-violet/40">
            {slide.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className={cn("col-span-3 flex flex-col", t ? "p-2" : "p-6 lg:p-10")}>
            <SlideTitle title={slide.title} t={t} />
            <Bullets bullets={slide.bullets} t={t} />
          </div>
        </div>
      );

    case "two-column": {
      const half = Math.ceil(slide.bullets.length / 2);
      return (
        <div className={cn(base, "bg-card")}>
          <div className={cn("flex h-full flex-col", t ? "p-2" : "p-8 lg:p-12")}>
            <SlideTitle title={slide.title} t={t} />
            <div className={cn("grid flex-1 grid-cols-2", t ? "gap-1 mt-1" : "gap-8 mt-6")}>
              <Bullets bullets={slide.bullets.slice(0, half)} t={t} />
              <Bullets bullets={slide.bullets.slice(half)} t={t} />
            </div>
          </div>
        </div>
      );
    }

    case "bullets":
    default:
      return (
        <div className={cn(base, "bg-card")}>
          <div className={cn("flex h-full flex-col", t ? "p-2" : "p-8 lg:p-12")}>
            <SlideTitle title={slide.title} t={t} />
            <Bullets bullets={slide.bullets} t={t} className={t ? "mt-1" : "mt-6"} />
          </div>
        </div>
      );
  }
}

function SlideTitle({ title, t }: { title: string; t: boolean }) {
  return (
    <div>
      <h2 className={cn("font-semibold", t ? "text-[8px]" : "text-xl sm:text-2xl lg:text-3xl")}>{title}</h2>
      <span className={cn("block rounded-full bg-primary", t ? "mt-0.5 h-0.5 w-4" : "mt-3 h-1 w-14")} />
    </div>
  );
}

function Bullets({ bullets, t, className }: { bullets: string[]; t: boolean; className?: string }) {
  return (
    <ul className={cn("space-y-1", !t && "space-y-3", className)}>
      {bullets.map((b, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className={cn("mt-[0.55em] shrink-0 rounded-full bg-primary", t ? "size-1" : "size-2")} />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}
