import { NavLink, Outlet } from 'react-router-dom';

/** The original simulator shell (topbar + styles.css), still used by the Test Console and the OAuth consent page. */
export function LegacyLayout() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">TikTok Shop Simulator <span className="badge">local / fake data</span></div>
        <nav>
          <NavLink to="/" end>
            Tiptop Shop
          </NavLink>
          <NavLink to="/seller-center">Seller Center</NavLink>
          <NavLink to="/console">Test Console</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
