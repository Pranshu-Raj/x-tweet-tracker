// Shared domain types. See docs/DATA-MODEL.md for the authoritative schema.

export type DraftStatus = "draft" | "queued" | "posted" | "archived";

export interface Draft {
  id: number;
  body: string;
  status: DraftStatus;
  score: number | null;
  scheduled_at: string | null; // ISO-8601 UTC
  posted_at: string | null; // ISO-8601 UTC
  created_at: string; // ISO-8601 UTC
  updated_at: string; // ISO-8601 UTC
}

export interface Target {
  id: number;
  handle: string; // stored with leading "@"
  note: string | null;
  last_checked_at: string | null; // ISO-8601 UTC
  created_at: string; // ISO-8601 UTC
}

export interface FollowerEntry {
  id: number;
  date: string; // YYYY-MM-DD (local date)
  followers: number;
  note: string | null;
  created_at: string; // ISO-8601 UTC
}
