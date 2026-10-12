"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importCandidates, type ImportRow } from "@/lib/actions/candidates";

const SAMPLE = `name,email,ada_overall,dim_sicurezza,dim_informatica
Anna Ferri,anna.ferri@example.com,38,30,45
Luca Neri,luca.neri@example.com,62,58,70
Paola Galli,paola.galli@example.com,88,92,84`;

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = async (file: File | undefined) => {
    if (file) setCsv(await file.text());
  };

  const run = () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("csv", csv);
      const r = await importCandidates(fd);
      if (r.error) setError(r.error);
      setRows(r.rows);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows(null); setError(null); } }}>
      <DialogTrigger render={<Button />}>
        <Upload className="size-4" /> Importa CSV
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importa candidati</DialogTitle>
          <DialogDescription>
            Colonne: <code className="font-mono text-xs">name, email, ada_overall</code> e opzionali <code className="font-mono text-xs">dim_*</code> per le dimensioni ADA.
            Viene creato un accesso con password temporanea.
          </DialogDescription>
        </DialogHeader>

        {!rows ? (
          <div className="space-y-3">
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
            <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={SAMPLE} className="font-mono text-xs" />
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCsv(SAMPLE)}>Usa esempio</Button>
              <Button onClick={run} disabled={pending || !csv.trim()}>{pending ? "Importazione…" : "Importa"}</Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>ADA</TableHead>
                  <TableHead>Password temporanea</TableHead>
                  <TableHead>Esito</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">{r.email}</TableCell>
                    <TableCell>{r.adaOverall ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.password || "—"}</TableCell>
                    <TableCell className={r.status === "created" ? "text-green" : "text-destructive"}>
                      {r.status === "created" ? "Creato" : r.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Copia le password ora: non verranno mostrate di nuovo.</p>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Chiudi</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
