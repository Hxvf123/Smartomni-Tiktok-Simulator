import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { ConsoleTab } from './registry';

interface AdminOrder {
  id: string;
  shopName: string;
  buyerName: string;
  status: string;
  units: number;
  updatedAt: string;
  releaseAt: string | null;
}

// Mirrors backend/src/orders/order-state.ts; the API is the authority and rejects anything not allowed.
const NEXT: Record<string, string[]> = {
  UNPAID: ['ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['AWAITING_SHIPMENT', 'CANCELLED', 'AWAITING_COLLECTION'],
  AWAITING_SHIPMENT: ['PARTIALLY_SHIPPING', 'AWAITING_COLLECTION', 'CANCELLED'],
  PARTIALLY_SHIPPING: ['AWAITING_COLLECTION', 'CANCELLED'],
  AWAITING_COLLECTION: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function OrdersPanel({ shopId }: { shopId: string }) {
  const list = useAsync(() => api<{ items: AdminOrder[] }>(`/test-admin/orders?shopId=${encodeURIComponent(shopId)}`), [shopId], 5000);
  const [msg, setMsg] = useState<string>();
  async function go(id: string, to: string) {
    try {
      await api(`/test-admin/orders/${id}/transition`, { method: 'POST', body: { to, shopId } });
      setMsg(`${id} -> ${to}`);
      list.reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function releaseDue() {
    try {
      const r = await api<{ released: string[] }>('/test-admin/orders/release-due', { method: 'POST', body: {} });
      setMsg(`Released ${r.released.length} held order(s).`);
      list.reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <div>
      <div className="row-wrap">
        <button onClick={() => void releaseDue()}>Release due holds</button>
        <span className="muted">Advance the business clock on the Clock tab first to test the hold boundary. Invalid jumps (for example shipping an ON_HOLD order) are refused by the API.</span>
      </div>
      {msg ? <div className="state state-empty" role="status">{msg}</div> : null}
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No orders for this shop.">
        {(d) => (
          <table>
            <thead><tr><th>Order</th><th>Buyer</th><th>Units</th><th>Status</th><th>Hold until</th><th>Move to</th></tr></thead>
            <tbody>
              {d.items.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.buyerName}</td>
                  <td>{o.units}</td>
                  <td><span className="pill">{o.status}</span></td>
                  <td>{o.releaseAt && o.status === 'ON_HOLD' ? new Date(o.releaseAt).toLocaleString() : ''}</td>
                  <td>{(NEXT[o.status] ?? []).map((to) => <button key={to} onClick={() => void go(o.id, to)}>{to}</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncState>
    </div>
  );
}

const tabs: ConsoleTab[] = [{ path: 'orders', label: 'Orders', order: 10, render: (c) => <OrdersPanel {...c} /> }];
export default tabs;
