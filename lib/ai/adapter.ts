// AI adapter (Phase 2). SERVER-ONLY — never import into a client component.
// Pluggable backend selected by env; pure fetch, no SDK dependency.
//   ANTHROPIC_API_KEY set → Anthropic API
//   OLLAMA_MODEL set      → local Ollama
//   neither               → null (callers fall back to offline templates)

export type Backend = "groq" | "anthropic" | "ollama" | null;

export function getBackend(): Backend {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OLLAMA_MODEL) return "ollama";
  return null;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";
const DEFAULT_OLLAMA_URL = "http://localhost:11434/api/chat";

/** Single chat call → assistant text. Throws if no backend or the call fails. */
export async function chat(system: string, user: string): Promise<string> {
  const backend = getBackend();
  if (backend === "groq") return groqChat(system, user);
  if (backend === "anthropic") return anthropicChat(system, user);
  if (backend === "ollama") return ollamaChat(system, user);
  throw new Error("no AI backend configured");
}

async function groqChat(system: string, user: string): Promise<string> {
  // Groq exposes an OpenAI-compatible chat-completions API.
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.GROQ_API_KEY as string}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.8,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function anthropicChat(system: string, user: string): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
}

async function ollamaChat(system: string, user: string): Promise<string> {
  const url = process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}
