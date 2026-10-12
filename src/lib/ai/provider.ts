import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";

/**
 * LLM access for the generation pipeline. Provider is chosen by LLM_PROVIDER
 * (only "google" is wired for the demo); models by LLM_MODEL_MAIN / _FAST with
 * LLM_MODEL_FALLBACK tried when the primary keeps failing.
 *
 * Free-tier Gemini is rate-limited per minute, so calls go through a small
 * semaphore (LLM_CONCURRENCY) and quota errors wait and retry before falling back.
 */
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

export type Usage = { model: string; inputTokens: number; outputTokens: number };

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 90_000);
const CONCURRENCY = Math.max(1, Number(process.env.LLM_CONCURRENCY ?? 2));
const QUOTA_RETRIES = 3;
const QUOTA_WAIT_MS = Number(process.env.LLM_QUOTA_WAIT_MS ?? 20_000);

function modelIds(kind: "main" | "fast") {
  const primary = (kind === "main" ? process.env.LLM_MODEL_MAIN : process.env.LLM_MODEL_FAST) ?? "gemini-2.5-flash";
  // Comma-separated chain, tried in order after the primary.
  const fallbacks = (process.env.LLM_MODEL_FALLBACK ?? "gemini-2.5-flash-lite").split(",").map((s) => s.trim()).filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

// --- tiny semaphore shared by all calls in this process ---
let active = 0;
const queue: Array<() => void> = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= CONCURRENCY) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

/** Quota (429) and overload (503 / "high demand") are both worth waiting for. */
const isTransient = (e: unknown) =>
  /quota|rate.?limit|429|RESOURCE_EXHAUSTED|high demand|overloaded|UNAVAILABLE|503|temporar/i.test(e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `call` for each candidate model: transient errors wait+retry, other errors fall through to the next model. */
async function withModels<T>(kind: "main" | "fast", call: (modelId: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const id of modelIds(kind)) {
    for (let attempt = 1; attempt <= QUOTA_RETRIES; attempt++) {
      try {
        return await withSlot(() => call(id));
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (isTransient(e) && attempt < QUOTA_RETRIES) {
          console.warn(`[ai] ${id} transient error (attempt ${attempt}), waiting ${QUOTA_WAIT_MS * attempt}ms: ${msg.slice(0, 80)}`);
          await sleep(QUOTA_WAIT_MS * attempt);
          continue;
        }
        console.warn(`[ai] ${id} failed: ${msg.slice(0, 200)}`);
        break; // next model
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM generation failed");
}

type StructuredOptions<T> = {
  kind: "main" | "fast";
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature?: number;
  onUsage?: (u: Usage) => void;
};

/** Structured generation validated against a Zod schema, with limiter, quota backoff and model fallback. */
export async function generateStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  return withModels(opts.kind, async (id) => {
    const result = await generateText({
      model: google(id),
      output: Output.object({ schema: opts.schema }),
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature ?? 0.4,
      maxRetries: 0, // retries are handled in withModels with quota-aware waits
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    opts.onUsage?.({ model: id, inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 });
    return result.output as T;
  });
}

/** Plain text generation (tutor, rewrites). */
export async function generatePlain(opts: { kind: "main" | "fast"; system: string; prompt: string; onUsage?: (u: Usage) => void }) {
  return withModels(opts.kind, async (id) => {
    const result = await generateText({
      model: google(id),
      system: opts.system,
      prompt: opts.prompt,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    opts.onUsage?.({ model: id, inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 });
    return result.text;
  });
}
