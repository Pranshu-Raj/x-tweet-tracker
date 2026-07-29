// AI-or-template variant generation (Phase 2). SERVER-ONLY.
// Uses the configured AI backend if present; otherwise (or on any failure) falls
// back to the deterministic offline templates from lib/hooks.ts. The Hook Lab UI
// never changes — it just gets better variants when a backend is wired.

import { generateVariants, type Variant } from "../hooks";
import { getBackend, chat } from "./adapter";

export interface VariantResult {
  variants: Variant[];
  source: "ai" | "templates";
}

const SYSTEM_PROMPT = `You are a tweet hook specialist helping a founder grow on X.
Given a raw thought, produce 6 distinct, high-quality tweet variants — each using a
DIFFERENT proven hook style (e.g. unpopular opinion, contrarian, listicle, question
hook, curiosity gap, bold one-liner). Rules:
- Each variant must be a ready-to-post tweet under 280 characters.
- Keep the author's meaning; sharpen the hook. No hashtags, no emojis unless they add value.
- Return ONLY a JSON array, no prose, no markdown fences:
  [{"template":"<hook style name>","text":"<the tweet>"}]`;

export async function generateVariantsSmart(raw: string): Promise<VariantResult> {
  const text = raw.trim();
  if (!text) return { variants: [], source: "templates" };

  if (!getBackend()) return { variants: generateVariants(text), source: "templates" };

  try {
    const out = await chat(SYSTEM_PROMPT, text);
    const variants = parseVariants(out);
    // Only trust the AI path if it produced a usable set; else fall back.
    if (variants.length >= 3) return { variants, source: "ai" };
  } catch {
    // fall through to templates
  }
  return { variants: generateVariants(text), source: "templates" };
}

function isVariant(v: unknown): v is { template: string; text: string } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.template === "string" &&
    typeof o.text === "string" &&
    o.text.trim().length > 0
  );
}

/** Extract the JSON array from a model response (tolerant of stray prose/fences). */
function parseVariants(s: string): Variant[] {
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(s.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter(isVariant).map((v) => ({
    template: v.template,
    text: v.text.trim().slice(0, 280),
  }));
}
