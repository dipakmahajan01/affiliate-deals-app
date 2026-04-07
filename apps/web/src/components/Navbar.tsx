import { useState } from 'react';
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
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
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
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search deals, products, brands…"
                className="w-full bg-slate-800 text-white placeholder-slate-400 rounded-full px-5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/50 transition pr-10"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition text-base"
              >
                🔍
              </button>
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
