"use client";

import { useEffect, useState } from "react";
import type { Target } from "@/lib/types";
import { REPLY_FRAMEWORKS } from "@/lib/replyFrameworks";
import { getJson, postJson, patchJson, del } from "../components/http";
import { isToday } from "@/lib/dates";

export default function RepliesPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [tweet, setTweet] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const { targets } = await getJson<{ targets: Target[] }>("/api/targets");
      setTargets(targets);
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  useEffect(() => {
    load();
  }, []);

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
    </div>
  );
}
