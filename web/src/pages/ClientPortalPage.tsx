import { liteLlmFallbackLoginUrl, liteLlmNativeUiUrl } from "../lib/liteLlmUi";

/** End-customer workspace — SSO and key management rely on LiteLLM’s native UI when enabled by the operator. */
export function ClientPortalPage() {
  const nativeUi = liteLlmNativeUiUrl();
  const fallbackLogin = liteLlmFallbackLoginUrl();

  return (
    <div className="portal-root">
      <section className="portal-hero">
        <p className="portal-kicker">Client portal</p>
        <h1 className="portal-title">Your API workspace</h1>
        <p className="portal-lead">
          Sign in through your organization SSO (if configured). Manage API keys, models, budgets, and usage in the LiteLLM dashboard on the same hostname you use for completions.
        </p>
      </section>

      <div className="portal-grid">
        <a className="portal-card portal-card-accent" href={nativeUi} target="_blank" rel="noreferrer">
          <h2>Open dashboard</h2>
          <p>LiteLLM interface for keys, spend, invites, teams, and model access.</p>
          <span className="portal-card-cta">{nativeUi}</span>
        </a>
        <a className="portal-card" href={fallbackLogin} target="_blank" rel="noreferrer">
          <h2>Password fallback</h2>
          <p>Use when SSO is enabled but your account still needs credential login.</p>
          <span className="portal-card-cta muted">Fallback route</span>
        </a>
        <div className="portal-card portal-card-plain">
          <h2>OpenAI-compatible API</h2>
          <p>
            Calls use{" "}
            <code className="mono-inline">POST /v1/chat/completions</code> against this site’s hostname. Obtain a virtual key after login.
          </p>
        </div>
      </div>

      <p className="portal-foot muted small">
        If sign-in redirects fail, ask your administrator to verify{" "}
        <code className="mono-inline">PROXY_BASE_URL</code> and SSO callback URLs documented in this repository README.
      </p>
    </div>
  );
}
