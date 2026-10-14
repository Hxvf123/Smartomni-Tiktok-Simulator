import { useState } from 'react';
import { api } from '../lib/api';
import type { DemoSession } from '../lib/session';
import { useAsync } from '../lib/useAsync';
import { AsyncState } from './AsyncState';

interface Identities {
  sellers: { id: string; name: string; shops: { id: string; name: string }[] }[];
  buyers: { id: string; name: string; shopId: string }[];
}

/** "Sign in as" picker for demo identities. This is NOT a TikTok or SmartOmni login. */
export function DemoLogin({ role, onSession }: { role: 'SELLER' | 'BUYER'; onSession: (s: DemoSession) => void }) {
  const ids = useAsync(() => api<Identities>('/demo/identities'), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const login = async (body: unknown) => {
    setBusy(true);
    setErr(undefined);
    try {
      onSession(await api<DemoSession>('/demo/sessions', { method: 'POST', body }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>Choose a demo {role === 'SELLER' ? 'seller' : 'buyer'}</h2>
      <p className="muted">Demo identities are fake. Each session can only see its own shop.</p>
      {err ? <div className="state state-error" role="alert">{err}</div> : null}
      <AsyncState
        {...ids}
        onRetry={ids.reload}
        isEmpty={(d) => (role === 'SELLER' ? d.sellers.length === 0 : d.buyers.length === 0)}
        emptyText="No demo identities yet. Open the Test Console and run Seed."
      >
        {(d) => (
          <ul className="list">
            {role === 'SELLER'
              ? d.sellers.map((s) => (
                  <li key={s.id}>
                    <span>{s.name} <span className="muted">- {s.shops.map((x) => x.name).join(', ')}</span></span>
                    <button disabled={busy} onClick={() => login({ role: 'SELLER', sellerId: s.id })}>Sign in</button>
                  </li>
                ))
              : d.buyers.map((b) => (
                  <li key={b.id}>
                    <span>{b.name}</span>
                    <button disabled={busy} onClick={() => login({ role: 'BUYER', buyerId: b.id })}>Sign in</button>
                  </li>
                ))}
          </ul>
        )}
      </AsyncState>
    </section>
  );
}
