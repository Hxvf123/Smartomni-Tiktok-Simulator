import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AuthorizePage } from './pages/AuthorizePage';
import { BuyerPage } from './pages/BuyerPage';
import { ConsolePage } from './pages/ConsolePage';
import { SellerPage } from './pages/SellerPage';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">TikTok Shop Simulator <span className="badge">local / fake data</span></div>
        <nav>
          <NavLink to="/seller">Seller</NavLink>
          <NavLink to="/buyer">Buyer</NavLink>
          <NavLink to="/console">Test Console</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/console" replace />} />
          <Route path="/seller/authorize" element={<AuthorizePage />} />
          <Route path="/seller/*" element={<SellerPage />} />
          <Route path="/buyer/*" element={<BuyerPage />} />
          <Route path="/console/*" element={<ConsolePage />} />
          <Route path="*" element={<div className="state state-empty">Page not found.</div>} />
        </Routes>
      </main>
    </div>
  );
}
