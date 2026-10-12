import "server-only";
import { tavily } from "@tavily/core";

export type Source = { title: string; url: string; content: string };

/**
 * Web research for grounding a course (docs/SPEC.md §6.5). Returns [] when
 * Tavily is not configured or fails, so generation still works from the brief alone.
 */
export async function researchTopic(query: string, maxResults = 5): Promise<Source[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const client = tavily({ apiKey });
    const res = await client.search(query, {
      maxResults,
      searchDepth: "advanced",
      includeRawContent: "markdown",
    });
    return res.results.map((r) => ({
      title: r.title,
      url: r.url,
      content: (r.rawContent ?? r.content ?? "").replace(/\s+/g, " ").slice(0, 3500),
    }));
  } catch (e) {
    console.warn("[research] tavily failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
