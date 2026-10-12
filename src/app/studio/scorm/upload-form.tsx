"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Widget } from "@/components/app/widget";
import { createClient } from "@/lib/supabase/client";
import { importScormPackage } from "@/lib/actions/scorm";

/** Uploads the zip straight to Supabase Storage (no 4.5 MB function limit), then registers it. */
export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "importing">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  const run = () => {
    if (!file) return;
    setMsg(null);
    setPhase("uploading");
    start(async () => {
      const supabase = createClient();
      const path = `uploads/${crypto.randomUUID()}.zip`;
      const { error } = await supabase.storage.from("scorm").upload(path, file, { contentType: "application/zip" });
      if (error) {
        setMsg(`Upload fallito: ${error.message}`);
        setPhase("idle");
        return;
      }
      setPhase("importing");
      const r = await importScormPackage(path, title);
      setPhase("idle");
      if (!r.ok) return setMsg(r.error);
      setMsg(`Importato "${r.title}" (SCORM ${r.version}, ${r.files} file).`);
      setFile(null);
      setTitle("");
      router.refresh();
    });
  };

  return (
    <Widget title="Importa pacchetto SCORM">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="zip">File .zip (SCORM 1.2 o 2004, es. export iSpring)</Label>
          <Input id="zip" type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Titolo (opzionale, altrimenti dal manifest)</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Button onClick={run} disabled={!file || phase !== "idle"}>
          {phase === "idle" ? <Upload className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
          {phase === "uploading" ? "Caricamento…" : phase === "importing" ? "Importazione…" : "Importa"}
        </Button>
      </div>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </Widget>
  );
}
