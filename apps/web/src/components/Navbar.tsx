import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Deal } from '@deals/types';
import { useAuthStore } from '../store/authStore';
import { useDealClick } from '../hooks/useDealClick';

const CATEGORIES = [
  { name: 'Electronics', icon: '💻' },
  { name: 'Kitchen',     icon: '🍳' },
  { name: 'Fashion',     icon: '👗' },
  { name: 'Beauty',      icon: '💄' },
  { name: 'Books',       icon: '📚' },
  { name: 'Grocery',     icon: '🛒' },
  { name: 'Sports',      icon: '⚽' },
  { name: 'Home',        icon: '🏠' },
];

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Deal[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const handleDealClick = useDealClick();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Real-time search: fetch live product results as the user types (debounced).
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/v1/feed/live?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal });
        const json = await res.json();
        const items: Deal[] = json.items ?? [];
        setResults(items);
        setShowResults(true);
      } catch {
        /* aborted or failed — leave previous results */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setShowResults(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function pickItem(item: Deal) {
    setShowResults(false);
    handleDealClick(item._id, item.item_type === 'product' ? 'products' : 'deals');
  }

  return (
    <nav className="bg-slate-900 sticky top-0 z-50 shadow-xl">
      <div className="max-w-6xl mx-auto px-4">
        {/* Top row */}
        <div className="flex items-center gap-3 py-3">
          {/* Logo */}
          <Link to="/" className="shrink-0 flex items-center gap-1.5">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-brand">Deal</span>
              <span className="text-white">Dost</span>
            </span>
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto">
            <div ref={wrapperRef} className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="Search mobiles, shoes, jeans, AC, brands…"
                className="w-full bg-slate-800 text-white placeholder-slate-400 rounded-full px-5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/50 transition pr-10"
                autoComplete="off"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition text-base"
              >
                🔍
              </button>

              {showResults && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                  {/* See all results */}
                  <button
                    type="button"
                    onMouseDown={() => { setShowResults(false); navigate(`/search?q=${encodeURIComponent(query.trim())}`); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-brand font-semibold hover:bg-slate-50 border-b border-slate-100 flex items-center gap-2"
                  >
                    🔍 See all results for “{query.trim()}”
                  </button>

                  {results.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-400 text-center">
                      {loading ? 'Searching…' : 'No matching products.'}
                    </p>
                  ) : (
                    <ul>
                      {results.map((item) => (
                        <li key={item._id}>
                          <button
                            type="button"
                            onMouseDown={() => pickItem(item)}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-3 transition"
                          >
                            <img
                              src={item.image_url}
                              alt=""
                              className="w-10 h-10 object-contain rounded-lg bg-slate-50 shrink-0"
                              loading="lazy"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] text-slate-700 line-clamp-1">{item.product_title}</span>
                              <span className="flex items-center gap-2 mt-0.5">
                                <span className="text-[13px] font-black text-brand">₹{item.price.toLocaleString('en-IN')}</span>
                                <span className="text-[10px] text-slate-400">{item.source}</span>
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </form>

          {/* Auth section */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <span className="hidden sm:flex items-center gap-1.5 text-sm text-slate-300">
                  <span className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[100px] truncate">{user.name}</span>
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-full transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-1.5 rounded-full transition"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="text-sm bg-brand hover:bg-brand-600 text-white font-semibold px-4 py-1.5 rounded-full transition shadow-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Category strip */}
        <div className="overflow-x-auto hide-scrollbar pb-3 -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            <Link
              to="/assistant"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/30 px-3 py-1.5 rounded-full whitespace-nowrap transition"
            >
              🧞 Ask AI
            </Link>
            <Link
              to="/trending"
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-300 hover:text-white bg-orange-500/20 hover:bg-orange-500/30 px-3 py-1.5 rounded-full whitespace-nowrap transition"
            >
              🔥 Trending
            </Link>
            <Link
              to="/price-drops"
              className="flex items-center gap-1.5 text-xs font-semibold text-green-300 hover:text-white bg-green-500/20 hover:bg-green-500/30 px-3 py-1.5 rounded-full whitespace-nowrap transition"
            >
              📉 Price Drops
            </Link>
            {CATEGORIES.map(({ name, icon }) => (
              <Link
                key={name}
                to={`/category/${name}`}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full whitespace-nowrap transition"
              >
                <span>{icon}</span>
                {name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
