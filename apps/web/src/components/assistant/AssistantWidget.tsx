import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChatPanel from './ChatPanel';

/**
 * Global floating chat bubble. Mounted once in App. Hidden on the full /assistant
 * page to avoid showing two assistants at once.
 */
export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (location.pathname === '/assistant') return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[min(24rem,calc(100vw-2.5rem))] h-[32rem] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧞</span>
              <span className="font-bold text-sm">DealGenie</span>
            </div>
            <div className="flex items-center gap-1">
              <Link
                to="/assistant"
                onClick={() => setOpen(false)}
                aria-label="Open full page"
                title="Open full page"
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
                </svg>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel variant="panel" />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open shopping assistant'}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-xl flex items-center justify-center text-2xl active:scale-95 transition"
      >
        {open ? '✕' : '🧞'}
      </button>
    </div>
  );
}
