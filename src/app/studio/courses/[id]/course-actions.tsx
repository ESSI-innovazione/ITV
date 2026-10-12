"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Rocket, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { regenerateSlideAction, setCourseStatus } from "@/lib/actions/generation";
import { generateGammaAction } from "@/lib/actions/gamma";
import { Presentation } from "lucide-react";

export function GenerateGammaButton({ courseId, busy }: { courseId: string; busy: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        disabled={pending || busy}
        onClick={() => start(async () => { const r = await generateGammaAction(courseId); if (!r.ok) setError(r.error); })}
      >
        {pending || busy ? <Loader2 className="size-4 animate-spin" /> : <Presentation className="size-4" />}
        {busy ? "Gamma in corso…" : "Genera deck Gamma"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function CourseActions({ courseId, status }: { courseId: string; status: string }) {
  const [pending, start] = useTransition();
  const published = status === "published";
  return (
    <Button
      onClick={() => start(async () => { await setCourseStatus(courseId, published ? "draft" : "published"); })}
      disabled={pending}
      variant={published ? "outline" : "default"}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : published ? <Undo2 className="size-4" /> : <Rocket className="size-4" />}
      {published ? "Torna a bozza" : "Pubblica"}
    </Button>
  );
}

const SUGGESTIONS = ["Aggiungi un esempio pratico", "Semplifica il linguaggio", "Rendila più sintetica", "Aggiungi il riferimento normativo"];

export function RegenerateSlideButton({ courseId, slideId }: { courseId: string; slideId: string }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const r = await regenerateSlideAction(courseId, slideId, instruction);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setInstruction("");
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Rigenera slide" />}>
        <RefreshCw className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rigenera la diapositiva</DialogTitle>
          <DialogDescription>Di&apos; all&apos;IA cosa cambiare. Titolo, punti e narrazione vengono riscritti.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <Button key={s} variant="secondary" size="sm" onClick={() => setInstruction(s)}>{s}</Button>
          ))}
        </div>
        <Textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="es. Aggiungi un esempio pratico per un impiegato amministrativo" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={run} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {pending ? "Riscrittura…" : "Rigenera"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
