import ChatPanel from '../components/assistant/ChatPanel';

export default function Assistant() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🧞</span>
        <div>
          <h1 className="text-xl font-black text-slate-800">DealGenie</h1>
          <p className="text-sm text-slate-500">Your AI shopping assistant — describe what you need and buy fast.</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <ChatPanel variant="page" />
      </div>
    </div>
  );
}
