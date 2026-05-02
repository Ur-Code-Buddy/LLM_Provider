import { apiUrl } from "./apiBase";

export type AdminContext = {
  apiBase: string;
  masterKey: string;
};

async function adminFetch(
  ctx: AdminContext,
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  h.set("Authorization", `Bearer ${ctx.masterKey}`);
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(ctx.apiBase, path), {
    ...rest,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}

export async function adminJson<T = unknown>(
  ctx: AdminContext,
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const res = await adminFetch(ctx, path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export type KeyRow = Record<string, unknown>;

export async function listKeys(ctx: AdminContext): Promise<KeyRow[]> {
  const data = await adminJson<unknown>(ctx, "/key/list", { method: "GET" });
  if (Array.isArray(data)) return data as KeyRow[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const keys = o.keys ?? o.data ?? o.key_list ?? o.results;
    if (Array.isArray(keys)) return keys as KeyRow[];
  }
  return [];
}

export type GenerateKeyBody = Record<string, unknown>;

export async function generateKey(
  ctx: AdminContext,
  body: GenerateKeyBody,
): Promise<Record<string, unknown>> {
  return adminJson(ctx, "/key/generate", { method: "POST", json: body });
}

export async function updateKey(
  ctx: AdminContext,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return adminJson(ctx, "/key/update", { method: "POST", json: body });
}

export async function blockKey(ctx: AdminContext, key: string): Promise<unknown> {
  return adminJson(ctx, "/key/block", { method: "POST", json: { key } });
}

export async function unblockKey(ctx: AdminContext, key: string): Promise<unknown> {
  return adminJson(ctx, "/key/unblock", { method: "POST", json: { key } });
}

export async function keyInfo(
  ctx: AdminContext,
  key: string,
): Promise<Record<string, unknown>> {
  const q = new URLSearchParams({ key }).toString();
  return adminJson(ctx, `/key/info?${q}`, { method: "GET" });
}

export async function globalSpendReport(
  ctx: AdminContext,
  start: string,
  end: string,
): Promise<unknown> {
  const q = new URLSearchParams({ start_date: start, end_date: end }).toString();
  return adminJson(ctx, `/global/spend/report?${q}`, { method: "GET" });
}

export async function globalSpendReset(ctx: AdminContext): Promise<unknown> {
  return adminJson(ctx, "/global/spend/reset", { method: "POST", json: {} });
}

export type RecordRow = Record<string, unknown>;

function extractRows(data: unknown, arrayKeys: string[]): RecordRow[] {
  if (Array.isArray(data)) return data as RecordRow[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of arrayKeys) {
      const v = o[k];
      if (Array.isArray(v)) return v as RecordRow[];
    }
  }
  return [];
}

/** Team list endpoint shape differs by LiteLLM version — try GET then POST JSON. */
export async function listTeams(ctx: AdminContext): Promise<RecordRow[]> {
  let data: unknown;
  try {
    data = await adminJson(ctx, "/team/list", { method: "GET" });
  } catch {
    data = await adminJson(ctx, "/team/list", { method: "POST", json: {} });
  }
  return extractRows(data, ["teams", "data", "team_list", "results"]);
}

export async function createTeam(
  ctx: AdminContext,
  body: Record<string, unknown>,
): Promise<unknown> {
  return adminJson(ctx, "/team/new", { method: "POST", json: body });
}

export async function listUsers(ctx: AdminContext): Promise<RecordRow[]> {
  let data: unknown;
  try {
    data = await adminJson(ctx, "/user/list", { method: "GET" });
  } catch {
    data = await adminJson(ctx, "/user/list", { method: "POST", json: {} });
  }
  return extractRows(data, ["users", "data", "user_list", "results"]);
}

export async function inviteUser(ctx: AdminContext, body: Record<string, unknown>): Promise<unknown> {
  return adminJson(ctx, "/user/new", { method: "POST", json: body });
}

/** Policies / guardrails exposed by LiteLLM (often optional). */
export async function tryListPolicies(ctx: AdminContext): Promise<RecordRow[] | null> {
  try {
    const data = await adminJson(ctx, "/policy/list", { method: "GET" });
    return extractRows(data, ["policies", "data", "results"]);
  } catch {
    try {
      const data = await adminJson(ctx, "/policy/list", { method: "POST", json: {} });
      return extractRows(data, ["policies", "data", "results"]);
    } catch {
      return null;
    }
  }
}
