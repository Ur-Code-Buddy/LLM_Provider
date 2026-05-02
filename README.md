# LiteLLM gateway (self-hosted)

Dockerized **LiteLLM proxy** with Postgres (virtual keys + spend), Redis (router limits + tier classifier cache), optional **Cloudflare Tunnel**, and optional **Inference Console** web client in `web/` (Workspace + Administration).

**Routing:** clients use a single OpenAI-compatible API. The gateway applies guardrails, optional **basic / premium** tier routing (DeepSeek vs Claude with GPT‑4o fallback), and overwrites the requested model. See [`config/proxy_config.yaml`](config/proxy_config.yaml) and [`hooks/`](hooks/).

---

## Prerequisites

- **Docker** and **Docker Compose** (Docker Desktop on Windows/macOS, or Engine on Linux / Raspberry Pi).
- **Node.js 18+** and **npm** — only if you use the web UI (`web/`).
- Provider API keys as needed: at minimum **DeepSeek** for the “basic” tier and classifier; **Anthropic** + **OpenAI** for premium + fallback; **Moonshot** only if you use the Kimi route.

---

## 1. Configure environment

Create a **`.env`** file in the **repository root** (same folder as `docker-compose.yml`). Do **not** commit real secrets.

Required for a working stack:

| Variable | Purpose |
|----------|---------|
| `LITELLM_MASTER_KEY` | Proxy admin key (must start with `sk-`). Used for `/key/generate` and admin APIs — **keep secret**. |
| `DATABASE_URL` | Postgres connection string for LiteLLM (must match the `postgres` service). Example: `postgresql://litellm:YOUR_PASSWORD@postgres:5432/litellm` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Used by the Compose `postgres` service — align `DATABASE_URL` with these. |
| `DEEPSEEK_API_KEY` | DeepSeek (basic tier + classifier). |
| `ANTHROPIC_API_KEY` | Claude (premium). |
| `OPENAI_API_KEY` | GPT‑4o (premium fallback). |
| `MOONSHOT_API_KEY` | Optional — Moonshot/Kimi model in `model_list`. |

Optional / tuning (defaults exist in `docker-compose.yml`):

- `LITELLM_HOST_PORT` — host port for LiteLLM (default **4001**; proxied behind UI).
- `GATEWAY_BASIC_MODEL`, `GATEWAY_PREMIUM_MODEL`, `GATEWAY_FALLBACK_MODEL`, `GATEWAY_KIMI_*` — model IDs and Kimi base URL.
- `GATEWAY_REDIS_URL` — classifier cache (default `redis://redis:6379/0` inside Compose).
- `LITELLM_SALT_KEY` — optional LiteLLM salt for key hashing.
- `CF_TUNNEL_TOKEN` — only if you use the **tunnel** profile (see below).

Example skeleton (adjust passwords and keys):

```env
LITELLM_MASTER_KEY=sk-your-long-random-master-secret
POSTGRES_USER=litellm
POSTGRES_PASSWORD=litellm
POSTGRES_DB=litellm
DATABASE_URL=postgresql://litellm:litellm@postgres:5432/litellm

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
MOONSHOT_API_KEY=
```

---

## 2. Start the backend

From the repo root:

```bash
docker compose up -d postgres redis litellm
```

This starts:

- **PostgreSQL** — persistent volume `litellm_pgdata`
- **Redis** — persistent volume `litellm_redisdata`
- **LiteLLM** — OpenAI-compatible API on **`http://127.0.0.1:4001`** (or `LITELLM_HOST_PORT`)

Check logs:

```bash
docker compose logs -f litellm
```

Health: open **`http://127.0.0.1:4001`** in a browser or call your proxy health route if enabled by your LiteLLM version.

**Windows:** Prefer **Docker Desktop**. The **`cloudflared`** service uses **host networking** (Linux-oriented); on Windows, skip the tunnel profile or run Cloudflare Tunnel separately (see below).

---

## 3. Create a virtual API key (for apps / Chat UI)

Use the **master key** only for admin calls — **not** as the day-to-day client key.

**PowerShell** (repo root, set `LITELLM_MASTER_KEY` in your shell or rely on `.env` when using curl from WSL):

```powershell
$env:LITELLM_MASTER_KEY = "sk-your-master-key"
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4000/key/generate" `
  -Headers @{ Authorization = "Bearer $env:LITELLM_MASTER_KEY"; "Content-Type" = "application/json" } `
  -Body (@{
    metadata = @{ key_alias = "my-client" }
    models = @("gateway-basic","gateway-premium","gateway-openai-fallback","gateway-kimi")
    max_budget = 50
    tpm_limit = 100000
    rpm_limit = 500
    max_parallel_requests = 8
  } | ConvertTo-Json -Depth 5)
```

Or use **[`scripts/generate_virtual_key.ps1`](scripts/generate_virtual_key.ps1)** / **[`scripts/generate_virtual_key.sh`](scripts/generate_virtual_key.sh)**.

Copy the returned **`sk-…`** — that is what clients and the **Chat** UI use.

---

## 4. Call the API (OpenAI-compatible)

Point any OpenAI-compatible client at:

