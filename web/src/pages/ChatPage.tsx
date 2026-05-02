import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chatCompletion, chatCompletionStream, type ChatMessage } from "../lib/chatApi";
import {
  loadSettings,
  saveSettings,
  type GatewaySettings,
  type TierMode,
} from "../lib/storage";

function tierLabel(t: TierMode): string {
  if (t === "auto") return "Auto (classifier)";
  if (t === "basic") return "Basic";
  return "Premium";
}

export function ChatPage() {
  const [settings, setSettings] = useState<GatewaySettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const canSend = useMemo(
    () => input.trim().length > 0 && settings.apiKey.trim().length > 0 && !busy,
    [input, settings.apiKey, busy],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !settings.apiKey.trim()) return;
    setError(null);
    setBusy(true);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    if (settings.stream) {
      setMessages([...next, { role: "assistant", content: "" }]);
      try {
        let acc = "";
        await chatCompletionStream(settings, next, (chunk) => {
          acc += chunk;
          setMessages([...next, { role: "assistant", content: acc }]);
        });
        if (!acc.trim()) {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant" && !last.content)
              copy[copy.length - 1] = {
                role: "assistant",
                content: "(empty response)",
              };
            return copy;
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages(next);
      } finally {
        setBusy(false);
      }
      return;
    }

    try {
      const { content } = await chatCompletion(settings, next);
      setMessages([...next, { role: "assistant", content: content || "(empty response)" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }, [input, messages, settings]);

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <div className="brand-title">LLM Gateway</div>
            <div className="brand-sub">OpenAI-compatible</div>
          </div>
        </div>

        <label className="field">
          <span className="label">API base URL</span>
          <input
            className="input"
            placeholder="Leave empty in dev → Vite proxy /v1"
            value={settings.apiBase}
            onChange={(e) => setSettings((s) => ({ ...s, apiBase: e.target.value }))}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="label">Virtual API key</span>
          <input
            className="input mono"
            type="password"
            placeholder="sk-…"
            value={settings.apiKey}
            onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="label">Tier</span>
          <select
            className="input"
            value={settings.tier}
            onChange={(e) =>
              setSettings((s) => ({ ...s, tier: e.target.value as TierMode }))
            }
          >
            <option value="auto">Auto (classifier + cache)</option>
            <option value="basic">Basic (DeepSeek)</option>
            <option value="premium">Premium (Claude → GPT‑4o)</option>
          </select>
        </label>

        <label className="field">
          <span className="label">Model field (ignored by gateway)</span>
          <input
            className="input mono"
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
          />
        </label>

        <label className="row">
          <input
            type="checkbox"
            checked={settings.stream}
            onChange={(e) => setSettings((s) => ({ ...s, stream: e.target.checked }))}
          />
          <span>Stream responses</span>
        </label>

        <div className="sidebar-actions">
          <button type="button" className="btn ghost" onClick={clearChat}>
            Clear chat
          </button>
        </div>

        <p className="hint">
          Dev: run <code className="mono">npm run dev</code> with LiteLLM on{" "}
          <code className="mono">127.0.0.1:4000</code> or set{" "}
          <code className="mono">VITE_DEV_PROXY_TARGET</code>. Production: build with{" "}
          <code className="mono">VITE_API_BASE</code> or set full API base above.
        </p>
      </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <h1>Chat</h1>
            <p className="meta">
              Tier: <strong>{tierLabel(settings.tier)}</strong>
              {settings.stream ? " · streaming" : " · non-streaming"}
            </p>
          </div>
        </header>

        {error ? (
          <div className="banner error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="thread">
          {messages.length === 0 ? (
            <div className="empty">
              <h2>Start a conversation</h2>
              <p>Enter your virtual key, choose tier, then type a message.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                <div className="bubble-role">{m.role}</div>
                <div className="bubble-content mono-wrap">{m.content}</div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <footer className="composer">
          <textarea
            className="composer-input"
            rows={3}
            placeholder="Message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) void send();
              }
            }}
            disabled={busy}
          />
          <div className="composer-row">
            <span className="composer-hint">Enter to send · Shift+Enter newline</span>
            <button type="button" className="btn primary" disabled={!canSend} onClick={() => void send()}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
