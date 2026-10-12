import "server-only";

/**
 * Thin client for the Gamma Generate API (v1.0). docs/SPEC.md §6.3.
 * The key never leaves the server; export URLs are secrets (anyone with the link
 * can download for ~1 week), so they are proxied through /api/gamma/[id]/export.
 */
const BASE = "https://public-api.gamma.app/v1.0";

export type GammaStatus = {
  generationId: string;
  status: "pending" | "completed" | "failed";
  gammaId?: string;
  gammaUrl?: string;
  exportUrl?: string;
  credits?: { deducted?: number; remaining?: number };
  error?: { message?: string; statusCode?: number };
};

function headers() {
  const key = process.env.GAMMA_API_KEY;
  if (!key) throw new Error("GAMMA_API_KEY non configurata");
  return { "X-API-KEY": key, "Content-Type": "application/json" };
}

export const gammaConfigured = () => !!process.env.GAMMA_API_KEY;

type CreateDeckInput = {
  title: string;
  /** Markdown with `\n---\n` between cards. */
  markdown: string;
  numCards: number;
  language?: string;
  audience?: string;
  themeId?: string;
};

/** Starts a presentation generation that keeps our text verbatim (textMode: preserve). */
export async function createGammaDeck(input: CreateDeckInput): Promise<string> {
  const res = await fetch(`${BASE}/generations`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      inputText: input.markdown,
      title: input.title,
      textMode: "preserve",
      format: "presentation",
      cardSplit: "inputTextBreaks",
      numCards: input.numCards,
      exportAs: "pptx",
      textOptions: { language: input.language ?? "it", amount: "medium", audience: input.audience },
      imageOptions: { source: "aiGenerated" },
      cardOptions: { dimensions: "16x9" },
      sharingOptions: { workspaceAccess: "view", externalAccess: "view" },
      ...(input.themeId ? { themeId: input.themeId } : {}),
      additionalInstructions:
        "Mantieni esattamente i titoli e i punti forniti. Stile pulito e professionale da corso e-learning aziendale; un'immagine coerente per card.",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { generationId?: string; message?: string; error?: string };
  if (!res.ok || !json.generationId) {
    const why = res.status === 402 ? "crediti Gamma esauriti" : json.message ?? json.error ?? `HTTP ${res.status}`;
    throw new Error(`Gamma: ${why}`);
  }
  return json.generationId;
}

export async function getGammaGeneration(id: string): Promise<GammaStatus> {
  const res = await fetch(`${BASE}/generations/${id}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Gamma status HTTP ${res.status}`);
  return (await res.json()) as GammaStatus;
}

/** Polls every 5 s (as Gamma recommends) until completed/failed or the timeout. */
export async function waitForGamma(id: string, timeoutMs = 240_000): Promise<GammaStatus> {
  const start = Date.now();
  for (;;) {
    const s = await getGammaGeneration(id);
    if (s.status !== "pending") return s;
    if (Date.now() - start > timeoutMs) return { ...s, status: "failed", error: { message: "timeout" } };
    await new Promise((r) => setTimeout(r, 5000));
  }
}

/** Gamma's public embed form; needs externalAccess=view on the gamma. */
export const gammaEmbedUrl = (gammaId: string) => `https://gamma.app/embed/${gammaId}`;
