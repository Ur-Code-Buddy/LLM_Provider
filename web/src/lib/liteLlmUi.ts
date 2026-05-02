/** Native LiteLLM dashboard / hosted UI URLs (often `/ui` behind same-origin proxy). */

export function liteLlmNativeUiUrl(): string {
  const fromEnv = import.meta.env.VITE_LITELLM_UI_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.origin}/ui`;
  }
  return "/ui";
}

export function liteLlmFallbackLoginUrl(): string {
  const ui = liteLlmNativeUiUrl().replace(/\/+$/, "");
  if (ui === "/ui") return "/fallback/login";
  if (ui.endsWith("/ui")) {
    const prefix = ui.slice(0, -"/ui".length).replace(/\/+$/, "") || "";
    return prefix ? `${prefix}/fallback/login` : "/fallback/login";
  }
  try {
    const u = new URL(ui.includes("://") ? ui : `https://${ui}`);
    u.pathname = "/fallback/login";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "/fallback/login";
  }
}

/** Direct LiteLLM without gateway-ui (compose default publishes host port `:4001`). */
export function liteLlmDirectConsoleUrl(): string {
  const fromEnv = import.meta.env.VITE_LITELLM_DIRECT_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://127.0.0.1:4001";
}
