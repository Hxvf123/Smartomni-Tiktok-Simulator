import { useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

interface CartLine {
  skuId: string;
  productTitle: string;
  skuName: string;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
  available: boolean;
}
interface Cart {
  items: CartLine[];
  totalVnd: number;
}
interface OrderView {
  id: string;
  status: string;
  createdAt: string;
  releaseAt: string | null;
  cancelReason: string | null;
  recipient: { name: string; addressLine: string; district: string; city: string };
  amounts: { productTotalVnd: number; sellerDiscountVnd: number; platformDiscountVnd: number; subTotalVnd: number; shippingFeeVnd: number; taxVnd: number; totalVnd: number };
  items: { skuId: string; productName: string; skuName: string; quantity: number; unitPriceVnd: number }[];
}

const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

/** A new key per "checkout attempt" screen; retrying the same attempt reuses it so a double submit cannot create two orders. */
const newKey = (): string => `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function CartPage({ shopId, token }: { shopId: string; token: string }) {
  const cart = useAsync(() => api<Cart>(`/demo/shops/${shopId}/cart`, { demoSession: token }), [shopId, token]);
  const [error, setError] = useState<string>();
  const [attemptKey, setAttemptKey] = useState(newKey);
  const [placed, setPlaced] = useState<OrderView>();
  const [busy, setBusy] = useState(false);

  async function setQty(skuId: string, quantity: number) {
    setError(undefined);
    try {
      await api(`/demo/shops/${shopId}/cart/items`, { method: 'PUT', body: { skuId, quantity }, demoSession: token });
      cart.reload();
    } catch (e) {
      setError(message(e));
    }
  }
  async function checkout() {
    setError(undefined);
    setBusy(true);
    try {
      const r = await api<{ order: OrderView }>(`/demo/shops/${shopId}/checkout`, { method: 'POST', body: { checkoutKey: attemptKey }, demoSession: token });
      setPlaced(r.order);
      setAttemptKey(newKey());
      cart.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function pay(orderId: string) {
    setError(undefined);
    try {
      const r = await api<{ order: OrderView }>(`/demo/shops/${shopId}/orders/${orderId}/pay`, { method: 'POST', body: {}, demoSession: token });
      setPlaced(r.order);
    } catch (e) {
      setError(message(e));
    }
  }

  if (placed) {
    return (
      <section className="card" aria-label="order placed">
        <h2>Order {placed.id}</h2>
        <p>Status: <span className="pill">{placed.status}</span></p>
        <p>Total: <strong>{vnd(placed.amounts.totalVnd)}</strong> <span className="muted">(items {vnd(placed.amounts.subTotalVnd)} + shipping {vnd(placed.amounts.shippingFeeVnd)})</span></p>
        {placed.status === 'UNPAID' ? <button onClick={() => void pay(placed.id)}>Pay now (fake payment)</button> : <p className="muted">Paid. The order is on hold briefly before the seller can ship it.</p>}
        {error ? <div className="state state-error" role="alert">{error}</div> : null}
        <p><Link to={`/buyer/orders/${placed.id}`}>View order</Link> · <button onClick={() => setPlaced(undefined)}>Keep shopping</button></p>
      </section>
    );
  }
  return (
    <section>
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      <AsyncState {...cart} onRetry={cart.reload} isEmpty={(d) => d.items.length === 0} emptyText="Your cart is empty. Pick a variant on a product page and add it.">
        {(d) => (
          <div className="card">
            <table>
              <thead><tr><th>Item</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th><th /></tr></thead>
              <tbody>
                {d.items.map((i) => (
                  <tr key={i.skuId}>
                    <td>{i.productTitle} <span className="muted">{i.skuName}</span>{i.available ? null : <span className="pill bad">not available</span>}</td>
                    <td className="num">{vnd(i.unitPriceVnd)}</td>
                    <td className="num">
                      <button aria-label={`decrease ${i.skuName}`} onClick={() => void setQty(i.skuId, i.quantity - 1)}>-</button> {i.quantity}{' '}
                      <button aria-label={`increase ${i.skuName}`} disabled={i.quantity >= 20} onClick={() => void setQty(i.skuId, i.quantity + 1)}>+</button>
                    </td>
                    <td className="num">{vnd(i.lineTotalVnd)}</td>
                    <td><button onClick={() => void setQty(i.skuId, 0)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Items total: <strong>{vnd(d.totalVnd)}</strong> <span className="muted">Shipping is added at checkout.</span></p>
            <button disabled={busy || d.items.some((i) => !i.available)} onClick={() => void checkout()}>Checkout</button>
          </div>
        )}
      </AsyncState>
    </section>
  );
}

export function OrdersPage({ shopId, token }: { shopId: string; token: string }) {
  return (
    <Routes>
      <Route index element={<OrderList shopId={shopId} token={token} />} />
      <Route path=":orderId" element={<OrderDetail shopId={shopId} token={token} />} />
    </Routes>
  );
}

function OrderList({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: OrderView[] }>(`/demo/shops/${shopId}/orders`, { demoSession: token }), [shopId, token], 5000);
  return (
    <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No orders yet.">
      {(d) => (
        <table>
          <thead><tr><th>Order</th><th>Status</th><th className="num">Total</th><th>Placed</th></tr></thead>
          <tbody>
            {d.items.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/buyer/orders/${o.id}`}>{o.id}</Link></td>
                <td><span className="pill">{o.status}</span></td>
                <td className="num">{vnd(o.amounts.totalVnd)}</td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AsyncState>
  );
}

