# Inference Console

Production build is served by Compose (`gateway-ui`) on **`GATEWAY_UI_PORT`** (default **4000**). Paths:

| Route | Purpose |
|-------|---------|
| `/` | Workspace (chat / completions UI) |
| `/portal` | Client portal shortcuts to LiteLLM `/ui`, fallback login, SSO notes |
| `/admin` | Platform admin (master key; keys, teams, users, guardrails info, usage) |

Local dev:

```bash
npm install
npm run dev
```

Optional env in `web/` (see root `.env.example`): `VITE_DEV_PROXY_TARGET`, `VITE_LITELLM_UI_URL`, `VITE_LITELLM_DIRECT_URL`.
