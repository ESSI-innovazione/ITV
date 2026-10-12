"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, Loader2, Search, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Widget } from "@/components/app/widget";
import { cn } from "@/lib/utils";
import { getJob, startGeneration, type JobView } from "@/lib/actions/generation";

const BANDS = [
  { id: "foundation", label: "Base", hint: "ADA 0–39 · 12–15 slide · quiz facile" },
  { id: "intermediate", label: "Intermedio", hint: "ADA 40–69 · 10–12 slide" },
  { id: "advanced", label: "Avanzato", hint: "ADA 70–100 · 8–10 slide · quiz impegnativo" },
] as const;

const STEPS: Array<{ key: JobView["status"][]; label: string; icon: typeof Search }> = [
  { key: ["queued", "outlining"], label: "Ricerca fonti e struttura", icon: Search },
  { key: ["writing"], label: "Scrittura slide e narrazione", icon: Sparkles },
  { key: ["quiz", "gamma"], label: "Quiz finale e deck Gamma", icon: Check },
  { key: ["done"], label: "Pronto per la revisione", icon: Check },
];

export function GenerateForm() {
  const params = useSearchParams();
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [bands, setBands] = useState<string[]>(["intermediate"]);
  const [durationMin, setDurationMin] = useState(30);
  const [useWebResearch, setUseWebResearch] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(true);
  const [issueCertificate, setIssueCertificate] = useState(true);
  const [generateGamma, setGenerateGamma] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [pending, start] = useTransition();

  // Poll the job every 2 s until it finishes.
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const tick = async () => {
      const j = await getJob(jobId);
      if (!active) return;
      setJob(j);
      if (j && j.status !== "done" && j.status !== "failed") setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      active = false;
    };
  }, [jobId]);

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await startGeneration({
        topic, brief: brief || undefined, sourceText: sourceText || undefined,
        language: "it", durationMin, bands, useWebResearch, generateQuiz, generateGamma, issueCertificate,
        type: params.get("type") ?? "slides",
      });
      if (!r.ok) return setError(r.error);
      setJob(null);
      setJobId(r.jobId);
    });

  const toggleBand = (id: string) => setBands((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  const running = !!jobId && job?.status !== "done" && job?.status !== "failed";
  const stepIndex = job ? STEPS.findIndex((s) => s.key.includes(job.status)) : -1;

  return (
    <div className="space-y-6">
      <Widget title="Cosa vuoi insegnare?">
        <div className="grid gap-5">
          <div className="space-y-2">
            <Label htmlFor="topic">Argomento *</Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="es. Sicurezza sul lavoro – rischio videoterminali (D.Lgs. 81/08)" disabled={running} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brief">Brief per l&apos;IA (opzionale)</Label>
            <Textarea id="brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Pubblico, taglio, cosa includere o evitare, esempi aziendali…" disabled={running} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Materiale sorgente (opzionale)</Label>
            <Textarea id="source" rows={5} value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Incolla il testo di una dispensa, una procedura, una norma… L'IA lo userà come fonte principale." className="font-mono text-xs" disabled={running} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Livelli ADA da generare</Label>
              <ul className="space-y-2">
                {BANDS.map((b) => (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted">
                      <Checkbox checked={bands.includes(b.id)} onCheckedChange={() => toggleBand(b.id)} disabled={running} />
                      <span>
                        <span className="block text-sm font-medium">{b.label}</span>
                        <span className="block text-xs text-muted-foreground">{b.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Durata target (min)</Label>
                <Input id="duration" type="number" min={10} max={120} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} disabled={running} />
              </div>
              <Toggle label="Ricerca fonti sul web (Tavily)" checked={useWebResearch} onChange={setUseWebResearch} disabled={running} />
              <Toggle label="Genera quiz finale" checked={generateQuiz} onChange={setGenerateQuiz} disabled={running} />
              <Toggle label="Rilascia certificato al superamento" checked={issueCertificate} onChange={setIssueCertificate} disabled={running} />
              <Toggle label="Genera deck Gamma (PPTX, usa crediti)" checked={generateGamma} onChange={setGenerateGamma} disabled={running} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button size="lg" onClick={submit} disabled={pending || running || topic.trim().length < 3 || bands.length === 0}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {running ? "Generazione in corso…" : "Genera corso"}
            </Button>
          </div>
        </div>
      </Widget>

      {jobId && (
        <Widget title="Avanzamento">
          <ol className="grid gap-3 md:grid-cols-4">
            {STEPS.map((s, i) => {
              const done = job?.status === "done" ? true : i < stepIndex;
              const active = i === stepIndex && job?.status !== "done";
              const failed = job?.status === "failed" && i === Math.max(stepIndex, 0);
              return (
                <li key={s.label} className={cn("flex items-center gap-3 rounded-lg border p-3 text-sm", active && "border-primary bg-accent", done && "border-green/40")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", done ? "bg-green text-white" : active ? "bg-primary text-white" : failed ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}>
                    {failed ? <XCircle className="size-4" /> : done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                  </span>
                  <span className={cn(!done && !active && "text-muted-foreground")}>{s.label}</span>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {job?.step && <span>{job.step}</span>}
            {job?.output?.sources?.length ? <span>· {job.output.sources.length} fonti</span> : null}
          </div>

          {job?.output?.sources?.length ? (
            <ul className="mt-3 space-y-1 text-xs">
              {job.output.sources.map((s) => (
                <li key={s.url} className="truncate">
                  <a href={s.url} target="_blank" rel="noopener" className="text-primary hover:underline">{s.title || s.url}</a>
                </li>
              ))}
            </ul>
          ) : null}

          {job?.status === "failed" && <p className="mt-4 text-sm text-destructive">Errore: {job.error}</p>}

          {job?.status === "done" && job.output?.courseIds?.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {job.output.courseIds.map((id, i) => (
                <Button key={id} render={<Link href={`/studio/courses/${id}`} />}>
                  <ExternalLink className="size-4" /> Rivedi corso {job.output!.courseIds!.length > 1 ? i + 1 : ""}
                </Button>
              ))}
            </div>
          ) : null}
        </Widget>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-center justify-between gap-3 text-sm", disabled && "opacity-60")}>
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}
