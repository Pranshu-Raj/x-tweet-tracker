// AI reply-draft generation (Phase 2 follow-on). SERVER-ONLY.
// Uses the configured AI backend to draft additive replies to a pasted tweet.
// No AI backend → source "off" (the offline framework scaffolds remain the fallback).

import { getBackend, chat } from "./adapter";

export interface ReplyDraftResult {
  drafts: string[];
  source: "ai" | "off" | "error";
}

const SYSTEM_PROMPT = `You write replies to tweets on X that earn attention and grow a following.
A strong reply is ADDITIVE — it contributes a specific example, a respectful counterpoint, an
extension of the idea, a sharp follow-up question, or a first-hand data point. Rules:
- Produce 3 reply options, each a ready-to-post reply UNDER 280 characters.
- Be conversational and specific. NO empty praise ("Great post!"), no hashtags, no emojis
  unless they genuinely add value. Do not restate the tweet — respond to it.
- Return ONLY a JSON array of 3 strings, nothing else.`;

export async function generateReplyDrafts(
  tweet: string,
  framework?: string
): Promise<ReplyDraftResult> {
  const t = tweet.trim();
  if (!t) return { drafts: [], source: "off" };
  if (!getBackend()) return { drafts: [], source: "off" };

  const user = framework
    ? `Tweet to reply to:\n"""${t}"""\n\nLean toward this angle: ${framework}.`
    : `Tweet to reply to:\n"""${t}"""`;

  try {
    const out = await chat(SYSTEM_PROMPT, user);
    const drafts = parseStrings(out);
    if (drafts.length > 0) return { drafts, source: "ai" };
    return { drafts: [], source: "error" };
  } catch {
    return { drafts: [], source: "error" };
  }
}

/** Extract a JSON array of strings from a model response (tolerant of stray prose/fences). */
function parseStrings(s: string): string[] {
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
  return arr
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 280))
    .slice(0, 5);
}
