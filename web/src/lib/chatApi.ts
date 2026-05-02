import { apiUrl } from "./apiBase";
import type { GatewaySettings } from "./storage";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function chatUrl(apiBase: string): string {
  return apiUrl(apiBase, "/v1/chat/completions");
}

function buildBody(
  settings: GatewaySettings,
  messages: ChatMessage[],
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: settings.model || "gateway",
    messages: messages.filter((m) => m.content.trim().length > 0),
    stream: settings.stream,
  };
  if (settings.tier !== "auto") {
    body.metadata = { tier: settings.tier };
  }
  return body;
}

export async function chatCompletion(
  settings: GatewaySettings,
  messages: ChatMessage[],
): Promise<{ content: string; raw?: string }> {
  const res = await fetch(chatUrl(settings.apiBase), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(buildBody(settings, messages)),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return { content, raw: text };
}

export async function chatCompletionStream(
  settings: GatewaySettings,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(chatUrl(settings.apiBase), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({ ...buildBody(settings, messages), stream: true }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const dec = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const piece = json.choices?.[0]?.delta?.content;
        if (piece) onDelta(piece);
      } catch {
        /* ignore partial JSON */
      }
    }
  }
}
