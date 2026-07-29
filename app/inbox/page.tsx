"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Idea } from "@/lib/types";
import { getJson, postJson, del } from "../components/http";

// Key the Hook Lab reads on mount to prefill a captured idea (native sessionStorage).
const IDEA_SEED_KEY = "cockpit:idea";

export default function InboxPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const { ideas } = await getJson<{ ideas: Idea[] }>("/api/ideas");
      setIdeas(ideas);
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!text.trim()) return;
    try {
      await postJson("/api/ideas", { body: text });
      setText("");
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  function craft(idea: Idea) {
    sessionStorage.setItem(IDEA_SEED_KEY, idea.body);
    router.push("/compose");
  }

  async function remove(idea: Idea) {
    await del(`/api/ideas/${idea.id}`);
    load();
  }

  return (
    <div>
      <h1 className="page-title">Idea Inbox</h1>
      <p className="page-sub">
        Capture raw thoughts, links, and observations the moment they hit — so you never
        face a blank page. Turn any one into tweets in the Hook Lab.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      <div className="card stack">
        <textarea
          className="textarea"
          placeholder="A half-formed thought, a link, a lesson from today…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
        />
        <div className="row spread">
          <span className="muted xs">⌘/Ctrl + Enter to capture</span>
          <button className="btn btn-accent" onClick={add} disabled={!text.trim()}>
            Capture
          </button>
        </div>
      </div>

      <h2 className="section-title">
        Captured <span className="muted small">· {ideas.length}</span>
      </h2>
      {ideas.length === 0 ? (
        <div className="empty">Empty. Dump ideas here throughout the day — future you will thank you.</div>
      ) : (
        <div className="stack">
          {ideas.map((idea) => (
            <div className="card stack" key={idea.id}>
              <p className="mono" style={{ whiteSpace: "pre-wrap" }}>
                {idea.body}
              </p>
              <div className="row">
                <button className="btn btn-accent" onClick={() => craft(idea)}>
                  Craft in Hook Lab →
                </button>
                <button className="btn btn-danger btn-ghost" onClick={() => remove(idea)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
