# LLM Gateway UI

React + Vite client for the LiteLLM proxy:

- **Chat** (`/`) — OpenAI-compatible `POST /v1/chat/completions`, **tier** via `metadata` (`auto` / `basic` / `premium`), **streaming**, virtual key.
- **Admin** (`/admin`) — master-key panel: list keys, **generate** / **update** limits (`/key/generate`, `/key/update`), **block/unblock**, **`/key/info`**, **`/global/spend/report`**, and **reset all spend** (`/global/spend/reset`). Credentials stay in **browser localStorage** (never commit real keys).

In **dev**, Vite proxies **`/v1`**, **`/key`**, **`/user`**, **`/team`**, **`/global`**, **`/customer`**, **`/organization`** to `VITE_DEV_PROXY_TARGET` (default `http://127.0.0.1:4000`) so the admin UI can call LiteLLM admin routes without CORS.

## Local development

1. Start the gateway (e.g. `docker compose up -d` for Postgres/Redis/LiteLLM on port 4000).
2. From this directory:

```bash
npm install
npm run dev
```

3. Open `http://127.0.0.1:5173`. Leave **API base URL** empty so the Vite dev server proxies `/v1` → `http://127.0.0.1:4000` (override with `VITE_DEV_PROXY_TARGET` in `.env` if needed).
4. Paste a **virtual API key** (`sk-…`) from `/key/generate`, then chat.

## Production build

Point the UI at your public proxy URL at **build** time (or set full **API base URL** in the sidebar after build if you use same-origin hosting):

```bash
npm run build
# optional:
# VITE_API_BASE=https://your-tunnel.example.com npm run build
```

Serve the `dist/` folder with any static host. If the UI and API are on different origins, configure CORS on LiteLLM or put both behind one reverse proxy.

## Docker (static)

From the repo root, build the UI then start the optional Nginx service (profile `ui`):

```bash
cd web && npm install && npm run build && cd ..
docker compose --profile ui up -d gateway-ui
```

Open `http://localhost:8080` (or `GATEWAY_UI_PORT`). Set **API base URL** in the sidebar to `http://localhost:4000` (or your tunnel URL) and paste your virtual key — the browser calls the API directly, so CORS must be allowed on the proxy for that origin, or use a single host that reverse-proxies both `/` and `/v1`.
