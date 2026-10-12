"use server";

import JSZip from "jszip";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, STAFF_ROLES } from "@/lib/auth";
import { parseManifest } from "@/lib/scorm/manifest";

const MIME: Record<string, string> = {
  html: "text/html", htm: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", json: "application/json",
  xml: "application/xml", xsd: "application/xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", webp: "image/webp", ico: "image/x-icon", mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm",
  ogg: "audio/ogg", wav: "audio/wav", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  pdf: "application/pdf", txt: "text/plain", map: "application/json", swf: "application/x-shockwave-flash",
};
export async function mimeFor(path: string) {
  return MIME[path.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/**
 * Registers a SCORM zip the browser already uploaded to storage `scorm/uploads/<name>.zip`:
 * unzips it into `scorm/packages/<packageId>/`, parses the manifest, creates the course.
 * Staff only (storage + table RLS). Returns the new course id.
 */
export async function importScormPackage(uploadPath: string, titleOverride?: string) {
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) return { ok: false as const, error: "Non autorizzato" };
  const supabase = await createClient();

  const { data: file, error: dErr } = await supabase.storage.from("scorm").download(uploadPath);
  if (dErr || !file) return { ok: false as const, error: `Upload non trovato: ${dErr?.message ?? uploadPath}` };

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    return { ok: false as const, error: "Il file non è uno zip valido" };
  }

  // Manifest may sit in a top-level folder inside the zip; strip that prefix for every file.
  const manifestEntry = Object.keys(zip.files).find((p) => /(^|\/)imsmanifest\.xml$/i.test(p));
  if (!manifestEntry) return { ok: false as const, error: "imsmanifest.xml non trovato nello zip" };
  const prefix = manifestEntry.slice(0, manifestEntry.length - "imsmanifest.xml".length);

  let manifest;
  try {
    manifest = parseManifest(await zip.file(manifestEntry)!.async("string"));
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Manifest non valido" };
  }

  const packageId = crypto.randomUUID();
  const entries = Object.entries(zip.files).filter(([p, f]) => !f.dir && p.startsWith(prefix));
  const queue = [...entries];
  const failures: string[] = [];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [p, f] = next;
      const rel = p.slice(prefix.length);
      const bytes = await f.async("uint8array");
      const { error } = await supabase.storage
        .from("scorm")
        .upload(`packages/${packageId}/${rel}`, bytes, { contentType: await mimeFor(rel), upsert: true });
      if (error) failures.push(`${rel}: ${error.message}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failures.length) return { ok: false as const, error: `Upload fallito per ${failures.length} file. ${failures[0]}` };

  const { data: course, error: cErr } = await supabase
    .from("courses")
    .insert({
      title: titleOverride?.trim() || manifest.title,
      description: `Pacchetto SCORM ${manifest.version} importato`,
      type: "scorm",
      status: "published",
      language: "it",
      issue_certificate: false,
      tags: ["scorm"],
      created_by: user.id,
    })
    .select("id")
    .single();
  if (cErr || !course) return { ok: false as const, error: cErr?.message ?? "Impossibile creare il corso" };

  const { error: pErr } = await supabase.from("scorm_packages").insert({
    id: packageId,
    course_id: course.id,
    version: manifest.version,
    entry_point: manifest.entryPoint,
    storage_prefix: `packages/${packageId}`,
    manifest: { title: manifest.title, masteryScore: manifest.masteryScore, files: entries.length },
  });
  if (pErr) return { ok: false as const, error: pErr.message };

  await supabase.storage.from("scorm").remove([uploadPath]);
  revalidatePath("/studio/scorm");
  revalidatePath("/studio/library");
  return { ok: true as const, courseId: course.id, packageId, title: manifest.title, version: manifest.version, files: entries.length };
}
