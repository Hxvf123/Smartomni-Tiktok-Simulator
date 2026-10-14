import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

export interface AftersaleView {
  id: string;
  orderId: string;
  kind: 'CANCELLATION' | 'RETURN';
  type: string;
  status: string;
  reason: string;
  rejectReason: string | null;
  returnTrackingNumber: string | null;
  refund: { subtotalVnd: number; shippingVnd: number; totalVnd: number };
  updatedAt: string;
  items: { skuId: string; productName: string; skuName: string; quantity: number }[];
}
interface AftersaleList {
  items: AftersaleView[];
  requestReasons: string[];
  rejectReasons: { name: string; text: string }[];
}
interface OrderRow {
  id: string;
  status: string;
  items: { skuId: string; productName: string; skuName: string; quantity: number }[];
}

const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));
const RETURNABLE = ['DELIVERED', 'COMPLETED'];

/** Buyer: request a return/refund for delivered orders and follow cancellation/return requests. /demo only. */
export function BuyerAftersale({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<AftersaleList>(`/demo/shops/${shopId}/aftersale`, { demoSession: token }), [shopId, token], 5000);
  const orders = useAsync(() => api<{ items: OrderRow[] }>(`/demo/shops/${shopId}/orders`, { demoSession: token }), [shopId, token]);
  const [error, setError] = useState<string>();
  const [orderId, setOrderId] = useState('');
  const [sku, setSku] = useState('');
  const [qty, setQty] = useState(1);
  const [type, setType] = useState('REFUND');
  const [reason, setReason] = useState('DAMAGED_ITEM');

  async function run(fn: () => Promise<unknown>) {
    setError(undefined);
    try {
      await fn();
      list.reload();
      orders.reload();
    } catch (e) {
      setError(message(e));
    }
  }
  const eligible = (orders.data?.items ?? []).filter((o) => RETURNABLE.includes(o.status));
  const chosen = eligible.find((o) => o.id === orderId);

  return (
    <div>
      <p className="muted">Returns are for delivered orders. A cancellation request is made from the order page while the order is waiting for shipment.</p>
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      <section className="card" aria-label="request a return">
        <h3>Request a return or refund</h3>
        {eligible.length === 0 ? <p className="muted">No delivered orders yet.</p> : (
          <div className="row-wrap">
            <label>Order
              <select aria-label="return order" value={orderId} onChange={(e) => { setOrderId(e.target.value); setSku(''); }}>
                <option value="">Choose…</option>
                {eligible.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}
              </select>
            </label>
            <label>Item
              <select aria-label="return item" value={sku} onChange={(e) => setSku(e.target.value)} disabled={!chosen}>
                <option value="">Choose…</option>
                {(chosen?.items ?? []).map((i) => <option key={i.skuId} value={i.skuId}>{i.productName} / {i.skuName} (bought {i.quantity})</option>)}
              </select>
            </label>
            <label>Units <input aria-label="return units" type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></label>
            <label>Type
              <select aria-label="return type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="REFUND">Refund only</option>
                <option value="RETURN_AND_REFUND">Return and refund</option>
              </select>
            </label>
            <label>Reason
              <select aria-label="return reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {(list.data?.requestReasons ?? ['OTHER']).map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <button disabled={!orderId || !sku} onClick={() => void run(() => api(`/demo/shops/${shopId}/aftersale/returns`, { method: 'POST', body: { orderId, items: [{ skuId: sku, quantity: qty }], returnType: type, reason }, demoSession: token }))}>Submit request</button>
          </div>
        )}
      </section>
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No cancellation or return requests yet.">
        {(d) => (
          <table>
            <thead><tr><th>Request</th><th>Order</th><th>Kind</th><th>Items</th><th>Status</th><th className="num">Refund</th><th /></tr></thead>
            <tbody>
              {d.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.orderId}</td>
                  <td>{r.kind === 'RETURN' ? r.type : 'CANCELLATION'}</td>
                  <td>{r.items.map((i) => `${i.quantity}× ${i.productName} (${i.skuName})`).join(', ')}</td>
                  <td><span className="pill">{r.status}</span>{r.rejectReason ? <div className="muted">rejected: {r.rejectReason}</div> : null}{r.returnTrackingNumber ? <div className="muted">return tracking {r.returnTrackingNumber}</div> : null}</td>
                  <td className="num">{vnd(r.refund.totalVnd)}</td>
                  <td>
                    {r.kind === 'RETURN' && ['RETURN_OR_REFUND_REQUEST_PENDING', 'AWAITING_BUYER_SHIP'].includes(r.status) ? <button onClick={() => void run(() => api(`/demo/shops/${shopId}/aftersale/${r.id}/cancel`, { method: 'POST', body: {}, demoSession: token }))}>Withdraw</button> : null}{' '}
                    {r.kind === 'RETURN' && r.status === 'AWAITING_BUYER_SHIP' ? <button onClick={() => void run(() => api(`/demo/shops/${shopId}/aftersale/${r.id}/ship-back`, { method: 'POST', body: {}, demoSession: token }))}>I shipped it back</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncState>
    </div>
  );
}

const tabs: FeatureTab[] = [{ path: 'returns', label: 'Returns', order: 40, render: (c) => <BuyerAftersale {...c} /> }];
export default tabs;
