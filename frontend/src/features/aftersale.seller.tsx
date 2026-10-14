import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { AftersaleView } from './aftersale.buyer';
import type { FeatureTab } from './registry';

interface SellerList {
  items: (AftersaleView & { buyer: { name: string } })[];
  rejectReasons: { name: string; text: string }[];
}

const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));
const OPEN = ['RETURN_OR_REFUND_REQUEST_PENDING', 'BUYER_SHIPPED_ITEM', 'CANCELLATION_REQUEST_PENDING'];

/** Seller: approve or reject cancellation and return requests. Approving a cancellation cancels the order; a return never changes the order status. */
export function SellerAftersale({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<SellerList>(`/demo/shops/${shopId}/aftersale`, { demoSession: token }), [shopId, token], 5000);
  const [error, setError] = useState<string>();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function act(id: string, action: 'approve' | 'reject') {
    setError(undefined);
    try {
      const body = action === 'reject' ? { reason: reasons[id] ?? list.data?.rejectReasons[0]?.name ?? 'OTHER' } : {};
      await api(`/demo/shops/${shopId}/aftersale/${id}/${action}`, { method: 'POST', body, demoSession: token });
      list.reload();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div>
      <p className="muted">A return does not change the order status. Stock is not added back here: the SmartOmni side restocks through its own receipt.</p>
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No cancellation or return requests.">
        {(d) => (
          <table>
            <thead><tr><th>Request</th><th>Order</th><th>Buyer</th><th>Kind</th><th>Items</th><th>Reason</th><th>Status</th><th className="num">Refund</th><th>Decision</th></tr></thead>
            <tbody>
              {d.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.orderId}</td>
                  <td>{r.buyer.name}</td>
                  <td>{r.kind === 'RETURN' ? r.type : r.type === 'CANCEL' ? 'CANCEL (seller/system)' : 'BUYER_CANCEL'}</td>
                  <td>{r.items.map((i) => `${i.quantity}× ${i.productName} (${i.skuName})`).join(', ')}</td>
                  <td>{r.reason}</td>
                  <td><span className="pill">{r.status}</span></td>
                  <td className="num">{vnd(r.refund.totalVnd)}</td>
                  <td>
                    {OPEN.includes(r.status) ? (
                      <>
                        <button onClick={() => void act(r.id, 'approve')}>{r.status === 'BUYER_SHIPPED_ITEM' ? 'Accept package' : 'Approve'}</button>{' '}
                        <select aria-label={`reject reason ${r.id}`} value={reasons[r.id] ?? d.rejectReasons[0]?.name} onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })}>
                          {d.rejectReasons.map((x) => <option key={x.name} value={x.name}>{x.text}</option>)}
                        </select>{' '}
                        <button onClick={() => void act(r.id, 'reject')}>Reject</button>
                      </>
                    ) : null}
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

const tabs: FeatureTab[] = [{ path: 'returns', label: 'Returns', order: 40, render: (c) => <SellerAftersale {...c} /> }];
export default tabs;
