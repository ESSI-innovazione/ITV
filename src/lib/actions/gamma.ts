"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { generateGammaDeck } from "@/lib/ai/gamma-deck";
import { gammaConfigured } from "@/lib/gamma";
import { getCurrentUser, STAFF_ROLES } from "@/lib/auth";

/** Starts a Gamma deck for an existing course; runs after the response, page polls via revalidation. */
export async function generateGammaAction(courseId: string) {
  const user = await getCurrentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) return { ok: false as const, error: "Non autorizzato" };
  if (!gammaConfigured()) return { ok: false as const, error: "GAMMA_API_KEY non configurata" };

  after(async () => {
    await generateGammaDeck(courseId);
    revalidatePath(`/studio/courses/${courseId}`);
    revalidatePath(`/learn/courses/${courseId}`);
  });
  revalidatePath(`/studio/courses/${courseId}`);
  return { ok: true as const };
}
