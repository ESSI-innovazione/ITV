"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Widget } from "@/components/app/widget";

type ScormPlayerProps = {
  packageId: string;
  version: "1.2" | "2004";
  entryPoint: string;
  title: string;
  learner: { id: string; name: string };
  /** Previously committed CMI to resume from. */
  initialCmi: Record<string, unknown> | null;
};

/**
 * Hosts an imported SCO in an iframe and exposes the SCORM runtime (scorm-again)
 * on window.API / window.API_1484_11. Commits go to /api/scorm/commit.
 */
export function ScormPlayer({ packageId, version, entryPoint, title, learner, initialCmi }: ScormPlayerProps) {
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = {
        autocommit: true,
        autocommitSeconds: 10,
        lmsCommitUrl: `/api/scorm/commit?packageId=${packageId}`,
        dataCommitFormat: "json" as const,
        logLevel: 4,
      };
      const w = window as unknown as { API?: unknown; API_1484_11?: unknown };
      if (version === "2004") {
        const { Scorm2004API } = await import("scorm-again/scorm2004");
        const api = new Scorm2004API(settings);
        api.loadFromJSON({ learner_id: learner.id, learner_name: learner.name, ...(initialCmi ?? {}) });
        w.API_1484_11 = api;
      } else {
        const { Scorm12API } = await import("scorm-again/scorm12");
        const api = new Scorm12API(settings);
        api.loadFromJSON({ core: { student_id: learner.id, student_name: learner.name }, ...(initialCmi ?? {}) });
        w.API = api;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      const w = window as unknown as { API?: unknown; API_1484_11?: unknown };
      delete w.API;
      delete w.API_1484_11;
    };
  }, [packageId, version, learner.id, learner.name, initialCmi]);

  const fullscreen = () => frameRef.current?.requestFullscreen?.();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Pacchetto SCORM {version}</p>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fullscreen}>
          <Maximize2 className="size-4" /> Schermo intero
        </Button>
      </div>
      {ready ? (
        <div className="widget overflow-hidden">
          <iframe
            ref={frameRef}
            src={`/scorm-content/${packageId}/${entryPoint}`}
            title={title}
            className="aspect-video w-full bg-white"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
        <Widget className="flex aspect-video items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Avvio del runtime SCORM…
        </Widget>
      )}
      <p className="text-xs text-muted-foreground">Avanzamento e punteggio vengono salvati automaticamente dal pacchetto.</p>
    </div>
  );
}
