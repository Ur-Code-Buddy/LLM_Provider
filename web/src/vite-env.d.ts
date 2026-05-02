/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  /** Base URL for LiteLLM native UI (dashboard). Omit to use `<origin>/ui`. */
  readonly VITE_LITELLM_UI_URL?: string;
  /** Direct LiteLLM console URL (compose default `:4001` on localhost). */
  readonly VITE_LITELLM_DIRECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
