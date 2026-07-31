// AI profile review (Phase: Coach). SERVER-ONLY.
// Turns a scraped profile + the failed objective checks into concrete, grounded
// suggestions (rewrite the bio, what to pin, etc.). Falls back to deterministic
// template suggestions when no AI backend is configured. Honest: coaching, never
// a "this will go viral" promise.

import { getBackend, chat } from "./adapter";
import type { Profile } from "../types";
import type { ProfileCheck } from "../profile";

export interface ProfileReview {
  suggestions: string[];
  source: "ai" | "templates";
}

const SYSTEM_PROMPT = `You are a founder's X (Twitter) growth coach reviewing their profile.
Give specific, actionable suggestions to improve the profile for engagement and follows.
Rules:
- Ground every suggestion in the profile shown — quote or rewrite their actual text.
- If the bio is weak or empty, WRITE a concrete replacement bio (<=160 chars) for them.
- Be concrete: "pin X", "add a link to Y", "rewrite bio to: …". No vague advice.
- Do NOT promise virality or specific numbers. Coach the controllable structure.
- Return ONLY a JSON array of 3-5 short suggestion strings, nothing else.`;

export async function reviewProfile(
  p: Profile,
  failed: ProfileCheck[]
): Promise<ProfileReview> {
  if (!getBackend()) return { suggestions: templateSuggestions(failed), source: "templates" };

  const user = [
    "My X profile:",
    `- Display name: ${p.name ?? "(none)"}`,
    `- Handle: @${(p.handle ?? "").replace(/^@+/, "")}`,
    `- Bio: ${p.bio?.trim() ? `"${p.bio.trim()}"` : "(empty)"}`,
    `- Link: ${p.url?.trim() || "(none)"}`,
    `- Pinned tweet: ${p.pinned_tweet?.trim() ? `"${p.pinned_tweet.trim()}"` : "(none)"}`,
    `- Following/Followers: ${p.following ?? "?"} / ${p.followers ?? "?"}`,
    "",
    failed.length
      ? `Weak spots the checklist flagged: ${failed.map((c) => c.label).join("; ")}.`
      : "The checklist passed — suggest higher-level polish.",
  ].join("\n");

  try {
    const out = await chat(SYSTEM_PROMPT, user);
    const suggestions = parseStrings(out);
    if (suggestions.length > 0) return { suggestions, source: "ai" };
    return { suggestions: templateSuggestions(failed), source: "templates" };
  } catch {
    return { suggestions: templateSuggestions(failed), source: "templates" };
  }
}

/** Deterministic fallback — turn each failed check's hint into a suggestion. */
function templateSuggestions(failed: ProfileCheck[]): string[] {
  if (failed.length === 0) {
    return ["Your profile passes the basics — now A/B test your bio's first line and refresh your pinned tweet monthly."];
  }
  return failed.map((c) => c.hint).slice(0, 5);
}

/** Extract a JSON array of strings from a model response (tolerant of fences/prose). */
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
