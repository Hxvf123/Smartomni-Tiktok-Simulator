import { NavLink, Outlet } from 'react-router-dom';

/** The original simulator shell (topbar + styles.css) for /buyer, /seller and /console. Removed in Step 13. */
export function LegacyLayout() {
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
        <Outlet />
      </main>
    </div>
  );
}
