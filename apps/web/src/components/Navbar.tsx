import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/v1/feed/suggest?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        const s: string[] = json.suggestions ?? [];
        setSuggestions(s);
        setShowSuggestions(s.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function pickSuggestion(title: string) {
    setQuery(title);
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(title)}`);
  }

  return (
    <nav className="bg-slate-900 sticky top-0 z-50 shadow-xl">
      <div className="max-w-6xl mx-auto px-4">
        {/* Top row */}
        <div className="flex items-center gap-3 py-3">
          {/* Logo */}
          <Link to="/" className="shrink-0 flex items-center gap-1.5">
            <span className="text-2xl font-black tracking-tight">
              <span className="text-brand">Deals</span>
              <span className="text-white">Hub</span>
            </span>
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto">
            <div ref={wrapperRef} className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search deals, products, brands…"
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

              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute top-full mt-1 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onMouseDown={() => pickSuggestion(s)}
                        className="w-full text-left px-5 py-2.5 text-sm text-slate-200 hover:bg-slate-700 truncate flex items-center gap-2"
                      >
                        <span className="text-slate-400">🔍</span>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
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
              to="/trending"
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-300 hover:text-white bg-orange-500/20 hover:bg-orange-500/30 px-3 py-1.5 rounded-full whitespace-nowrap transition"
            >
              🔥 Trending
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
