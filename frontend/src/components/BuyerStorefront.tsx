import { useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { ApiError, api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { AsyncState } from './AsyncState';

interface BuyerSku {
  id: string;
  name: string;
  attributeName: string;
  priceVnd: number;
  available: boolean;
  stock: number;
}
interface BuyerProduct {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  minPriceVnd: number;
  maxPriceVnd: number;
  skus: BuyerSku[];
}

const priceRange = (p: { minPriceVnd: number; maxPriceVnd: number }): string =>
  p.minPriceVnd === p.maxPriceVnd ? vnd(p.minPriceVnd) : `${vnd(p.minPriceVnd)} - ${vnd(p.maxPriceVnd)}`;

/** Buyer product list and detail. `/buyer/product/:productId` takes the MARKETPLACE product id, so a catalog link opens the right product. */
export function BuyerStorefront({ shopId, token }: { shopId: string; token: string }) {
  return (
    <Routes>
      <Route index element={<ProductList shopId={shopId} token={token} />} />
      <Route path="product/:productId" element={<ProductDetail shopId={shopId} token={token} />} />
    </Routes>
  );
}

function ProductList({ shopId, token }: { shopId: string; token: string }) {
  const list = useAsync(() => api<{ items: BuyerProduct[] }>(`/demo/shops/${shopId}/storefront/products`, { demoSession: token }), [shopId, token]);
  return (
    <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No products are on sale right now.">
      {(d) => (
        <div className="grid">
          {d.items.map((p) => (
            <article key={p.id} className="card">
              <img src={p.imageUrl} alt="" width={120} height={120} />
              <h3><Link to={`/buyer/product/${encodeURIComponent(p.id)}`}>{p.title}</Link></h3>
              <p>{priceRange(p)}</p>
            </article>
          ))}
        </div>
      )}
    </AsyncState>
  );
}

function ProductDetail({ shopId, token }: { shopId: string; token: string }) {
  const { productId = '' } = useParams();
  const detail = useAsync(
    () => api<{ product: BuyerProduct }>(`/demo/shops/${shopId}/storefront/products/${encodeURIComponent(productId)}`, { demoSession: token }),
    [shopId, token, productId],
  );
  const [picked, setPicked] = useState<string>();
  if (detail.error instanceof ApiError && detail.error.status === 404) {
    return <div className="state state-empty">This product is not available in the shop you are signed in to. <Link to="/buyer">Back to the shop</Link></div>;
  }
  return (
    <AsyncState {...detail} onRetry={detail.reload}>
      {({ product }) => {
        const sku = product.skus.find((s) => s.id === picked);
        return (
          <section className="card" aria-label="product detail">
            <Link to="/buyer">Back</Link>
            <h2>{product.title}</h2>
            <img src={product.imageUrl} alt="" width={200} height={200} />
            <p>{product.description}</p>
            <h3>{product.skus[0]?.attributeName ?? 'Variant'}</h3>
            <div className="row-wrap" role="radiogroup" aria-label="SKU">
              {product.skus.map((s) => (
                <button key={s.id} role="radio" aria-checked={picked === s.id} disabled={!s.available} onClick={() => setPicked(s.id)}>
                  {s.name}{s.available ? '' : ' (sold out)'}
                </button>
              ))}
            </div>
            <p aria-live="polite">
              {sku ? <>Selected: <strong>{sku.name}</strong> - {vnd(sku.priceVnd)} ({sku.stock} in stock)</> : `From ${priceRange(product)}. Choose a variant.`}
            </p>
            <p className="muted">Cart and checkout arrive in Phase 05.</p>
          </section>
        );
      }}
    </AsyncState>
  );
}
