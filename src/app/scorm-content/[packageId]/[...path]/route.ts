import { NextResponse } from "next/server";
import { mimeFor } from "@/lib/actions/scorm";
import { createClient } from "@/lib/supabase/server";

/**
 * Serves files of an imported SCORM package from private storage, same-origin,
 * so the SCO can find window.API in its parent frame. Storage RLS: any signed-in user.
 */
export async function GET(_request: Request, ctx: RouteContext<"/scorm-content/[packageId]/[...path]">) {
  const { packageId, path } = await ctx.params;
  const rel = path.map(decodeURIComponent).join("/");
  if (rel.includes("..")) return NextResponse.json({ error: "bad_path" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("scorm").download(`packages/${packageId}/${rel}`);
  if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return new Response(data.stream(), {
    headers: {
      "Content-Type": await mimeFor(rel),
      "Cache-Control": "private, max-age=3600",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
