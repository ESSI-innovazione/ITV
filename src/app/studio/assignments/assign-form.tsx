"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Widget } from "@/components/app/widget";
import { assignCourse } from "@/lib/actions/assignments";

type Option = { id: string; label: string; hint?: string };

export function AssignForm({ courses, candidates }: { courses: Option[]; candidates: Option[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const all = () => setSelected(selected.length === candidates.length ? [] : candidates.map((c) => c.id));

  const submit = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("courseId", courseId);
      selected.forEach((id) => fd.append("candidateIds", id));
      fd.set("dueAt", dueAt);
      const r = await assignCourse(fd);
      setMsg(r.ok ? `Corso assegnato a ${r.count} candidat${r.count === 1 ? "o" : "i"}.` : r.error ?? "Errore");
      if (r.ok) setSelected([]);
    });

  return (
    <Widget title="Nuova assegnazione">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="course">Corso</Label>
            <select
              id="course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="due">Scadenza (opzionale)</Label>
            <Input id="due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={pending || !courseId || selected.length === 0}>
            <Send className="size-4" /> Assegna a {selected.length || "…"}
          </Button>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Candidati</Label>
            <Button variant="ghost" size="sm" onClick={all}>{selected.length === candidates.length ? "Nessuno" : "Tutti"}</Button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span className="flex-1">{c.label}</span>
                  {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Widget>
  );
}
