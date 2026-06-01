import { useEffect, useRef, useState } from 'react';
import DealCard from '../DealCard';
import { useAssistantChat } from './useAssistantChat';

const SUGGESTIONS = [
  'Wireless earbuds under ₹2000',
  'Best air fryer for a small kitchen',
  'Running shoes on Flipkart',
  'Gift ideas under ₹500',
];

interface Props {
  /** `page` gives a taller layout for the full /assistant route; `panel` suits the floating widget. */
  variant?: 'panel' | 'page';
}

export default function ChatPanel({ variant = 'panel' }: Props) {
  const { messages, loading, send } = useAssistantChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput('');
    void send(text);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className={`flex flex-col ${variant === 'page' ? 'h-[calc(100vh-13rem)]' : 'h-full'}`}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {isEmpty && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-2">
            <div className="text-4xl">🧞</div>
            <div>
              <p className="font-bold text-slate-800">Hi, I'm DealGenie</p>
              <p className="text-sm text-slate-500 mt-1">
                Tell me what you want to buy and I'll find the best live deals.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start'}>
            {m.role === 'user' ? (
              <div className="bg-brand text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap">
                {m.content}
              </div>
            ) : (
              <div className="w-full">
                <div
                  className={`inline-block rounded-2xl rounded-bl-sm px-4 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                    m.error ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? <TypingDots /> : null)}
                </div>
                {m.deals && m.deals.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {m.deals.map((d) => (
                      <DealCard key={d._id} deal={d} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="border-t border-slate-100 p-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a product, budget, brand…"
          className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40 transition"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="shrink-0 w-10 h-10 rounded-full bg-brand hover:bg-brand-600 disabled:opacity-40 text-white flex items-center justify-center transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1">
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
    </span>
  );
}
