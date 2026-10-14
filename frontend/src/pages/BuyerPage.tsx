import { NavLink, Route, Routes } from 'react-router-dom';
import { AsyncState } from '../components/AsyncState';
import { BuyerStorefront } from '../components/BuyerStorefront';
import { DemoLogin } from '../components/DemoLogin';
import { buyerTabs } from '../features/registry';
import { api } from '../lib/api';
import { useDemoSession } from '../lib/session';
import { useAsync } from '../lib/useAsync';

interface Me {
  shop: { id: string; name: string };
  buyer: { id: string; name: string; city: string } | null;
}

export function BuyerPage() {
  const [session, setSession] = useDemoSession('BUYER');
  if (!session) return <DemoLogin role="BUYER" onSession={setSession} />;
  return <BuyerHome token={session.sessionToken} shopId={session.shopId} onLogout={() => setSession(null)} />;
}

function BuyerHome({ token, shopId, onLogout }: { token: string; shopId: string; onLogout: () => void }) {
  const me = useAsync(() => api<Me>('/demo/me', { demoSession: token }), [token]);
  const tabs = buyerTabs();
  return (
    <div>
      <div className="row">
        <h1>Buyer</h1>
        <button onClick={onLogout}>Sign out</button>
      </div>
      <AsyncState {...me} onRetry={me.reload}>
        {(d) => (
          <section className="card">
            <h2>Shopping at {d.shop.name}</h2>
            <p className="muted">Signed in as {d.buyer?.name} ({d.buyer?.city}). Fake data only; payment is simulated.</p>
          </section>
        )}
      </AsyncState>
      <nav className="tabs" aria-label="Buyer sections">
        <NavLink to="/buyer" end>Shop</NavLink>
        {tabs.map((t) => <NavLink key={t.path} to={`/buyer/${t.path}`}>{t.label}</NavLink>)}
      </nav>
      <Routes>
        {tabs.map((t) => <Route key={t.path} path={`${t.path}/*`} element={t.render({ token, shopId })} />)}
        <Route path="*" element={<BuyerStorefront shopId={shopId} token={token} />} />
      </Routes>
    </div>
  );
}
