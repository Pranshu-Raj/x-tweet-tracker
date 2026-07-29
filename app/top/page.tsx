"use client";

import { useEffect, useState } from "react";
import type { Draft } from "@/lib/types";
import { getJson } from "../components/http";

type Metric = "impressions" | "likes" | "replies";

const METRICS: { key: Metric; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
];

// 1200 → "1.2k", 1_500_000 → "1.5m". Compact metric badges.
function abbrev(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
}

function MetricBadges({ draft }: { draft: Draft }) {
  return (
    <div className="row">
      {draft.impressions != null && <span className="badge">{abbrev(draft.impressions)} imp</span>}
      {draft.likes != null && <span className="badge">{abbrev(draft.likes)} likes</span>}
      {draft.replies != null && <span className="badge">{abbrev(draft.replies)} replies</span>}
    </div>
  );
}

function Tweet({ draft }: { draft: Draft }) {
  return (
    <p className="mono" style={{ whiteSpace: "pre-wrap" }}>
      {draft.body}
    </p>
  );
}

export default function TopPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [metric, setMetric] = useState<Metric>("impressions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const { drafts } = await getJson<{ drafts: Draft[] }>("/api/drafts?status=posted");
      setDrafts(drafts);
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

  const measured = drafts
    .filter((d) => d[metric] != null)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const unmeasured = drafts.filter((d) => d[metric] == null);

  return (
    <div>
      <h1 className="page-title">Top Tweets</h1>
      <p className="page-sub">
        The honest signal of what actually worked — your best posts, ranked by real numbers
        instead of what you hoped would land.
      </p>

      <div className="row" style={{ marginBottom: "var(--space-3)" }}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            className={`btn${metric === m.key ? " btn-accent" : ""}`}
            onClick={() => setMetric(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : drafts.length === 0 ? (
        <div className="empty">Post some tweets and add their metrics to see your winners.</div>
      ) : (
        <>
          {measured.length > 0 && (
            <div className="stack">
              {measured.map((d, i) => (
                <div key={d.id} className="card stack">
                  <div className="row spread">
                    <span className="score" style={{ fontSize: "var(--text-lg)" }}>
                      #{i + 1}
                    </span>
                    <MetricBadges draft={d} />
                  </div>
                  <Tweet draft={d} />
                </div>
              ))}
            </div>
          )}

          {unmeasured.length > 0 && (
            <>
              <h2 className="section-title muted">
                Not measured yet <span className="small">· {unmeasured.length}</span>
              </h2>
              <div className="stack">
                {unmeasured.map((d) => (
                  <div key={d.id} className="card stack">
                    <Tweet draft={d} />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
