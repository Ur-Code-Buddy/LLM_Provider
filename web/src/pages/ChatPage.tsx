import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chatCompletion, chatCompletionStream, type ChatMessage } from "../lib/chatApi";
import {
  loadSettings,
  saveSettings,
  type GatewaySettings,
  type TierMode,
} from "../lib/storage";

function tierLabel(t: TierMode): string {
  if (t === "auto") return "Automatic";
  if (t === "basic") return "Standard";
  return "Priority";
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
        <label className="field">
          <span className="label">API base URL</span>
          <input
            className="input"
            placeholder="Optional — leave blank to use the dev proxy (/v1)"
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
            <option value="auto">Automatic — routed with cache</option>
            <option value="basic">Standard tier</option>
            <option value="premium">Priority tier</option>
          </select>
        </label>

        <label className="field">
          <span className="label">Model identifier (optional)</span>
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
          Connection and keys are stored only in this browser. Use a production API base URL when not running the local
          development proxy.
        </p>
      </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <h1>Workspace</h1>
            <p className="meta">
              Routing: <strong>{tierLabel(settings.tier)}</strong>
              {settings.stream ? " · streaming responses" : " · buffered responses"}
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
              <h2>No messages yet</h2>
              <p>Configure your API base URL if required, enter your access key, select a routing tier, then send a message.</p>
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
            <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
            <button type="button" className="btn primary" disabled={!canSend} onClick={() => void send()}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
