/** Relative path when apiBase empty (Vite dev proxy). */
export function apiUrl(apiBase: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = apiBase.replace(/\/$/, "");
  if (!base) return p;
  return `${base}${p}`;
}
