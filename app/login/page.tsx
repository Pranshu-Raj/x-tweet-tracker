"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Invalid token");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "12vh auto 0" }}>
      <h1 className="page-title">Cockpit</h1>
      <p className="page-sub">Enter your access token to continue.</p>
      <form onSubmit={submit} className="card stack" style={{ gap: "var(--space-3)" }}>
        <input
          className="input"
          type="password"
          placeholder="access token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
        />
        {error && (
          <div className="small" style={{ color: "var(--bad)" }}>
            {error}
          </div>
        )}
        <button className="btn btn-accent" type="submit" disabled={busy || !token.trim()}>
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
