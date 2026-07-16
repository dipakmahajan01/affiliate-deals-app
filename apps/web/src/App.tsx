import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Category from './pages/Category';
import DigestDeals from './pages/DigestDeals';
import Search from './pages/Search';
import Trending from './pages/Trending';
import PriceDrops from './pages/PriceDrops';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Assistant from './pages/Assistant';
import AssistantWidget from './components/assistant/AssistantWidget';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/category/:name" element={<Category />} />
          <Route path="/digest" element={<DigestDeals />} />
          <Route path="/search" element={<Search />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/price-drops" element={<PriceDrops />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>
      </main>
      <AssistantWidget />
    </div>
  );
}
