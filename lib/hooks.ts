// Hook Lab template engine (F1). Deterministic, offline. No Node/React deps.
// Phase 2 will swap generateVariants() for an AI adapter behind the same signature.
// See docs/FEATURES.md §F1 for the template catalog.

export interface Variant {
  template: string;
  text: string;
}

/** Collapse whitespace/newlines into a single clean line. */
function point(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** First sentence, trailing punctuation stripped — for punchy one-liners. */
function firstSentence(raw: string): string {
  const p = point(raw);
  const m = p.match(/^(.*?[.!?])(\s|$)/);
  return (m ? m[1] : p).replace(/[.!?]+$/, "");
}

/** Split a thought into list items on sentence/newline/semicolon/comma boundaries. */
function listItems(raw: string): string[] {
  return raw
    .split(/[\n.;]+|,\s+(?=\w)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

interface Generator {
  template: string;
  build: (raw: string) => string | null; // null => skip (not applicable)
}

const GENERATORS: Generator[] = [
  {
    template: "Unpopular opinion",
    build: (raw) => `Unpopular opinion:\n\n${point(raw)}`,
  },
  {
    template: "Nobody tells you",
    build: (raw) => `Nobody tells you this:\n\n${point(raw)}`,
  },
  {
    template: "Contrarian",
    build: (raw) => `Everyone believes the opposite.\n\nHere's the truth:\n\n${point(raw)}`,
  },
  {
    template: "Curiosity gap",
    build: (raw) => `I changed my mind about this recently.\n\nHere's what clicked:\n\n${point(raw)}`,
  },
  {
    template: "Question hook",
    build: (raw) => `${point(raw)}\n\nAgree or disagree?`,
  },
  {
    template: "Thread starter",
    build: (raw) => `${point(raw)}\n\nA short thread 🧵`,
  },
  {
    template: "Bold one-liner",
    build: (raw) => firstSentence(raw),
  },
  {
    template: "Listicle",
    build: (raw) => {
      const items = listItems(raw);
      if (items.length < 2) return null; // needs ≥2 points to be a list
      const body = items.map((it, i) => `${i + 1}. ${it}`).join("\n");
      return `${items.length} things worth knowing:\n\n${body}`;
    },
  },
];

/**
 * Turn a raw thought into structured tweet variants.
 * Returns ≥5 variants for any non-trivial input (Listicle is conditional).
 */
export function generateVariants(raw: string): Variant[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return GENERATORS.map((g) => {
    const text = g.build(trimmed);
    return text ? { template: g.template, text } : null;
  }).filter((v): v is Variant => v !== null);
}
