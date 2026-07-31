"use client";

import { useEffect, useState } from "react";
import type { Target, ReplyLogEntry } from "@/lib/types";
import { REPLY_FRAMEWORKS } from "@/lib/replyFrameworks";
import { getJson, postJson, patchJson, del } from "../components/http";
import { isToday } from "@/lib/dates";

const GOAL_KEY = "cockpit:replyGoal";
const DEFAULT_GOAL = 10;

export default function RepliesPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [replies, setReplies] = useState<ReplyLogEntry[]>([]);
  const [ratio, setRatio] = useState<number | null>(null);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [logHandle, setLogHandle] = useState("");
  const [logNote, setLogNote] = useState("");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [tweet, setTweet] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [aiCopied, setAiCopied] = useState<number | null>(null);

  async function load() {
    try {
      const [t, r, s] = await Promise.all([
        getJson<{ targets: Target[] }>("/api/targets"),
        getJson<{ replies: ReplyLogEntry[] }>("/api/replies"),
        getJson<{ ratio: number | null }>("/api/streak"),
      ]);
      setTargets(t.targets);
      setReplies(r.replies);
      setRatio(s.ratio);
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  useEffect(() => {
    load();
    const saved = localStorage.getItem(GOAL_KEY);
    if (saved) setGoal(Number(saved) || DEFAULT_GOAL);
  }, []);

  // Pick up a tweet grabbed by the extension's "Reply →" button (one-shot handoff).
  useEffect(() => {
    (async () => {
      try {
        const { capture } = await getJson<{
          capture: { tweet: string; handle: string | null } | null;
        }>("/api/reply-capture");
        if (!capture) return;
        setTweet(capture.tweet);
        if (capture.handle) setLogHandle(capture.handle);
        setAiMsg(`Loaded a tweet from ${capture.handle ?? "X"} — draft a reply below ✓`);
        await del("/api/reply-capture"); // consume it so it doesn't reload next time
      } catch {
        // nothing captured / app offline — ignore
      }
    })();
  }, []);

  function updateGoal(v: number) {
    const n = Math.max(1, Math.floor(v) || DEFAULT_GOAL);
    setGoal(n);
    localStorage.setItem(GOAL_KEY, String(n));
  }

  async function logReply() {
    try {
      await postJson("/api/replies", { handle: logHandle, note: logNote });
      setLogHandle("");
      setLogNote("");
      setError("");
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function undoReply(id: number) {
    try {
      await del(`/api/replies/${id}`);
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function logReplyForTarget(t: Target) {
    try {
      await Promise.all([
        postJson("/api/replies", { handle: t.handle }),
        patchJson(`/api/targets/${t.id}`, { checked: true }),
      ]);
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  const repliesToday = replies.filter((r) => isToday(r.created_at)).length;

  async function addTarget() {
    if (!handle.trim()) return;
    try {
      await postJson("/api/targets", { handle, note });
      setHandle("");
      setNote("");
      setError("");
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  const toggleCheck = async (t: Target) => {
    await patchJson(`/api/targets/${t.id}`, { checked: !isToday(t.last_checked_at) });
    load();
  };
  const remove = async (t: Target) => {
    if (confirm(`Remove ${t.handle}?`)) {
      await del(`/api/targets/${t.id}`);
      load();
    }
  };

  const framework = selected != null ? REPLY_FRAMEWORKS[selected] : null;

  function copyScaffold() {
    if (!framework) return;
    navigator.clipboard.writeText(framework.scaffold).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function draftWithAI() {
    if (!tweet.trim()) return;
    setAiLoading(true);
    setAiMsg("");
    setAiDrafts([]);
    try {
      const fw =
        selected != null
          ? `${REPLY_FRAMEWORKS[selected].name} — ${REPLY_FRAMEWORKS[selected].intent}`
          : undefined;
      const r = await postJson<{ drafts: string[]; source: "ai" | "off" | "error" }>(
        "/api/reply-draft",
        { tweet, framework: fw }
      );
      setAiDrafts(r.drafts);
      if (r.source === "off")
        setAiMsg("Set GROQ_API_KEY (or another backend) in .env.local to enable AI reply drafts.");
      else if (r.source === "error")
        setAiMsg("AI backend unavailable right now — try again, or use a framework scaffold above.");
    } catch (e) {
      setAiMsg(String(e instanceof Error ? e.message : e));
    } finally {
      setAiLoading(false);
    }
  }

  function copyDraft(text: string, i: number) {
    navigator.clipboard.writeText(text).then(() => {
      setAiCopied(i);
      setTimeout(() => setAiCopied((c) => (c === i ? null : c)), 1500);
    });
  }

  return (
    <div>
      <h1 className="page-title">Replies</h1>
      <p className="page-sub">
        Reach on X comes from showing up in other people's replies. Track who to reply to,
        and use a proven framework to write a reply worth reading.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      <h2 className="section-title">Daily reply sprint</h2>
      <div className="card stack">
        <div className="row spread">
          <span className="small muted">Today&apos;s replies</span>
          <span className="mono" style={{ fontWeight: 600 }}>{repliesToday} / {goal}</span>
        </div>
        <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (repliesToday / goal) * 100)}%`,
              background: "var(--accent)",
              transition: "width var(--dur) var(--ease)",
            }}
          />
        </div>
        <div className="row spread">
          <label className="small muted row" style={{ gap: "var(--space-1)" }}>
            Daily goal
            <input
              className="input"
              type="number"
              min={1}
              value={goal}
              onChange={(e) => updateGoal(Number(e.target.value))}
              style={{ maxWidth: 80 }}
            />
          </label>
          <span className="small muted">Ratio {ratio != null ? `${ratio}:1` : "—"}</span>
        </div>
        <span className="xs muted">Aim for 3:1+ replies-to-posts early on.</span>
      </div>

      <div className="card stack">
        <span className="small muted">Log a reply</span>
        <div className="row">
          <input
            className="input"
            placeholder="@handle (optional)"
            value={logHandle}
            onChange={(e) => setLogHandle(e.target.value)}
            style={{ maxWidth: 180 }}
          />
          <input
            className="input"
            placeholder="note (optional)"
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
          />
          <button className="btn btn-accent" onClick={logReply}>
            Log
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="stack">
          {replies.slice(0, 15).map((r) => (
            <div className="card row spread" key={r.id}>
              <div>
                {r.handle && (
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {r.handle}
                  </span>
                )}
                {r.note && <div className="muted small">{r.note}</div>}
                <div className="muted xs">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <button className="btn btn-ghost btn-danger" onClick={() => undoReply(r.id)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Target accounts</h2>
      <div className="card stack">
        <div className="row">
          <input
            className="input"
            placeholder="@handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            style={{ maxWidth: 180 }}
          />
          <input
            className="input"
            placeholder="why they matter / your angle (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn-accent" onClick={addTarget}>
            Add
          </button>
        </div>
      </div>

      {targets.length === 0 ? (
        <div className="empty">No targets yet. Add 10–20 accounts your audience already follows.</div>
      ) : (
        <div className="stack">
          {targets.map((t) => {
            const done = isToday(t.last_checked_at);
            return (
              <div className="card stack" key={t.id}>
                <div className="row spread">
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {t.handle}
                  </span>
                  {done && <span className="badge badge-good">checked today</span>}
                </div>
                {t.note && <span className="muted small">{t.note}</span>}
                <div className="row">
                  <button className="btn btn-accent" onClick={() => logReplyForTarget(t)}>
                    Log reply
                  </button>
                  <button className="btn" onClick={() => toggleCheck(t)}>
                    {done ? "Uncheck" : "Checked today"}
                  </button>
                  <button className="btn btn-danger btn-ghost" onClick={() => remove(t)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="section-title">Reply frameworks</h2>
      <div className="card stack">
        <label className="small muted" htmlFor="tweet">
          Paste the tweet you want to reply to
        </label>
        <textarea
          id="tweet"
          className="textarea"
          placeholder="Their tweet…"
          value={tweet}
          onChange={(e) => setTweet(e.target.value)}
        />
        <div className="row">
          {REPLY_FRAMEWORKS.map((f, i) => (
            <button
              key={f.name}
              className={`btn${selected === i ? " btn-accent" : ""}`}
              onClick={() => setSelected(i)}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="row spread">
          <span className="muted xs">
            Pick a framework to bias the AI (optional), or draft straight from the tweet.
          </span>
          <button
            className="btn btn-accent"
            onClick={draftWithAI}
            disabled={aiLoading || !tweet.trim()}
          >
            {aiLoading ? "Drafting…" : "✨ Draft replies with AI"}
          </button>
        </div>
      </div>

      {framework && (
        <div className="card stack">
          <span className="muted small">{framework.intent}</span>
          {tweet.trim() && (
            <div
              className="mono small muted"
              style={{
                whiteSpace: "pre-wrap",
                borderLeft: "3px solid var(--border)",
                paddingLeft: "var(--space-2)",
              }}
            >
              {tweet.trim()}
            </div>
          )}
          <hr className="divider" />
          <div className="mono" style={{ whiteSpace: "pre-wrap" }}>
            {framework.scaffold}
          </div>
          <div className="row">
            <button className="btn btn-accent" onClick={copyScaffold}>
              {copied ? "Copied ✓" : "Copy scaffold"}
            </button>
          </div>
        </div>
      )}

      {aiMsg && <div className="card muted small">{aiMsg}</div>}
      {aiDrafts.length > 0 && (
        <>
          <h2 className="section-title">
            AI reply drafts <span className="badge badge-good">AI</span>
          </h2>
          <div className="stack">
            {aiDrafts.map((d, i) => (
              <div className="card stack" key={i}>
                <p className="mono" style={{ whiteSpace: "pre-wrap" }}>
                  {d}
                </p>
                <div className="row spread">
                  <span className={`char-count${d.length > 280 ? " over" : ""}`}>
                    {d.length}/280
                  </span>
                  <button className="btn" onClick={() => copyDraft(d, i)}>
                    {aiCopied === i ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
