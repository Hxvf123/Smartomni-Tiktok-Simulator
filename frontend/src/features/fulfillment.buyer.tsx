import { AsyncState } from '../components/AsyncState';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

interface OrderRow {
  id: string;
  status: string;
}
interface Fulfillment {
  package: { status: string; trackingNumber: string | null; provider: string } | null;
  blockedReason: string | null;
  tracking: { description: string; at: string }[];
}

function Timeline({ shopId, token, order }: { shopId: string; token: string; order: OrderRow }) {
  const f = useAsync(() => api<Fulfillment>(`/demo/shops/${shopId}/orders/${order.id}/fulfillment`, { demoSession: token }), [shopId, token, order.id, order.status], 5000);
  return (
    <section className="card" aria-label={`tracking ${order.id}`}>
      <h3>Order {order.id} <span className="pill">{order.status}</span></h3>
      <AsyncState {...f} onRetry={f.reload}>
        {(d) => (
          <>
            {d.package?.trackingNumber ? <p className="muted">{d.package.provider} - tracking {d.package.trackingNumber}</p> : null}
            {d.tracking.length === 0 ? (
              <p className="muted">{d.blockedReason === 'order_on_hold' ? 'Your order is being confirmed. The seller can ship it shortly.' : 'The seller has not shipped this order yet.'}</p>
            ) : (
              <ol className="list">{d.tracking.map((e, i) => <li key={i}><span>{e.description}</span><span className="muted">{new Date(e.at).toLocaleString()}</span></li>)}</ol>
            )}
          </>
        )}
      </AsyncState>
    </section>
  );
}

export function BuyerTracking({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: OrderRow[] }>(`/demo/shops/${shopId}/orders`, { demoSession: token }), [shopId, token], 5000);
  return (
    <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No orders to track yet.">
      {(d) => <div>{d.items.filter((o) => o.status !== 'UNPAID' && o.status !== 'CANCELLED').map((o) => <Timeline key={o.id} shopId={shopId} token={token} order={o} />)}</div>}
    </AsyncState>
  );
}

const tabs: FeatureTab[] = [{ path: 'tracking', label: 'Tracking', order: 30, render: (c) => <BuyerTracking {...c} /> }];
export default tabs;
