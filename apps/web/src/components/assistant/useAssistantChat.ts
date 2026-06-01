import { useState, useRef, useCallback } from 'react';
import type { Deal } from '@deals/types';
import { streamChat, type ChatMsg } from '../../api/assistant';

export interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  deals?: Deal[];
  error?: boolean;
}

/**
 * Holds the assistant conversation and drives the SSE stream. Each mount is an
 * independent conversation (the floating widget and the /assistant page don't share state).
 */
export function useAssistantChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;

      // History sent to the API = prior turns (with text) + this new question.
      const history: ChatMsg[] = [
        ...messages
          .filter((m) => m.content.trim() && !m.error)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: q },
      ];

      // Optimistically render the user turn and an empty assistant turn to stream into.
      setMessages((prev) => [...prev, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const updateLast = (fn: (m: UiMessage) => UiMessage) => {
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = fn(next[next.length - 1]);
          return next;
        });
      };

      await streamChat(
        history,
        {
          onText: (delta) => updateLast((m) => ({ ...m, content: m.content + delta })),
          onDeals: (deals) => updateLast((m) => ({ ...m, deals })),
          onDone: (deals) => updateLast((m) => ({ ...m, deals: deals.length ? deals : m.deals })),
          onError: (msg) => updateLast((m) => ({ ...m, content: m.content || msg, error: true })),
        },
        controller.signal,
      );

      setLoading(false);
      abortRef.current = null;
    },
    [messages, loading],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setLoading(false);
  }, []);

  return { messages, loading, send, reset };
}
