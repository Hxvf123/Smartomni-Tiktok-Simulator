import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AsyncState } from '../components/AsyncState';
import { DemoLogin } from '../components/DemoLogin';
import { api } from '../lib/api';
import { useDemoSession } from '../lib/session';
import { useAsync } from '../lib/useAsync';

interface Consent {
  app: { appKey: string; name: string };
  shop: { id: string; name: string; region: string; currency: string };
  scopes: string[];
  redirectUri: string;
  state: string | null;
}

/**
 * Seller consent page (simulator-defined URL: /seller/authorize?app_key=&state=[&redirect_uri=]). The real TikTok
 * authorization URL is unsupported in the contract. The browser never builds the redirect: the API returns the URL
 * (registered redirect URI only, code/error plus the echoed state) and this page just navigates to it.
 */
export function AuthorizePage({ navigate = (url: string) => window.location.assign(url) }: { navigate?: (url: string) => void }) {
  const [params] = useSearchParams();
  const [session, setSession] = useDemoSession('SELLER');
  const appKey = params.get('app_key') ?? '';
  if (!appKey) return <div className="state state-error" role="alert">Missing app_key. Start the connection from SmartOmni.</div>;
  if (!session) {
    return (
      <div>
        <h1>Authorize app</h1>
        <p className="muted">Sign in as the demo seller who owns the shop. This is a simulator identity, not a SmartOmni login.</p>
        <DemoLogin role="SELLER" onSession={setSession} />
      </div>
    );
  }
  return (
    <Consent
      sessionToken={session.sessionToken}
      appKey={appKey}
      state={params.get('state') ?? undefined}
      redirectUri={params.get('redirect_uri') ?? undefined}
      onSignOut={() => setSession(null)}
      navigate={navigate}
    />
  );
}

function Consent(props: { sessionToken: string; appKey: string; state?: string; redirectUri?: string; onSignOut: () => void; navigate: (url: string) => void }) {
  const { sessionToken, appKey, state, redirectUri, navigate } = props;
  const query = new URLSearchParams({ app_key: appKey });
  if (state) query.set('state', state);
  if (redirectUri) query.set('redirect_uri', redirectUri);
  const ctx = useAsync(() => api<Consent>(`/demo/authorization/consent?${query.toString()}`, { demoSession: sessionToken }), [sessionToken, appKey, state, redirectUri]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const decide = async (decision: 'accept' | 'deny') => {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await api<{ redirectUrl: string }>('/demo/authorization/consent', {
        method: 'POST',
        demoSession: sessionToken,
        body: { app_key: appKey, state, redirect_uri: redirectUri, decision },
      });
      navigate(res.redirectUrl);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row">
        <h1>Authorize app</h1>
        <button onClick={props.onSignOut}>Switch seller</button>
      </div>
      {err ? <div className="state state-error" role="alert">{err}</div> : null}
      <AsyncState {...ctx} onRetry={ctx.reload}>
        {(d) => (
          <section className="card">
            <h2>{d.app.name} wants to access your shop</h2>
            <p><strong>{d.shop.name}</strong> <span className="muted">{d.shop.region} / {d.shop.currency}</span></p>
            <h3>Requested permissions</h3>
            {d.scopes.length === 0 ? (
              <p className="muted">No scopes configured for this app.</p>
            ) : (
              <ul>{d.scopes.map((s) => <li key={s}><code>{s}</code></li>)}</ul>
            )}
            <p className="muted">Scope names are simulator placeholders, not TikTok Shop scopes. After you choose, you are sent back to <code>{d.redirectUri}</code>.</p>
            <div className="row-wrap">
              <button disabled={busy} onClick={() => void decide('accept')}>Authorize</button>
              <button disabled={busy} onClick={() => void decide('deny')}>Deny</button>
            </div>
          </section>
        )}
      </AsyncState>
    </div>
  );
}
