import { NavLink, Route, Routes } from 'react-router-dom';
import { AsyncState } from '../components/AsyncState';
import { DemoLogin } from '../components/DemoLogin';
import { SellerCatalog } from '../components/SellerCatalog';
import { sellerTabs } from '../features/registry';
import { ApiError, api } from '../lib/api';
import { useDemoSession } from '../lib/session';
import { useAsync } from '../lib/useAsync';

interface Me {
  role: string;
  shop: { id: string; name: string; region: string; currency: string; status: string };
}
interface Buyers {
  items: { id: string; name: string; city: string }[];
}

export function SellerPage() {
  const [session, setSession] = useDemoSession('SELLER');
  if (!session) return <DemoLogin role="SELLER" onSession={setSession} />;
  return <SellerHome token={session.sessionToken} shopId={session.shopId} onLogout={() => setSession(null)} />;
}

function SellerHome({ token, shopId, onLogout }: { token: string; shopId: string; onLogout: () => void }) {
  const me = useAsync(() => api<Me>('/demo/me', { demoSession: token }), [token]);
  const buyers = useAsync(() => api<Buyers>(`/demo/shops/${shopId}/buyers`, { demoSession: token }), [token, shopId]);
  const tabs = sellerTabs();
  const expired = me.error instanceof ApiError && me.error.status === 401;
  return (
    <div>
      <div className="row">
        <h1>Seller</h1>
        <button onClick={onLogout}>Sign out</button>
      </div>
      {expired ? <div className="state state-error">Session expired. <button onClick={onLogout}>Sign in again</button></div> : null}
      <AsyncState {...me} onRetry={me.reload}>
        {(d) => (
          <section className="card">
            <h2>{d.shop.name}</h2>
            <p className="muted">{d.shop.region} / {d.shop.currency} / {d.shop.status}</p>
            <p className="muted">Fake data only.</p>
          </section>
        )}
      </AsyncState>
      <nav className="tabs" aria-label="Seller sections">
        <NavLink to="/seller" end>Products</NavLink>
        {tabs.map((t) => <NavLink key={t.path} to={`/seller/${t.path}`}>{t.label}</NavLink>)}
      </nav>
      <Routes>
        {tabs.map((t) => <Route key={t.path} path={`${t.path}/*`} element={t.render({ token, shopId })} />)}
        <Route
          path="*"
          element={
            <>
                    <h2>Products</h2>
                    <SellerCatalog shopId={shopId} token={token} />
                    <h2>Buyers of this shop</h2>
                    <AsyncState {...buyers} onRetry={buyers.reload} isEmpty={(d) => d.items.length === 0} emptyText="No buyers.">
                      {(d) => <ul className="list">{d.items.map((b) => <li key={b.id}>{b.name} <span className="muted">{b.city}</span></li>)}</ul>}
                    </AsyncState>
            </>
          }
        />
      </Routes>
    </div>
  );
}
