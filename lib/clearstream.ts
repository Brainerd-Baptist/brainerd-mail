// Read-only ClearStream client. Only ever GETs. Server only: the key never reaches the browser.
const BASE = "https://api.getclearstream.com/v1";

export class ClearstreamError extends Error {
  constructor(message: string, public code: "not_configured" | "auth" | "rate" | "other" = "other") { super(message); }
}

export type CsList = { id: string; name: string; count: number | null };
export type CsPerson = { id: string; name: string; email: string; emailStatus: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The response wrapper isn't fixed in the docs we have, so take the first array we find.
const rowsOf = (j: any): any[] => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.subscribers) ? j.subscribers : Array.isArray(j?.lists) ? j.lists : (Object.values(j ?? {}).find((v) => Array.isArray(v)) as any[]) ?? []);

async function get(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const key = process.env.CLEARSTREAM_API_KEY;
  if (!key) throw new ClearstreamError("ClearStream isn't connected yet. The owner needs to add the ClearStream key.", "not_configured");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" }, cache: "no-store" });
    if (r.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (r.status === 401 || r.status === 403) throw new ClearstreamError("ClearStream refused the key. It may have been deleted or mistyped.", "auth");
    if (!r.ok) throw new ClearstreamError(`ClearStream answered with an error (${r.status}).`);
    return r.json();
  }
  throw new ClearstreamError("ClearStream is limiting requests right now. Try again in a minute.", "rate");
}

export async function fetchLists(): Promise<CsList[]> {
  const out: CsList[] = [];
  for (let page = 1; page <= 20; page++) {
    const j = await get("/lists", { page, limit: 100 });
    const rows = rowsOf(j);
    for (const l of rows) out.push({ id: String(l.id), name: String(l.name ?? l.title ?? `List ${l.id}`), count: typeof l.subscribers_count === "number" ? l.subscribers_count : typeof l.count === "number" ? l.count : null });
    const pages = Number(j?.pagination?.pages ?? j?.pages ?? 1);
    if (page >= pages || rows.length === 0) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Everyone ACTIVE on one list.
export async function fetchListPeople(listId: string): Promise<CsPerson[]> {
  const out: CsPerson[] = [];
  for (let page = 1; page <= 80; page++) {
    const j = await get(`/lists/${encodeURIComponent(listId)}/subscribers`, { page, limit: 100 });
    const rows = rowsOf(j);
    for (const s of rows) {
      const name = String(s.full_name ?? ([s.first, s.last].filter(Boolean).join(" ") || "")).trim();
      out.push({ id: String(s.id), name: name || "(no name)", email: String(s.email ?? "").trim().toLowerCase(), emailStatus: String(s.email_status ?? "").trim().toLowerCase() });
    }
    const pages = Number(j?.pagination?.pages ?? j?.pages ?? 1);
    if (page >= pages || rows.length === 0) break;
  }
  return out;
}
