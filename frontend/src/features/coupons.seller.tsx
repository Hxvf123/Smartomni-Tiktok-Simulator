import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

interface SellerCoupon {
  id: string;
  title: string;
  promoCode: string;
  status: string;
  discountText: string;
  minSpendVnd: number | null;
  startAt: string;
  endAt: string;
  redemptionLimit: number | null;
  redeemedCount: number;
  audience: string;
}

const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));
const pillClass = (s: string): string => (s === 'ONGOING' ? 'ok' : s === 'DEACTIVATED' || s === 'EXPIRED' ? 'bad' : 'warn');
const isWhole = (v: string): boolean => /^\d+$/.test(v) && Number(v) >= 1;

/**
 * Seller coupon data. These coupons are fake marketplace data created through /demo: TikTok's coupon-creation API is not verified for
 * Vietnam, so the simulator exposes no voucher-creation operation to integrations.
 */
export function SellerCoupons({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: SellerCoupon[] }>(`/demo/shops/${shopId}/coupons`, { demoSession: token }), [shopId, token], 10000);
  const [error, setError] = useState<string>();
  const empty = { title: '', promoCode: '', kind: 'AMOUNT_OFF', value: '', cap: '', minSpend: '', days: '7', limit: '', audience: 'ALL' };
  const [f, setF] = useState(empty);
  const valueOk = isWhole(f.value) && (f.kind === 'AMOUNT_OFF' || Number(f.value) <= 100);
  const valid = f.title.trim() !== '' && /^[A-Za-z0-9]{6,12}$/.test(f.promoCode) && valueOk && isWhole(f.days) && (f.cap === '' || isWhole(f.cap)) && (f.minSpend === '' || isWhole(f.minSpend)) && (f.limit === '' || isWhole(f.limit));

  async function run(fn: () => Promise<unknown>) {
    setError(undefined);
    try {
      await fn();
      list.reload();
    } catch (e) {
      setError(message(e));
    }
  }
  function create() {
    const discount = f.kind === 'AMOUNT_OFF' ? { type: 'AMOUNT_OFF', amountVnd: Number(f.value) } : { type: 'PERCENT_OFF', percentage: Number(f.value), ...(f.cap ? { maxDiscountVnd: Number(f.cap) } : {}) };
    const endAt = new Date(Date.now() + Number(f.days) * 86_400_000).toISOString();
    void run(async () => {
      await api(`/demo/shops/${shopId}/coupons`, {
        method: 'POST',
        demoSession: token,
        body: { title: f.title, promoCode: f.promoCode, discount, endAt, audience: f.audience, ...(f.minSpend ? { minSpendVnd: Number(f.minSpend) } : {}), ...(f.limit ? { redemptionLimit: Number(f.limit) } : {}) },
      });
      setF(empty);
    });
  }

  return (
    <div>
      <p className="muted">Coupons are Seller-created demo data. Buyers type the promo code at checkout; the backend prices the discount.</p>
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No coupons yet. Create one below.">
        {(d) => (
          <table>
            <thead><tr><th>Code</th><th>Title</th><th>Discount</th><th>Min spend</th><th>Used</th><th>Status</th><th /></tr></thead>
            <tbody>
              {d.items.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.promoCode}</strong></td>
                  <td>{c.title}{c.audience === 'NEW' ? <span className="pill">new buyers</span> : null}</td>
                  <td>{c.discountText}</td>
                  <td>{c.minSpendVnd ?? '-'}</td>
                  <td>{c.redeemedCount}{c.redemptionLimit != null ? ` / ${c.redemptionLimit}` : ''}</td>
                  <td><span className={`pill ${pillClass(c.status)}`}>{c.status}</span></td>
                  <td>
                    <button onClick={() => void run(() => api(`/demo/shops/${shopId}/coupons/${c.id}`, { method: 'PATCH', demoSession: token, body: { deactivated: c.status !== 'DEACTIVATED' } }))}>
                      {c.status === 'DEACTIVATED' ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncState>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <h3>New coupon</h3>
        <div className="row-wrap">
          <input aria-label="coupon title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input aria-label="coupon promo code" placeholder="Code (6-12 letters/digits)" maxLength={12} value={f.promoCode} onChange={(e) => setF({ ...f, promoCode: e.target.value.toUpperCase() })} />
          <select aria-label="discount type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="AMOUNT_OFF">Amount off (VND)</option>
            <option value="PERCENT_OFF">Percent off</option>
          </select>
          <input aria-label="discount value" placeholder={f.kind === 'AMOUNT_OFF' ? 'VND' : '1-100'} inputMode="numeric" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          {f.kind === 'PERCENT_OFF' ? <input aria-label="maximum discount" placeholder="Max VND (optional)" inputMode="numeric" value={f.cap} onChange={(e) => setF({ ...f, cap: e.target.value })} /> : null}
        </div>
        <div className="row-wrap">
          <input aria-label="minimum spend" placeholder="Min spend VND (optional)" inputMode="numeric" value={f.minSpend} onChange={(e) => setF({ ...f, minSpend: e.target.value })} />
          <input aria-label="valid days" placeholder="Valid days" inputMode="numeric" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
          <input aria-label="redemption limit" placeholder="Redemption limit (optional)" inputMode="numeric" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
          <select aria-label="audience" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
            <option value="ALL">All buyers</option>
            <option value="NEW">New buyers only</option>
          </select>
          <button type="submit" disabled={!valid}>Create coupon</button>
        </div>
        <p className="muted">Validity starts now on the business clock. Code and discount cannot be changed afterwards.</p>
      </form>
    </div>
  );
}

const tabs: FeatureTab[] = [{ path: 'coupons', label: 'Coupons', order: 60, render: (c) => <SellerCoupons {...c} /> }];
export default tabs;
