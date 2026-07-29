"use client";

import { useEffect, useState } from "react";
import type { Draft } from "@/lib/types";
import { getJson } from "../components/http";
import DraftCard from "../components/DraftCard";

export default function QueuePage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const { drafts } = await getJson<{ drafts: Draft[] }>("/api/drafts");
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

  const queued = drafts.filter((d) => d.status === "queued");
  const draftOnes = drafts.filter((d) => d.status === "draft");
  const posted = drafts.filter((d) => d.status === "posted");

  const section = (title: string, items: Draft[], emptyMsg: string) => (
    <>
      <h2 className="section-title">
        {title} <span className="muted small">· {items.length}</span>
      </h2>
      {items.length === 0 ? (
        <div className="empty">{emptyMsg}</div>
      ) : (
        <div className="stack">
          {items.map((d) => (
            <DraftCard key={d.id} draft={d} onMutate={load} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div>
      <h1 className="page-title">Queue</h1>
      <p className="page-sub">
        Your drafts and schedule. There's no auto-posting — copy a tweet, paste it into X,
        then hit “Mark posted”.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : (
        <>
          {section("Queued", queued, "Nothing scheduled. Schedule a draft to see it here.")}
          {section("Drafts", draftOnes, "No drafts yet — write some in the Hook Lab.")}
          {section("Posted", posted, "Nothing posted yet. Mark a tweet posted once it's live.")}
        </>
      )}
    </div>
  );
}
