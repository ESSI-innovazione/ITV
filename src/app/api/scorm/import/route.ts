import { NextResponse, type NextRequest } from "next/server";
import { importScormPackage } from "@/lib/actions/scorm";
import { requireStaffApi } from "@/lib/api-auth";

export const maxDuration = 300;

/**
 * POST /api/scorm/import — body { uploadPath, title? } where uploadPath is a zip
 * already uploaded to storage bucket `scorm` (e.g. uploads/<uuid>.zip). docs/SPEC.md §8.2.
 */
export async function POST(request: NextRequest) {
  const denied = await requireStaffApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { uploadPath?: string; title?: string } | null;
  if (!body?.uploadPath) return NextResponse.json({ error: "uploadPath required" }, { status: 400 });

  const r = await importScormPackage(body.uploadPath, body.title);
  return NextResponse.json(r, { status: r.ok ? 201 : 400 });
}
