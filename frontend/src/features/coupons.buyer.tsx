import { Link } from 'react-router-dom';
import { AsyncState } from '../components/AsyncState';
import { api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { FeatureTab } from './registry';

interface BuyerCoupon {
  id: string;
  title: string;
  promoCode: string;
  discountText: string;
  minSpendVnd: number | null;
  endAt: string;
}

export function BuyerCoupons({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: BuyerCoupon[] }>(`/demo/shops/${shopId}/coupons`, { demoSession: token }), [shopId, token], 10000);
  return (
    <section>
      <p className="muted">Type a code in the Cart before checkout. The shop checks the dates, minimum spend and remaining uses when you place the order.</p>
      <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No coupons are available right now.">
        {(d) => (
          <div className="grid">
            {d.items.map((c) => (
              <article key={c.id} className="card" aria-label={`coupon ${c.promoCode}`}>
                <h3>{c.title}</h3>
                <p><strong>{c.promoCode}</strong> · {c.discountText}</p>
                <p className="muted">{c.minSpendVnd != null ? `Min spend ${vnd(c.minSpendVnd)} · ` : ''}until {new Date(c.endAt).toLocaleDateString()}</p>
              </article>
            ))}
          </div>
        )}
      </AsyncState>
      <Link to="/buyer/cart">Go to cart</Link>
    </section>
  );
}

const tabs: FeatureTab[] = [{ path: 'coupons', label: 'Coupons', order: 30, render: (c) => <BuyerCoupons {...c} /> }];
export default tabs;
