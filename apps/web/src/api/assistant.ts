import type { Deal } from '@deals/types';

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamHandlers {
  onText: (delta: string) => void;
  onDeals: (deals: Deal[]) => void;
  onDone: (deals: Deal[]) => void;
  onError: (message: string) => void;
}

function handleFrame(frame: string, h: StreamHandlers) {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length === 0) return;

  let payload: { delta?: string; deals?: Deal[]; message?: string };
  try {
    payload = JSON.parse(dataLines.join('\n'));
  } catch {
    return;
  }

  switch (event) {
    case 'text':
      h.onText(payload.delta ?? '');
      break;
    case 'deals':
      h.onDeals(payload.deals ?? []);
      break;
    case 'done':
      h.onDone(payload.deals ?? []);
      break;
    case 'error':
      h.onError(payload.message ?? 'Assistant error.');
      break;
  }
}

/**
 * POST the conversation to the assistant and consume the SSE stream.
 * Vite proxies `/v1` → the API in dev. Resolves when the stream ends.
 */
export async function streamChat(
  messages: ChatMsg[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/v1/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') handlers.onError('Network error — please try again.');
    return;
  }

  if (!res.ok || !res.body) {
    let msg = 'Assistant unavailable.';
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    handlers.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (frame.trim()) handleFrame(frame, handlers);
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') handlers.onError('Connection interrupted.');
  }
}
