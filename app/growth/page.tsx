"use client";

import { useEffect, useMemo, useState } from "react";
import type { FollowerEntry } from "@/lib/types";
import { getJson, postJson } from "../components/http";
import { todayLocal } from "@/lib/dates";

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
}

function signed(n: number): string {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString();
}

function Delta({ label, value }: { label: string; value: number }) {
  return (
    <span className={`badge ${value >= 0 ? "badge-good" : "badge-bad"}`}>
      {label} {signed(value)}
    </span>
  );
}

function Chart({ entries }: { entries: FollowerEntry[] }) {
  if (entries.length === 0) {
    return <div className="empty">No data yet — log your follower count above.</div>;
  }
  const W = 800;
  const H = 240;
  const pad = 34;
  const vals = entries.map((e) => e.followers);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = (i: number) =>
    entries.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (entries.length - 1);
  const y = (v: number) => (max === min ? H / 2 : pad + (1 - (v - min) / (max - min)) * (H - 2 * pad));
  const points = entries.map((e, i) => `${x(i)},${y(e.followers)}`).join(" ");

  return (
    <div className="card">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
        {/* baseline frame */}
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--border)" />
        {entries.length > 1 && (
          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        )}
        {entries.map((e, i) => (
          <circle key={i} cx={x(i)} cy={y(e.followers)} r={3.5} fill="var(--accent)" />
        ))}
        {/* value labels */}
        <text x={pad} y={pad - 10} fill="var(--muted)" fontSize={14} fontFamily="monospace">
          {max.toLocaleString()}
        </text>
        {max !== min && (
          <text x={pad} y={H - pad + 18} fill="var(--muted)" fontSize={14} fontFamily="monospace">
            {min.toLocaleString()}
          </text>
        )}
        {/* date labels */}
        <text x={pad} y={H - 6} fill="var(--muted)" fontSize={13}>
          {fmtDate(entries[0].date)}
        </text>
        <text x={W - pad} y={H - 6} fill="var(--muted)" fontSize={13} textAnchor="end">
          {fmtDate(entries[entries.length - 1].date)}
        </text>
      </svg>
    </div>
  );
}

export default function GrowthPage() {
  const [entries, setEntries] = useState<FollowerEntry[]>([]);
  const [date, setDate] = useState(todayLocal());
  const [followers, setFollowers] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const { entries } = await getJson<{ entries: FollowerEntry[] }>("/api/growth");
      setEntries(entries);
      setError("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (followers.trim() === "") return;
    try {
      await postJson("/api/growth", { date, followers: Number(followers), note });
      setFollowers("");
      setNote("");
      setError("");
      load();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  const summary = useMemo(() => {
    if (entries.length === 0) return null;
    const latest = entries[entries.length - 1];
    const dow = entries.length >= 2 ? latest.followers - entries[entries.length - 2].followers : null;
    const sevenAgo = new Date(new Date(latest.date).getTime() - 7 * 86400000);
    const prior = [...entries].reverse().find((e) => new Date(e.date) <= sevenAgo);
    const week = prior ? latest.followers - prior.followers : null;
    return { latest, dow, week };
  }, [entries]);

  const history = [...entries].reverse();

  return (
    <div>
      <h1 className="page-title">Growth</h1>
      <p className="page-sub">
        The honest, measurable alternative to "virality": log your follower count and watch
        the trend. Logging the same day again just updates it.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      <div className="card stack">
        <div className="row">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ maxWidth: 170 }}
          />
          <input
            className="input"
            type="number"
            min={0}
            placeholder="follower count"
            value={followers}
            onChange={(e) => setFollowers(e.target.value)}
            style={{ maxWidth: 170 }}
          />
          <input
            className="input"
            placeholder="note (optional) — e.g. thread went off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn-accent" onClick={save}>
            Save
          </button>
        </div>
      </div>

      {summary && (
        <div className="card">
          <div className="row spread">
            <div>
              <div className="muted small">latest ({fmtDate(summary.latest.date)})</div>
              <div className="score">{summary.latest.followers.toLocaleString()}</div>
            </div>
            <div className="row">
              {summary.dow != null && <Delta label="1d" value={summary.dow} />}
              {summary.week != null && <Delta label="7d" value={summary.week} />}
            </div>
          </div>
        </div>
      )}

      <h2 className="section-title">Trend</h2>
      <Chart entries={entries} />

      <h2 className="section-title">History</h2>
      {history.length === 0 ? (
        <div className="empty">Log a count above to start your trend.</div>
      ) : (
        <div className="stack">
          {history.map((e, idx) => {
            // idx counts from newest; the chronologically previous entry is the next one in `history`.
            const prev = history[idx + 1];
            const delta = prev ? e.followers - prev.followers : null;
            return (
              <div className="card row spread" key={e.date}>
                <div>
                  <span className="mono">{fmtDate(e.date)}</span>{" "}
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {e.followers.toLocaleString()}
                  </span>
                  {e.note && <div className="muted small">{e.note}</div>}
                </div>
                {delta != null && <Delta label="" value={delta} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
