// Data layer. Dual driver, chosen at runtime by whether TURSO_DATABASE_URL is set:
//   • local dev  → Node's built-in node:sqlite (offline, zero native compilation)
//   • production → @libsql/client/web (pure-JS HTTP) against Turso
// Both speak SQLite, so the SQL is identical — only the async plumbing differs.
// Server-only: never import into a client component.

import { mkdirSync } from "node:fs";
import { join } from "node:path";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

type Row = Record<string, unknown>;
export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

// SQLite-compatible schema (works on node:sqlite AND libSQL). One statement per
// entry so the remote driver can run them individually.
const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS drafts (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_drafts_status    ON drafts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON drafts(scheduled_at)`,
  `CREATE TABLE IF NOT EXISTS targets (
     id              INTEGER PRIMARY KEY AUTOINCREMENT,
     handle          TEXT NOT NULL UNIQUE,
     note            TEXT,
     last_checked_at TEXT,
     created_at      TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS follower_log (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     date       TEXT NOT NULL UNIQUE,
     followers  INTEGER NOT NULL,
     note       TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS ideas (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     body       TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS reply_log (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     handle     TEXT,
     note       TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS daily_activity (
     date       TEXT PRIMARY KEY,
     tweets     INTEGER NOT NULL DEFAULT 0,
     replies    INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS reply_capture (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     tweet      TEXT NOT NULL,
     handle     TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS profile (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     name         TEXT,
     handle       TEXT,
     bio          TEXT,
     location     TEXT,
     url          TEXT,
     pinned_tweet TEXT,
     following    INTEGER,
     followers    INTEGER,
     captured_at  TEXT NOT NULL
   )`,
];

interface Backend {
  all(sql: string, args: unknown[]): Promise<Row[]>;
  get(sql: string, args: unknown[]): Promise<Row | undefined>;
  run(sql: string, args: unknown[]): Promise<RunResult>;
}

// Cache the ready backend (schema ensured) on globalThis so Next.js HMR / warm
// serverless instances reuse one connection instead of reopening on every call.
const g = globalThis as unknown as { __cockpitBackend?: Promise<Backend> };

async function initRemote(): Promise<Backend> {
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({ url: TURSO_URL as string, authToken: TURSO_TOKEN });
  for (const stmt of SCHEMA) await client.execute(stmt);
  return {
    async all(sql, args) {
      return (await client.execute({ sql, args: args as never })).rows as unknown as Row[];
    },
    async get(sql, args) {
      const rows = (await client.execute({ sql, args: args as never })).rows;
      return (rows[0] as unknown as Row) ?? undefined;
    },
    async run(sql, args) {
      const r = await client.execute({ sql, args: args as never });
      return {
        lastInsertRowid: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : 0,
        changes: r.rowsAffected,
      };
    },
  };
}

async function initLocal(): Promise<Backend> {
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  const db = new DatabaseSync(join(process.cwd(), "data", "cockpit.db"));
  db.exec("PRAGMA journal_mode = WAL;");
  for (const stmt of SCHEMA) db.exec(stmt);
  return {
    async all(sql, args) {
      return db.prepare(sql).all(...(args as never[])) as unknown as Row[];
    },
    async get(sql, args) {
      return db.prepare(sql).get(...(args as never[])) as unknown as Row | undefined;
    },
    async run(sql, args) {
      const r = db.prepare(sql).run(...(args as never[]));
      return { lastInsertRowid: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
  };
}

function backend(): Promise<Backend> {
  if (!g.__cockpitBackend) g.__cockpitBackend = TURSO_URL ? initRemote() : initLocal();
  return g.__cockpitBackend;
}

/** Query returning all rows. */
export async function all<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  return (await (await backend()).all(sql, args)) as unknown as T[];
}

/** Query returning the first row (or undefined). */
export async function get<T>(sql: string, args: unknown[] = []): Promise<T | undefined> {
  return (await (await backend()).get(sql, args)) as unknown as T | undefined;
}

/** Statement returning affected-row info (INSERT/UPDATE/DELETE). */
export async function run(sql: string, args: unknown[] = []): Promise<RunResult> {
  return (await backend()).run(sql, args);
}

/** Current UTC time as an ISO-8601 string — the single timestamp helper. */
export function nowIso(): string {
  return new Date().toISOString();
}
