// Shared date helpers (client + server safe).

/** Today's LOCAL date as YYYY-MM-DD. */
export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** True if an ISO timestamp falls on today's local date. */
export function isToday(iso: string | null): boolean {
  return iso != null && new Date(iso).toDateString() === new Date().toDateString();
}
