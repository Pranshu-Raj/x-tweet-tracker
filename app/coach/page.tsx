"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import { getJson } from "../components/http";

interface Check {
  id: string;
  label: string;
  pass: boolean;
  hint: string;
}
interface CoachData {
  profile: Profile | null;
  checks: Check[];
  score: number;
  suggestions: string[];
  source: "ai" | "templates" | "none";
}

export default function CoachPage() {
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setData(await getJson<CoachData>("/api/coach"));
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const p = data?.profile;

  return (
    <div>
      <h1 className="page-title">Coach</h1>
      <p className="page-sub">
        Honest profile feedback — objective best-practices you control, plus grounded suggestions.
        No virality promises.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      {!p ? (
        <div className="empty">
          No profile captured yet. On your X profile, open the Cockpit extension and click
          <strong> “Capture profile”</strong> — then refresh here.
        </div>
      ) : (
        <>
          {/* Snapshot */}
          <div className="card">
            <div className="row spread">
              <div>
                <span style={{ fontWeight: 600 }}>{p.name || "(no name)"}</span>{" "}
                <span className="mono muted">@{p.handle}</span>
              </div>
              <span className="badge badge-good">
                {data!.score}/100 · {data!.checks.filter((c) => c.pass).length}/{data!.checks.length}
              </span>
            </div>
            <div className="muted small" style={{ marginTop: "var(--space-2)" }}>
              {p.bio?.trim() ? p.bio : "— no bio —"}
            </div>
            <div className="muted xs" style={{ marginTop: "var(--space-2)" }}>
              {p.following ?? "?"} following · {p.followers ?? "?"} followers
              {p.location ? ` · ${p.location}` : ""}
              {p.url ? ` · ${p.url}` : ""}
              {p.pinned_tweet ? " · 📌 pinned set" : " · no pinned tweet"}
            </div>
          </div>

          {/* Checklist */}
          <h2 className="section-title">Checklist</h2>
          <div className="stack">
            {data!.checks.map((c) => (
              <div className="card row" key={c.id} style={{ gap: "var(--space-3)", alignItems: "flex-start" }}>
                <span
                  className={c.pass ? "pass" : "fail"}
                  style={{ fontWeight: 700, flex: "0 0 auto" }}
                  aria-hidden
                >
                  {c.pass ? "✓" : "✗"}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.label}</div>
                  <div className="muted small">{c.hint}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <h2 className="section-title">
            Suggestions{" "}
            <span className="muted small">
              · {data!.source === "ai" ? "AI" : data!.source === "templates" ? "templates" : ""}
            </span>
          </h2>
          {data!.suggestions.length === 0 ? (
            <div className="empty">No suggestions.</div>
          ) : (
            <div className="stack">
              {data!.suggestions.map((s, i) => (
                <div className="card" key={i}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: "var(--space-4)" }}>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}
