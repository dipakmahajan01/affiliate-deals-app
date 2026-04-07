import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DealsManager from './pages/DealsManager';
import ChannelManager from './pages/ChannelManager';
import Analytics from './pages/Analytics';
import AffiliateConfig from './pages/AffiliateConfig';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="deals" element={<DealsManager />} />
        <Route path="channels" element={<ChannelManager />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="affiliate" element={<AffiliateConfig />} />
      </Route>
    </Routes>
  );
}
