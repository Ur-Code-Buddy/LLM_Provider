/**
 * Debug probe: records HTTP status for public origin (Cloudflare + nginx + litellm chain).
 * Appends NDJSON to debug-dbf063.log — run from repo root: node scripts/debug-probe-origin.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(__dirname, "..", "debug-dbf063.log");
const SESSION = "dbf063";

function append(payload) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({ sessionId: SESSION, timestamp: Date.now(), ...payload }) + "\n",
  );
}

async function probe(hypothesisId, url) {
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": "debug-probe-origin/1" },
    });
    const headers = {};
    for (const k of ["server", "cf-ray", "content-type"]) {
      const v = res.headers.get(k);
      if (v) headers[k] = v;
    }
    append({
      runId: "probe1",
      hypothesisId,
      location: "scripts/debug-probe-origin.mjs",
      message: "fetch result",
      data: { url, status: res.status, statusText: res.statusText, headers },
    });
  } catch (e) {
    append({
      runId: "probe1",
      hypothesisId,
      location: "scripts/debug-probe-origin.mjs",
      message: "fetch error",
      data: { url, error: String(e?.message ?? e) },
    });
  }
}

await probe("H1_ui_proxied_to_litellm", "https://llm.mocksite.sbs/ui");
await probe("H2_static_spa_root", "https://llm.mocksite.sbs/");
await probe("H3_optional_health_path", "https://llm.mocksite.sbs/health");
console.log("Appended NDJSON to", LOG);
