export type TierMode = "auto" | "basic" | "premium";

export type GatewaySettings = {
  apiBase: string;
  apiKey: string;
  tier: TierMode;
  stream: boolean;
  model: string;
};

const KEY = "litellm_gateway_ui_v1";

const defaultSettings = (): GatewaySettings => ({
  apiBase: import.meta.env.VITE_API_BASE ?? "",
  apiKey: "",
  tier: "auto",
  stream: true,
  model: "gateway",
});

export function loadSettings(): GatewaySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<GatewaySettings>;
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: GatewaySettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function patchSettings(partial: Partial<GatewaySettings>): GatewaySettings {
  const next = { ...loadSettings(), ...partial };
  saveSettings(next);
  return next;
}

const ADMIN_KEY = "litellm_gateway_admin_v1";

export type AdminCredentials = {
  masterKey: string;
};

const defaultAdmin = (): AdminCredentials => ({
  masterKey: "",
});

export function loadAdminCredentials(): AdminCredentials {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return defaultAdmin();
    const parsed = JSON.parse(raw) as Partial<AdminCredentials>;
    return { ...defaultAdmin(), ...parsed };
  } catch {
    return defaultAdmin();
  }
}

export function saveAdminCredentials(a: AdminCredentials): void {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(a));
}
