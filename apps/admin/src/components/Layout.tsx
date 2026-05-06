import { Outlet, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/deals', label: 'Deals' },
  { to: '/channels', label: 'Channels' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/affiliate', label: 'Affiliate Config' },
];

export default function Layout() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-5 py-4 text-lg font-bold border-b border-gray-700">DealDost Admin</div>
        <nav className="flex-1 py-4">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition ${
                  isActive ? 'bg-orange-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mx-4 mb-4 text-sm text-gray-400 hover:text-white border border-gray-600 rounded py-2"
        >
          Logout
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
