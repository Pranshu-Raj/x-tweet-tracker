// SQLite connection + schema. Server-only — never import into a client component.
// Uses Node 24's built-in node:sqlite (no native compilation). See docs/ARCHITECTURE.md.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), "data", "cockpit.db");

// Cache the connection on globalThis so Next.js HMR in dev doesn't open a new
// handle on every hot reload.
const globalForDb = globalThis as unknown as { __cockpitDb?: DatabaseSync };

function createDb(): DatabaseSync {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      body         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      score        INTEGER,
      scheduled_at TEXT,
      posted_at    TEXT,
      impressions  INTEGER,
      likes        INTEGER,
      replies      INTEGER,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_drafts_status    ON drafts(status);
    CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON drafts(scheduled_at);

    CREATE TABLE IF NOT EXISTS targets (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      handle          TEXT NOT NULL UNIQUE,
      note            TEXT,
      last_checked_at TEXT,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS follower_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL UNIQUE,
      followers  INTEGER NOT NULL,
      note       TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reply_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      handle     TEXT,
      note       TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_activity (
      date       TEXT PRIMARY KEY,
      tweets     INTEGER NOT NULL DEFAULT 0,
      replies    INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reply_capture (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet      TEXT NOT NULL,
      handle     TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Additive migrations so pre-existing DBs gain the Phase 1.5 metric columns.
  for (const col of ["impressions", "likes", "replies"]) {
    try {
      db.exec(`ALTER TABLE drafts ADD COLUMN ${col} INTEGER`);
    } catch {
      // column already exists — ignore
    }
  }

  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__cockpitDb) {
    globalForDb.__cockpitDb = createDb();
  }
  return globalForDb.__cockpitDb;
}

/** Current UTC time as an ISO-8601 string — the single timestamp helper. */
export function nowIso(): string {
  return new Date().toISOString();
}
