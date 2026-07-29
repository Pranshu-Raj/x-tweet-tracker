// Tiny client-side fetch helpers shared across pages.

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).error ?? res.statusText;
    throw new Error(msg);
  }
  // DELETE may return an empty-ish body; guard the parse.
  return res.json().catch(() => ({})) as Promise<T>;
}

export const getJson = <T>(url: string) => request<T>(url);
export const postJson = <T>(url: string, data: unknown) =>
  request<T>(url, { method: "POST", body: JSON.stringify(data) });
export const patchJson = <T>(url: string, data: unknown) =>
  request<T>(url, { method: "PATCH", body: JSON.stringify(data) });
export const del = <T>(url: string) => request<T>(url, { method: "DELETE" });
