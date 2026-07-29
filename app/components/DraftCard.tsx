"use client";

import { useState } from "react";
import type { Draft } from "@/lib/types";
import { patchJson, del } from "./http";

const TWEET_LIMIT = 280;

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 1200 → "1.2k", 1_500_000 → "1.5m". Compact metric badges.
function abbrev(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
}

// Default schedule suggestion: ~1 hour from now, as a datetime-local value.
function defaultWhen(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DraftCard({ draft, onMutate }: { draft: Draft; onMutate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [bodyText, setBodyText] = useState(draft.body);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(defaultWhen());
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState(draft.impressions == null ? "" : String(draft.impressions));
  const [likes, setLikes] = useState(draft.likes == null ? "" : String(draft.likes));
  const [replies, setReplies] = useState(draft.replies == null ? "" : String(draft.replies));

  const url = `/api/drafts/${draft.id}`;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onMutate();
    } catch (e) {
      alert(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const saveEdit = () =>
    run(async () => {
      await patchJson(url, { body: bodyText });
      setEditing(false);
    });

  const schedule = () =>
    run(async () => {
      await patchJson(url, { status: "queued", scheduled_at: new Date(when).toISOString() });
      setScheduling(false);
    });

  const markPosted = () => run(() => patchJson(url, { status: "posted" }));
  const unschedule = () => run(() => patchJson(url, { status: "draft", scheduled_at: null }));
  const archive = () => run(() => patchJson(url, { status: "archived" }));
  const remove = () => {
    if (confirm("Delete this draft permanently?")) run(() => del(url));
  };

  // Blank → null (clears the metric); otherwise send the raw number.
  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));
  const saveMetrics = () =>
    run(() =>
      patchJson(url, { impressions: num(imp), likes: num(likes), replies: num(replies) })
    );

  const metricField = (label: string, value: string, set: (v: string) => void) => (
    <label className="stack" style={{ gap: 4, width: 96 }}>
      <span className="muted xs">{label}</span>
      <input
        className="input"
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value)}
        style={{ padding: "var(--space-1) var(--space-2)" }}
      />
    </label>
  );

  const hasMetrics =
    draft.impressions != null || draft.likes != null || draft.replies != null;

  function copy() {
    navigator.clipboard.writeText(draft.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="card stack">
      <div className="row spread">
        <div className="row">
          {draft.status === "queued" && draft.scheduled_at && (
            <span className="badge badge-warn">⏰ {fmt(draft.scheduled_at)}</span>
          )}
          {draft.status === "posted" && (
            <span className="badge badge-good">✓ posted {fmt(draft.posted_at)}</span>
          )}
          {draft.status === "draft" && <span className="badge">draft</span>}
          {draft.score != null && <span className="badge">score {draft.score}</span>}
        </div>
        <span className={`char-count${draft.body.length > TWEET_LIMIT ? " over" : ""}`}>
          {draft.body.length}/{TWEET_LIMIT}
        </span>
      </div>

      {editing ? (
        <textarea className="textarea" value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
      ) : (
        <p className="mono" style={{ whiteSpace: "pre-wrap" }}>
          {draft.body}
        </p>
      )}

      {draft.status === "posted" && (
        <div className="stack">
          {hasMetrics && (
            <div className="row">
              {draft.impressions != null && (
                <span className="badge">{abbrev(draft.impressions)} imp</span>
              )}
              {draft.likes != null && (
                <span className="badge">{abbrev(draft.likes)} likes</span>
              )}
              {draft.replies != null && (
                <span className="badge">{abbrev(draft.replies)} replies</span>
              )}
            </div>
          )}
          <div className="row" style={{ alignItems: "flex-end" }}>
            {metricField("Impressions", imp, setImp)}
            {metricField("Likes", likes, setLikes)}
            {metricField("Replies", replies, setReplies)}
            <button className="btn btn-accent" onClick={saveMetrics} disabled={busy}>
              Save metrics
            </button>
          </div>
        </div>
      )}

      {scheduling && (
        <div className="row">
          <input
            className="input"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <button className="btn btn-accent" onClick={schedule} disabled={busy}>
            Set time
          </button>
          <button className="btn btn-ghost" onClick={() => setScheduling(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>

        {editing ? (
          <>
            <button className="btn btn-accent" onClick={saveEdit} disabled={busy}>
              Save
            </button>
            <button className="btn btn-ghost" onClick={() => { setEditing(false); setBodyText(draft.body); }}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}

        {draft.status !== "posted" && !scheduling && !editing && (
          <button className="btn" onClick={() => setScheduling(true)}>
            {draft.status === "queued" ? "Reschedule" : "Schedule"}
          </button>
        )}
        {draft.status === "queued" && (
          <button className="btn" onClick={unschedule} disabled={busy}>
            Unschedule
          </button>
        )}
        {draft.status !== "posted" && (
          <button className="btn btn-accent" onClick={markPosted} disabled={busy}>
            Mark posted
          </button>
        )}
        {draft.status !== "posted" && (
          <button className="btn btn-ghost" onClick={archive} disabled={busy}>
            Archive
          </button>
        )}
        <button className="btn btn-danger btn-ghost" onClick={remove} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}