function OrderDetail({ shopId, token }: { shopId: string; token: string }) {
  const { orderId = '' } = useParams();
  const detail = useAsync(() => api<{ order: OrderView; history: { from: string | null; to: string; actor: string; at: string }[] }>(`/demo/shops/${shopId}/orders/${orderId}`, { demoSession: token }), [shopId, token, orderId], 5000);
  const [error, setError] = useState<string>();
  async function act(path: 'pay' | 'cancel') {
    setError(undefined);
    try {
      await api(`/demo/shops/${shopId}/orders/${orderId}/${path}`, { method: 'POST', body: path === 'cancel' ? { reason: 'Cancelled by buyer' } : {}, demoSession: token });
      detail.reload();
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <AsyncState {...detail} onRetry={detail.reload}>
      {({ order, history }) => (
        <section className="card" aria-label="order detail">
          <Link to="/buyer/orders">Back</Link>
          <h2>Order {order.id} <span className="pill">{order.status}</span></h2>
          {error ? <div className="state state-error" role="alert">{error}</div> : null}
          <table>
            <tbody>
              {order.items.map((i) => <tr key={i.skuId}><td>{i.productName} <span className="muted">{i.skuName}</span></td><td className="num">{i.quantity} × {vnd(i.unitPriceVnd)}</td></tr>)}
              <tr><td>Items</td><td className="num">{vnd(order.amounts.subTotalVnd)}</td></tr>
              <tr><td>Shipping</td><td className="num">{vnd(order.amounts.shippingFeeVnd)}</td></tr>
              <tr><td>Tax</td><td className="num">{vnd(order.amounts.taxVnd)}</td></tr>
              <tr><td><strong>Total</strong></td><td className="num"><strong>{vnd(order.amounts.totalVnd)}</strong></td></tr>
            </tbody>
          </table>
          <p className="muted">Ship to {order.recipient.name}, {order.recipient.addressLine}, {order.recipient.district}, {order.recipient.city}</p>
          {order.status === 'UNPAID' ? <button onClick={() => void act('pay')}>Pay now (fake payment)</button> : null}{' '}
          {order.status === 'UNPAID' || order.status === 'ON_HOLD' ? <button onClick={() => void act('cancel')}>Cancel order</button> : null}
          {order.status === 'AWAITING_SHIPMENT' && !('buyerRequestedCancel' in order && (order as { buyerRequestedCancel?: boolean }).buyerRequestedCancel) ? <button onClick={() => void act('cancel')}>Request cancellation</button> : null}
          <h3>History</h3>
          <ul className="list">{history.map((h, i) => <li key={i}><span>{h.from ?? 'new'} → {h.to}</span><span className="muted">{h.actor} · {new Date(h.at).toLocaleString()}</span></li>)}</ul>
        </section>
      )}
    </AsyncState>
  );
}

const tabs: FeatureTab[] = [
  { path: 'cart', label: 'Cart', order: 10, render: (c) => <CartPage {...c} /> },
  { path: 'orders', label: 'Orders', order: 20, render: (c) => <OrdersPage {...c} /> },
];
export default tabs;
