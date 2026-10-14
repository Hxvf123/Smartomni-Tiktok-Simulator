import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

interface OrderRow {
  id: string;
  status: string;
  buyer: { name: string };
}
interface Fulfillment {
  orderStatus: string;
  package: { id: string; status: string; trackingNumber: string | null; provider: string } | null;
  canArrange: boolean;
  blockedReason: 'order_on_hold' | 'order_unpaid' | null;
  tracking: { status: string; description: string; at: string }[];
}

const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

function Row({ shopId, token, order, onChanged }: { shopId: string; token: string; order: OrderRow; onChanged: () => void }) {
  const f = useAsync(() => api<Fulfillment>(`/demo/shops/${shopId}/orders/${order.id}/fulfillment`, { demoSession: token }), [shopId, token, order.id, order.status]);
  const [error, setError] = useState<string>();
  const [labelUrl, setLabelUrl] = useState<string>();
  async function act(path: 'arrange-shipment' | 'advance-shipment') {
    setError(undefined);
    try {
      await api(`/demo/shops/${shopId}/orders/${order.id}/${path}`, { method: 'POST', body: {}, demoSession: token });
      onChanged();
      f.reload();
    } catch (e) {
      setError(message(e));
    }
  }
  async function label() {
    setError(undefined);
    try {
      const r = await api<{ url: string }>(`/demo/shops/${shopId}/orders/${order.id}/shipping-label`, { method: 'POST', body: {}, demoSession: token });
      setLabelUrl(r.url);
    } catch (e) {
      setError(message(e));
    }
  }
  const d = f.data;
  const canAdvance = d && ['AWAITING_COLLECTION', 'IN_TRANSIT'].includes(d.orderStatus);
  return (
    <tr>
      <td>{order.id}</td>
      <td>{order.buyer.name}</td>
      <td><span className="pill">{order.status}</span>{d?.package ? <> <span className="pill">pkg {d.package.status}</span></> : null}</td>
      <td>{d?.package?.trackingNumber ?? <span className="muted">-</span>}</td>
      <td>
        {d?.blockedReason === 'order_on_hold' ? <span className="muted">On hold: cannot ship yet</span> : null}
        {d?.blockedReason === 'order_unpaid' ? <span className="muted">Waiting for payment</span> : null}
        {d?.canArrange ? <button onClick={() => void act('arrange-shipment')}>Arrange shipment</button> : null}
        {canAdvance ? <button onClick={() => void act('advance-shipment')}>{d.orderStatus === 'AWAITING_COLLECTION' ? 'Carrier collected' : 'Mark delivered'}</button> : null}
        {d?.package?.trackingNumber ? <button onClick={() => void label()}>Shipping label</button> : null}
        {labelUrl ? <> <a href={labelUrl} target="_blank" rel="noreferrer">Open PDF (test data)</a></> : null}
        {error ? <div className="state state-error" role="alert">{error}</div> : null}
      </td>
    </tr>
  );
}

export function SellerFulfillment({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: OrderRow[] }>(`/demo/shops/${shopId}/orders`, { demoSession: token }), [shopId, token], 5000);
  return (
    <div>
      <p className="muted">Shipping uses fake carriers and PDF labels stamped as test data. A held (ON_HOLD) order cannot be shipped.</p>
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No orders yet.">
        {(d) => (
          <table>
            <thead><tr><th>Order</th><th>Buyer</th><th>Status</th><th>Tracking</th><th>Actions</th></tr></thead>
            <tbody>{d.items.filter((o) => o.status !== 'CANCELLED').map((o) => <Row key={o.id} shopId={shopId} token={token} order={o} onChanged={list.reload} />)}</tbody>
          </table>
        )}
      </AsyncState>
    </div>
  );
}

const tabs: FeatureTab[] = [{ path: 'shipping', label: 'Shipping', order: 20, render: (c) => <SellerFulfillment {...c} /> }];
export default tabs;
