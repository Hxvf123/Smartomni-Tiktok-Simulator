import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

interface OrderRow {
  id: string;
  status: string;
  createdAt: string;
  buyer: { name: string };
  amounts: { totalVnd: number };
  items: { productName: string; skuName: string; quantity: number }[];
}

export function SellerOrders({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: OrderRow[] }>(`/demo/shops/${shopId}/orders`, { demoSession: token }), [shopId, token], 5000);
  const [error, setError] = useState<string>();
  async function cancel(id: string) {
    setError(undefined);
    try {
      await api(`/demo/shops/${shopId}/orders/${id}/cancel`, { method: 'POST', body: { reason: 'Cancelled by seller' }, demoSession: token });
      list.reload();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div>
      <p className="muted">Shipping and returns are handled in later steps. A held order (ON_HOLD) cannot be shipped until the hold period ends.</p>
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No orders yet. Buy something from the Buyer view.">
        {(d) => (
          <table>
            <thead><tr><th>Order</th><th>Buyer</th><th>Items</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
            <tbody>
              {d.items.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.buyer.name}</td>
                  <td>{o.items.map((i) => `${i.quantity}× ${i.productName} (${i.skuName})`).join(', ')}</td>
                  <td className="num">{vnd(o.amounts.totalVnd)}</td>
                  <td><span className="pill">{o.status}</span></td>
                  <td>{['AWAITING_SHIPMENT', 'ON_HOLD', 'UNPAID'].includes(o.status) ? <button onClick={() => void cancel(o.id)}>Cancel</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncState>
    </div>
  );
}

const tabs: FeatureTab[] = [{ path: 'orders', label: 'Orders', order: 10, render: (c) => <SellerOrders {...c} /> }];
export default tabs;
