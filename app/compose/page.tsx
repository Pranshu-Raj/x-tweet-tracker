"use client";

import { useState, useEffect } from "react";
import type { Variant } from "@/lib/hooks";
import type { ScoreResult } from "@/lib/score";
import { postJson } from "../components/http";

const TWEET_LIMIT = 280;

function scoreClass(score: number): string {
  if (score >= 75) return "pass";
  if (score >= 50) return "";
  return "fail";
}

export default function ComposePage() {
  const [raw, setRaw] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [scoredText, setScoredText] = useState<string>("");
  const [scoredLabel, setScoredLabel] = useState<string>("");
  const [copied, setCopied] = useState<number | null>(null);
  const [savedMsg, setSavedMsg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [source, setSource] = useState<"ai" | "templates">("templates");

  // Prefill from an idea sent over by the Idea Inbox (key: "cockpit:idea").
  useEffect(() => {
    const seed = sessionStorage.getItem("cockpit:idea");
    if (seed) {
      setRaw(seed);
      sessionStorage.removeItem("cockpit:idea");
    }
  }, []);

  async function generate() {
    setError("");
    if (!raw.trim()) return;
    setGenerating(true);
    try {
      const res = await postJson<{ variants: Variant[]; source: "ai" | "templates" }>(
        "/api/variants",
        { text: raw }
      );
      setVariants(res.variants);
      setSource(res.source);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setGenerating(false);
    }
  }

  async function scoreText(text: string, label: string) {
    setError("");
    if (!text.trim()) return;
    try {
      const result = await postJson<ScoreResult>("/api/score", { text });
      setScore(result);
      setScoredText(text);
      setScoredLabel(label);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  async function saveDraft(text: string) {
    setError("");
    setSavedMsg("");
    try {
      const includeScore = scoredText === text && score ? score.score : undefined;
      await postJson("/api/drafts", { body: text, score: includeScore });
      setSavedMsg("Saved to Queue ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  function copy(text: string, index: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(index);
      setTimeout(() => setCopied((c) => (c === index ? null : c)), 1500);
    });
  }

  function editVariant(index: number, text: string) {
    setVariants((vs) => vs.map((v, i) => (i === index ? { ...v, text } : v)));
  }

  return (
    <div>
      <h1 className="page-title">Hook Lab</h1>
      <p className="page-sub">
        Turn a raw thought into structured variants, and grade the <em>structure</em> you
        control. This scores how a tweet is built — it does not predict whether it goes viral.
      </p>

      <div className="card stack">
        <label className="small muted" htmlFor="raw">
          Your raw thought
        </label>
        <textarea
          id="raw"
          className="textarea"
          placeholder="Dump the idea. e.g. Most backtests are lies because they overfit to the past."
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="row spread">
          <span className={`char-count${raw.length > TWEET_LIMIT ? " over" : ""}`}>
            {raw.length}/{TWEET_LIMIT}
          </span>
          <div className="row">
            <button className="btn" onClick={() => scoreText(raw, "raw thought")} disabled={!raw.trim()}>
              Score this
            </button>
            <button className="btn btn-accent" onClick={generate} disabled={generating || !raw.trim()}>
              {generating ? "Generating…" : "Generate variants"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="card badge-good" style={{ borderColor: "var(--good)" }}>
          {savedMsg}
        </div>
      )}

      {score && (
        <>
          <h2 className="section-title">Structure score — {scoredLabel}</h2>
          <div className="card">
            <div className="row spread">
              <span className={`score ${scoreClass(score.score)}`}>{score.score}/100</span>
              <span className="char-count">{score.length} chars</span>
            </div>
            <hr className="divider" />
            <div className="stack" style={{ gap: 0 }}>
              {score.checks.map((c) => (
                <div className="check" key={c.label}>
                  <span className={`check-mark ${c.pass ? "pass" : "fail"}`}>
                    {c.pass ? "✓" : "○"}
                  </span>
                  <span>
                    <span className={c.pass ? "" : "muted"}>{c.label}</span>
                    <span className="muted xs"> · {c.weight}pts</span>
                    {!c.pass && <div className="xs muted">↳ {c.hint}</div>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {variants.length > 0 && (
        <>
          <h2 className="section-title">
            Variants{" "}
            <span className={`badge${source === "ai" ? " badge-good" : ""}`}>
              {source === "ai" ? "AI" : "templates"}
            </span>
          </h2>
          <div className="stack">
            {variants.map((v, i) => (
              <div className="card stack" key={i}>
                <div className="row spread">
                  <span className="badge">{v.template}</span>
                  <span className={`char-count${v.text.length > TWEET_LIMIT ? " over" : ""}`}>
                    {v.text.length}/{TWEET_LIMIT}
                  </span>
                </div>
                <textarea
                  className="textarea"
                  value={v.text}
                  onChange={(e) => editVariant(i, e.target.value)}
                />
                <div className="row">
                  <button className="btn" onClick={() => copy(v.text, i)}>
                    {copied === i ? "Copied ✓" : "Copy"}
                  </button>
                  <button className="btn" onClick={() => scoreText(v.text, v.template)}>
                    Score
                  </button>
                  <button className="btn btn-accent" onClick={() => saveDraft(v.text)}>
                    Save to Queue
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