- **Base URL:** `http://127.0.0.1:4000` (or your public URL behind a tunnel / reverse proxy)
- **API key:** the **virtual key** from `/key/generate`
- **Chat:** `POST /v1/chat/completions`

Optional JSON body fields used by this gateway:

- `"metadata": { "tier": "basic" }` or `"premium"` — force tier; omit for **auto** (classifier + Redis cache).

The **`model`** field is rewritten by the gateway hooks; you can still send a placeholder name.

---

## 5. Web UI (optional)

The **`web/`** app (**Inference Console**) provides **Workspace** (completions), **Client portal** (`/portal` — SSO / LiteLLM native dashboard entry points), and **Platform admin** (`/admin` — master-key operator tools). See **[`web/README.md`](web/README.md)** for details.

**Local development** (Vite proxies to the API and avoids most CORS issues):

```bash
cd web
npm install
npm run dev
```

Open **`http://127.0.0.1:5173`**. Leave **API base URL** empty in dev so `/v1` and admin routes proxy to **`http://127.0.0.1:4001`** (override with `web/.env` → `VITE_DEV_PROXY_TARGET` if needed).

**Production UI + API with Docker Compose:**

```bash
docker compose up -d --build
```

UI is served on **`http://localhost:4000`** by default (`GATEWAY_UI_PORT`) and proxies API routes to LiteLLM internally, so same-origin calls work without additional CORS setup.

### SSO and LiteLLM native UI (same origin)

1. Set **`PROXY_BASE_URL`** in `.env` to your **public** URL with scheme and **no trailing slash** (for example `https://llm.example.com` — or `http://localhost:4000` for local Compose).
2. In your identity provider, register LiteLLM’s **sign-in redirect URI**  
   **`https://<PROXY_BASE_URL_HOST>/sso/callback`**  
   (for local Compose: **`http://localhost:4000/sso/callback`**).
3. Optional **password fallback** when SSO is on: **`https://<host>/fallback/login`** (LiteLLM route).
4. The gateway **Nginx** container proxies **`/ui`**, **`/sso/*`**, and **`/fallback/*`** to LiteLLM so the dashboard and OAuth redirects match the host users see in the browser.
5. **Cloudflare Tunnel** (or any edge proxy) should target your **public entry port** (default **`GATEWAY_UI_PORT` = 4000**), not the raw LiteLLM port (`LITELLM_HOST_PORT`, default **4001**), unless you intentionally expose LiteLLM alone.

Provider-specific env vars (Google, Microsoft, generic OIDC) are listed as comments in **[`.env.example`](.env.example)**. See also LiteLLM docs: [SSO for Admin UI](https://docs.litellm.ai/docs/proxy/admin_ui_sso).

### Optional SPA build env

- **`VITE_LITELLM_UI_URL`** — override where “Open native dashboard” links (default: same-origin **`/ui`**).
- **`VITE_LITELLM_DIRECT_URL`** — direct LiteLLM host URL for “Direct proxy port” links (default **`http://127.0.0.1:4001`**).

---

## 6. Optional Compose profiles

| Profile | Command | Purpose |
|---------|---------|---------|
| **tunnel** | `docker compose --profile tunnel up -d cloudflared` | Cloudflare Tunnel (`CF_TUNNEL_TOKEN` → `TUNNEL_TOKEN`). Best on **Linux/Pi** with host networking. |

Example full stack with tunnel (Linux):

```bash
docker compose up -d --build
docker compose --profile tunnel up -d cloudflared
```

---

## 7. Tests (optional)

Python dev dependencies:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

Integration tests are skipped unless **`LITELLM_BASE_URL`** and **`LITELLM_TEST_KEY`** are set.

---

## 8. Raspberry Pi tips

- Prefer **arm64** images; first deploy may take time to pull `litellm-database`.
- Pin image **digests** in production if you need reproducible deploys.
- Run **`cloudflared`** with the **tunnel** profile on Pi/Linux where **host** network works as intended.

---

## Project layout (short)

| Path | Role |
|------|------|
| `docker-compose.yml` | Postgres, Redis, LiteLLM, optional cloudflared + static UI |
| `config/proxy_config.yaml` | LiteLLM models, Redis router, fallbacks, callbacks |
| `hooks/` | Guardrails, tier routing, classifier cache, JSON logging |
| `web/` | Inference Console (workspace, client portal, platform admin) |
| `scripts/` | Example `/key/generate` helpers |

---

## Troubleshooting

- **LiteLLM exits / DB errors:** Check `DATABASE_URL` matches Postgres credentials and hostname **`postgres`** inside Compose.
- **401 / key invalid:** Use a **virtual** key for chat; reserve **master** for `/key/*` and admin only.
- **CORS in browser:** Use Vite dev proxy, or configure LiteLLM CORS, or one reverse proxy for UI + API.
- **Admin UI “master key”:** Stored in **browser localStorage** — use only on trusted machines.
- **SSO `redirect_uri` mismatch:** Confirm **`PROXY_BASE_URL`** equals the scheme+host users use, and IdP callbacks include **`/sso/callback`** on that exact host.

For product documentation: under construction.
