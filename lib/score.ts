// Virality-STRUCTURE scorer (F1). Grades the structure the author controls —
// it does NOT predict outcomes (see docs/PRD.md §5). Pure, offline, deterministic.

export interface ScoreCheck {
  label: string;
  pass: boolean;
  weight: number;
  hint: string;
}

export interface ScoreResult {
  score: number; // 0–100
  length: number;
  checks: ScoreCheck[];
}

const TWEET_LIMIT = 280;
const HOOK_RE =
  /^(unpopular opinion|nobody|everyone|here'?s|why|how|the truth|stop|most people|i |\d+\s+(things|ways|lessons|reasons))/i;
const CTA_RE =
  /(reply|repl(y|ies)|follow|retweet|\brt\b|thread|🧵|comment|save this|here'?s how|bookmark)/i;
const LINK_RE = /https?:\/\//i;

export function scoreTweet(text: string): ScoreResult {
  const t = text ?? "";
  const length = t.length;
  const firstLine = t.split("\n")[0] ?? "";
  const hashtagCount = (t.match(/#/g) ?? []).length;
  const trimmedEnd = t.trimEnd();

  const checks: ScoreCheck[] = [
    {
      label: "Length in the sweet spot",
      weight: 20,
      pass: length >= 60 && length <= 275,
      hint:
        length < 60
          ? "Too short — add substance or a second beat unless it's a deliberate one-liner."
          : "Near the 280 limit — trim so it reads fast.",
    },
    {
      label: "Strong hook / first line",
      weight: 20,
      pass:
        firstLine.length > 0 &&
        firstLine.length <= 120 &&
        (HOOK_RE.test(firstLine.trim()) ||
          firstLine.trim().endsWith(":") ||
          firstLine.includes("?")),
      hint: "Open with a hook — a bold claim, a question, or 'Here's…'. Keep the first line short.",
    },
    {
      label: "Contains a specific (number or name)",
      weight: 15,
      pass: /\d/.test(t) || /(?:^|\s)[A-Z][a-z]{2,}/.test(t),
      hint: "Add a concrete number or name — specifics beat vague claims.",
    },
    {
      label: "Ends with a question, CTA, or open loop",
      weight: 15,
      pass: trimmedEnd.endsWith("?") || trimmedEnd.endsWith(":") || CTA_RE.test(t),
      hint: "End with a question or call-to-action to invite replies.",
    },
    {
      label: "Uses line breaks for readability",
      weight: 10,
      pass: t.includes("\n"),
      hint: "Break it up — walls of text get scrolled past. Add a line break.",
    },
    {
      label: "No link in the first line",
      weight: 10,
      pass: !LINK_RE.test(firstLine),
      hint: "Move links out of the hook line — links up top suppress reach.",
    },
    {
      label: "Not hashtag-stuffed (0–1)",
      weight: 10,
      pass: hashtagCount <= 1,
      hint: "Cut hashtags to 0–1 — stuffing reads as spam and hurts reach.",
    },
  ];

  const score = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
  return { score, length, checks };
}
