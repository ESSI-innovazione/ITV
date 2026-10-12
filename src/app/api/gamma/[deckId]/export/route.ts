import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gamma/[deckId]/export — streams the PPTX. The Gamma export URL is a
 * bearer secret, so it is never sent to the browser; RLS decides who may download.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/gamma/[deckId]/export">) {
  const { deckId } = await ctx.params;
  const supabase = await createClient();
  const { data: deck } = await supabase
    .from("gamma_decks")
    .select("export_url, status, course:courses(title)")
    .eq("id", deckId)
    .maybeSingle();
  if (!deck || deck.status !== "done" || !deck.export_url) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const upstream = await fetch(deck.export_url);
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "export_expired" }, { status: 410 });

  const title = ((deck.course as unknown as { title: string } | null)?.title ?? "deck").replace(/[^\w\s-]/g, "").slice(0, 60);
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${title}.pptx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
