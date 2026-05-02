import { useCallback, useEffect, useMemo, useState } from "react";
import {
  blockKey,
  generateKey,
  globalSpendReport,
  globalSpendReset,
  keyInfo,
  listKeys,
  type AdminContext,
  type KeyRow,
  unblockKey,
  updateKey,
} from "../lib/adminApi";
import {
  loadAdminCredentials,
  loadSettings,
  patchSettings,
  saveAdminCredentials,
  type AdminCredentials,
} from "../lib/storage";

const DEFAULT_MODELS = [
  "gateway-basic",
  "gateway-premium",
  "gateway-openai-fallback",
  "gateway-kimi",
];

function pickStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function metaAlias(row: KeyRow): string {
  const m = row.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const o = m as Record<string, unknown>;
    const a = o.key_alias ?? o.alias ?? o.key_name;
    if (typeof a === "string") return a;
  }
  return pickStr(row.key_alias ?? row.key_name ?? row.alias);
}

function tokenPreview(row: KeyRow): string {
  return pickStr(row.key ?? row.token ?? row.api_key ?? row.token_id);
}

function numOrDash(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim()) return v;
  return "—";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function AdminPage() {
  const [apiBase, setApiBase] = useState(() => loadSettings().apiBase);
  const [admin, setAdmin] = useState<AdminCredentials>(() => loadAdminCredentials());
  const [tab, setTab] = useState<"keys" | "spend" | "danger">("keys");

  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);

  const [genAlias, setGenAlias] = useState("gateway-client");
  const [genModels, setGenModels] = useState(DEFAULT_MODELS.join(", "));
  const [genMaxBudget, setGenMaxBudget] = useState("50");
  const [genBudgetDuration, setGenBudgetDuration] = useState("30d");
  const [genDuration, setGenDuration] = useState("365d");
  const [genTpm, setGenTpm] = useState("100000");
  const [genRpm, setGenRpm] = useState("500");
  const [genParallel, setGenParallel] = useState("8");
  const [genResult, setGenResult] = useState<string | null>(null);

  const [updKey, setUpdKey] = useState("");
  const [updMaxBudget, setUpdMaxBudget] = useState("");
  const [updTpm, setUpdTpm] = useState("");
  const [updRpm, setUpdRpm] = useState("");
  const [updParallel, setUpdParallel] = useState("");
  const [updModels, setUpdModels] = useState("");
  const [updMsg, setUpdMsg] = useState<string | null>(null);

  const [blkKey, setBlkKey] = useState("");
  const [blkMsg, setBlkMsg] = useState<string | null>(null);

  const [infoKey, setInfoKey] = useState("");
  const [infoJson, setInfoJson] = useState<string | null>(null);

  const [spendStart, setSpendStart] = useState(daysAgoISO(30));
  const [spendEnd, setSpendEnd] = useState(todayISO());
  const [spendJson, setSpendJson] = useState<string | null>(null);
  const [spendErr, setSpendErr] = useState<string | null>(null);

  const [resetAck, setResetAck] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const ctx: AdminContext | null = useMemo(() => {
    const mk = admin.masterKey.trim();
    if (!mk) return null;
    return { apiBase, masterKey: mk };
  }, [apiBase, admin.masterKey]);

  useEffect(() => {
    patchSettings({ apiBase });
  }, [apiBase]);

  useEffect(() => {
    saveAdminCredentials(admin);
  }, [admin]);

  const refreshKeys = useCallback(async () => {
    if (!ctx) {
      setKeysError("Enter master key.");
      return;
    }
    setKeysError(null);
    setKeysLoading(true);
    try {
      const rows = await listKeys(ctx);
      setKeys(rows);
    } catch (e) {
      setKeysError(e instanceof Error ? e.message : String(e));
      setKeys([]);
    } finally {
      setKeysLoading(false);
    }
  }, [ctx]);

  useEffect(() => {
    if (tab !== "keys" || !ctx) return;
    void refreshKeys();
  }, [tab, ctx, refreshKeys]);

  const onGenerate = async () => {
    if (!ctx) return;
    setGenResult(null);
    const models = genModels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      metadata: { key_alias: genAlias.trim() || "gateway-client" },
      models: models.length ? models : DEFAULT_MODELS,
      max_budget: Number(genMaxBudget) || 0,
      budget_duration: genBudgetDuration.trim() || undefined,
      duration: genDuration.trim() || undefined,
      tpm_limit: Number(genTpm) || undefined,
      rpm_limit: Number(genRpm) || undefined,
      max_parallel_requests: Number(genParallel) || undefined,
    };
    try {
      const res = await generateKey(ctx, body);
      setGenResult(JSON.stringify(res, null, 2));
      await refreshKeys();
    } catch (e) {
      setGenResult(e instanceof Error ? e.message : String(e));
    }
  };

  const onUpdate = async () => {
    if (!ctx || !updKey.trim()) {
      setUpdMsg("Paste full virtual key (sk-…).");
      return;
    }
    setUpdMsg(null);
    const body: Record<string, unknown> = { key: updKey.trim() };
    if (updMaxBudget.trim()) body.max_budget = Number(updMaxBudget);
    if (updTpm.trim()) body.tpm_limit = Number(updTpm);
    if (updRpm.trim()) body.rpm_limit = Number(updRpm);
    if (updParallel.trim()) body.max_parallel_requests = Number(updParallel);
    if (updModels.trim()) {
      body.models = updModels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    try {
      const res = await updateKey(ctx, body);
      setUpdMsg(JSON.stringify(res, null, 2));
      await refreshKeys();
    } catch (e) {
      setUpdMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const onBlock = async (blocked: boolean) => {
    if (!ctx || !blkKey.trim()) {
      setBlkMsg("Enter key to block/unblock.");
      return;
    }
    setBlkMsg(null);
    try {
      const fn = blocked ? blockKey : unblockKey;
      const res = await fn(ctx, blkKey.trim());
      setBlkMsg(JSON.stringify(res, null, 2));
      await refreshKeys();
    } catch (e) {
      setBlkMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const onInfo = async () => {
    if (!ctx || !infoKey.trim()) return;
    setInfoJson(null);
    try {
      const res = await keyInfo(ctx, infoKey.trim());
      setInfoJson(JSON.stringify(res, null, 2));
    } catch (e) {
      setInfoJson(e instanceof Error ? e.message : String(e));
    }
  };

  const onSpend = async () => {
    if (!ctx) return;
    setSpendErr(null);
    setSpendJson(null);
    try {
      const res = await globalSpendReport(ctx, spendStart, spendEnd);
      setSpendJson(JSON.stringify(res, null, 2));
    } catch (e) {
      setSpendErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onResetSpend = async () => {
    if (!ctx || !resetAck) return;
    setResetMsg(null);
    try {
      const res = await globalSpendReset(ctx);
      setResetMsg(JSON.stringify(res, null, 2));
      setResetAck(false);
      await refreshKeys();
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="admin-root">
      <aside className="admin-side">
        <h1 className="admin-title">Admin</h1>
        <p className="admin-lead">
          Uses your LiteLLM <strong>master key</strong>. Stored only in this browser (localStorage). Do not use on
          shared machines.
        </p>

        <label className="field">
          <span className="label">API base URL</span>
          <input
            className="input mono"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="Empty = dev proxy"
          />
        </label>

        <label className="field">
          <span className="label">Master key</span>
          <input
            className="input mono"
            type="password"
            autoComplete="off"
            value={admin.masterKey}
            onChange={(e) => setAdmin((a) => ({ ...a, masterKey: e.target.value }))}
            placeholder="sk-… (LITELLM_MASTER_KEY)"
          />
        </label>

        <nav className="admin-tabs vertical" aria-label="Admin sections">
          <button type="button" className={`tab ${tab === "keys" ? "on" : ""}`} onClick={() => setTab("keys")}>
            Keys & limits
          </button>
          <button type="button" className={`tab ${tab === "spend" ? "on" : ""}`} onClick={() => setTab("spend")}>
            Spend & tokens
          </button>
          <button type="button" className={`tab ${tab === "danger" ? "on" : ""}`} onClick={() => setTab("danger")}>
            Danger zone
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        {!ctx ? (
          <div className="banner error">Enter your master key to use the admin panel.</div>
        ) : null}

        {tab === "keys" ? (
          <section className="admin-section">
            <div className="section-head">
              <h2>Virtual keys</h2>
              <button type="button" className="btn primary" disabled={keysLoading} onClick={() => void refreshKeys()}>
                {keysLoading ? "Loading…" : "Refresh list"}
              </button>
            </div>
            {keysError ? (
              <div className="banner error" role="alert">
                {keysError}
              </div>
            ) : null}

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Alias</th>
                    <th>Key</th>
                    <th>Spend</th>
                    <th>Max budget</th>
                    <th>TPM</th>
                    <th>RPM</th>
                    <th>Parallel</th>
                    <th>Models</th>
                    <th>Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.length === 0 && !keysLoading ? (
                    <tr>
                      <td colSpan={9} className="muted">
                        No keys (or list empty). Generate one below.
                      </td>
                    </tr>
                  ) : (
                    keys.map((row, i) => {
                      const models = row.models;
                      const modelsStr = Array.isArray(models)
                        ? models.map((m) => String(m)).join(", ")
                        : pickStr(models);
                      return (
                        <tr key={i}>
                          <td>{metaAlias(row) || "—"}</td>
                          <td className="mono">{tokenPreview(row) || "—"}</td>
                          <td>{numOrDash(row.spend)}</td>
                          <td>{numOrDash(row.max_budget)}</td>
                          <td>{numOrDash(row.tpm_limit)}</td>
                          <td>{numOrDash(row.rpm_limit)}</td>
                          <td>{numOrDash(row.max_parallel_requests)}</td>
                          <td className="cell-clip" title={modelsStr}>
                            {modelsStr || "—"}
                          </td>
                          <td className="mono">{pickStr(row.expires) || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="panel-grid">
              <div className="panel">
                <h3>Generate key</h3>
                <label className="field">
                  <span className="label">Alias (metadata.key_alias)</span>
                  <input className="input" value={genAlias} onChange={(e) => setGenAlias(e.target.value)} />
                </label>
                <label className="field">
                  <span className="label">Models (comma-separated)</span>
                  <textarea
                    className="input mono"
                    rows={3}
                    value={genModels}
                    onChange={(e) => setGenModels(e.target.value)}
                  />
                </label>
                <div className="row2">
                  <label className="field">
                    <span className="label">Max budget (USD)</span>
                    <input className="input" value={genMaxBudget} onChange={(e) => setGenMaxBudget(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="label">Budget duration</span>
                    <input
                      className="input mono"
                      value={genBudgetDuration}
                      onChange={(e) => setGenBudgetDuration(e.target.value)}
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="label">Key duration (expiry)</span>
                  <input className="input mono" value={genDuration} onChange={(e) => setGenDuration(e.target.value)} />
                </label>
                <div className="row3">
                  <label className="field">
                    <span className="label">TPM limit</span>
                    <input className="input" value={genTpm} onChange={(e) => setGenTpm(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="label">RPM limit</span>
                    <input className="input" value={genRpm} onChange={(e) => setGenRpm(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="label">Max parallel</span>
                    <input className="input" value={genParallel} onChange={(e) => setGenParallel(e.target.value)} />
                  </label>
                </div>
                <button type="button" className="btn primary" onClick={() => void onGenerate()}>
                  Generate key
                </button>
                {genResult ? <pre className="code-block">{genResult}</pre> : null}
              </div>

              <div className="panel">
                <h3>Update key limits</h3>
                <p className="muted small">
                  Paste the full <code className="mono">sk-</code> secret. Only filled fields are sent to{" "}
                  <code className="mono">/key/update</code>.
                </p>
                <label className="field">
                  <span className="label">Key</span>
                  <input
                    className="input mono"
                    type="password"
                    value={updKey}
                    onChange={(e) => setUpdKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div className="row2">
                  <label className="field">
                    <span className="label">Max budget</span>
                    <input className="input" value={updMaxBudget} onChange={(e) => setUpdMaxBudget(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="label">TPM limit</span>
                    <input className="input" value={updTpm} onChange={(e) => setUpdTpm(e.target.value)} />
                  </label>
                </div>
                <div className="row2">
                  <label className="field">
                    <span className="label">RPM limit</span>
                    <input className="input" value={updRpm} onChange={(e) => setUpdRpm(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="label">Max parallel</span>
                    <input className="input" value={updParallel} onChange={(e) => setUpdParallel(e.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span className="label">Models (comma, optional)</span>
                  <input className="input mono" value={updModels} onChange={(e) => setUpdModels(e.target.value)} />
                </label>
                <button type="button" className="btn primary" onClick={() => void onUpdate()}>
                  Update key
                </button>
                {updMsg ? <pre className="code-block">{updMsg}</pre> : null}
              </div>

              <div className="panel">
                <h3>Block / unblock</h3>
                <label className="field">
                  <span className="label">Key</span>
                  <input
                    className="input mono"
                    type="password"
                    value={blkKey}
                    onChange={(e) => setBlkKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div className="btn-row">
                  <button type="button" className="btn danger" onClick={() => void onBlock(true)}>
                    Block
                  </button>
                  <button type="button" className="btn ghost" onClick={() => void onBlock(false)}>
                    Unblock
                  </button>
                </div>
                {blkMsg ? <pre className="code-block">{blkMsg}</pre> : null}
              </div>

              <div className="panel">
                <h3>Key info (spend / limits)</h3>
                <label className="field">
                  <span className="label">Key</span>
                  <input
                    className="input mono"
                    type="password"
                    value={infoKey}
                    onChange={(e) => setInfoKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <button type="button" className="btn primary" onClick={() => void onInfo()}>
                  Fetch /key/info
                </button>
                {infoJson ? <pre className="code-block">{infoJson}</pre> : null}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "spend" ? (
          <section className="admin-section">
            <h2>Spend report</h2>
            <p className="muted">
              Calls LiteLLM <code className="mono">GET /global/spend/report</code> (master key). Shape depends on
              proxy version.
            </p>
            <div className="row2">
              <label className="field">
                <span className="label">Start date</span>
                <input className="input mono" value={spendStart} onChange={(e) => setSpendStart(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">End date</span>
                <input className="input mono" value={spendEnd} onChange={(e) => setSpendEnd(e.target.value)} />
              </label>
            </div>
            <button type="button" className="btn primary" onClick={() => void onSpend()}>
              Load report
            </button>
            {spendErr ? (
              <div className="banner error" role="alert">
                {spendErr}
              </div>
            ) : null}
            {spendJson ? <pre className="code-block tall">{spendJson}</pre> : null}
          </section>
        ) : null}

        {tab === "danger" ? (
          <section className="admin-section">
            <h2>Danger zone</h2>
            <p className="muted">
              <code className="mono">POST /global/spend/reset</code> — resets spend for <strong>all</strong> keys and
              teams (master key only). Irreversible.
            </p>
            <label className="row">
              <input type="checkbox" checked={resetAck} onChange={(e) => setResetAck(e.target.checked)} />I understand
              this resets all tracked spend.
            </label>
            <button type="button" className="btn danger" disabled={!resetAck} onClick={() => void onResetSpend()}>
              Reset all spend
            </button>
            {resetMsg ? <pre className="code-block">{resetMsg}</pre> : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
