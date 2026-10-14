import { useState } from 'react';
import { ApiError, api, vnd } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { AsyncState } from './AsyncState';

interface Sku {
  id: string;
  externalId: string;
  sellerSku: string;
  name: string;
  attributeName: string;
  priceVnd: number;
  status: string;
  stock: { warehouseId: string; warehouseName: string; quantity: number }[];
  totalStock: number;
}
interface Product {
  id: string;
  externalId: string;
  title: string;
  description: string;
  status: string;
  skus: Sku[];
}
interface Warehouse {
  externalId: string;
  name: string;
}
interface CatalogResponse {
  warehouses: Warehouse[];
  items: Product[];
}

const STATUSES = ['DRAFT', 'ACTIVATE', 'SELLER_DEACTIVATED'];
const message = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));
const isWholeVnd = (v: string): boolean => /^\d+$/.test(v) && Number(v) >= 1;

/** Seller product management through /demo (not TikTok OpenAPI): create/edit products, per-SKU price and stock, status. */
export function SellerCatalog({ shopId, token }: { shopId: string; token: string }) {
  const catalog = useAsync(() => api<CatalogResponse>(`/demo/shops/${shopId}/catalog`, { demoSession: token }), [shopId, token]);
  const [error, setError] = useState<string>();
  const base = `/demo/shops/${shopId}/catalog`;

  async function run(fn: () => Promise<unknown>) {
    setError(undefined);
    try {
      await fn();
      catalog.reload();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div>
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      <AsyncState {...catalog} onRetry={catalog.reload} isEmpty={(d) => d.items.length === 0} emptyText="No products yet. Create one below.">
        {(d) => (
          <div className="grid">
            {d.items.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                warehouses={d.warehouses}
                onPatchProduct={(body) => run(() => api(`${base}/products/${p.id}`, { method: 'PATCH', body, demoSession: token }))}
                onDelete={() => run(() => api(`${base}/products/${p.id}`, { method: 'DELETE', demoSession: token }))}
                onPatchSku={(skuId, body) => run(() => api(`${base}/skus/${skuId}`, { method: 'PATCH', body, demoSession: token }))}
                onAddSku={(body) => run(() => api(`${base}/products/${p.id}/skus`, { method: 'POST', body, demoSession: token }))}
              />
            ))}
          </div>
        )}
      </AsyncState>
      <NewProduct onCreate={(body) => run(() => api(`${base}/products`, { method: 'POST', body, demoSession: token }))} />
    </div>
  );
}

interface CardProps {
  product: Product;
  warehouses: Warehouse[];
  onPatchProduct: (body: Record<string, unknown>) => void;
  onDelete: () => void;
  onPatchSku: (skuId: string, body: Record<string, unknown>) => void;
  onAddSku: (body: Record<string, unknown>) => void;
}

function ProductCard({ product: p, warehouses, onPatchProduct, onDelete, onPatchSku, onAddSku }: CardProps) {
  const deleted = p.status === 'DELETED';
  const [title, setTitle] = useState(p.title);
  const [variant, setVariant] = useState({ sellerSku: '', name: '', priceVnd: '' });
  const known = STATUSES.includes(p.status);
  return (
    <article className="card" aria-label={`product ${p.externalId}`}>
      <div className="row">
        <h3>{p.title}</h3>
        <span className={`pill ${p.status === 'ACTIVATE' ? 'ok' : deleted ? 'bad' : 'warn'}`}>{p.status}</span>
      </div>
      <p className="muted">product id {p.externalId}</p>
      {!deleted ? (
        <div className="row-wrap">
          <input aria-label="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button disabled={!title.trim() || title === p.title} onClick={() => onPatchProduct({ title })}>Rename</button>
          <select aria-label="status" value={known ? p.status : ''} onChange={(e) => onPatchProduct({ status: e.target.value })}>
            {known ? null : <option value="">{p.status}</option>}
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="danger-btn" onClick={onDelete}>Delete</button>
        </div>
      ) : null}
      <div className="scroll">
        <table>
          <thead><tr><th>Seller SKU</th><th>Variant</th><th className="num">Price</th><th className="num">Stock</th><th /></tr></thead>
          <tbody>
            {p.skus.map((s) => (
              <SkuRow key={`${s.id}:${s.priceVnd}:${s.totalStock}`} sku={s} warehouses={warehouses} disabled={deleted} onPatch={(body) => onPatchSku(s.id, body)} />
            ))}
          </tbody>
        </table>
      </div>
      {!deleted ? (
        <form
          className="row-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            onAddSku({ sellerSku: variant.sellerSku, name: variant.name, priceVnd: Number(variant.priceVnd) });
            setVariant({ sellerSku: '', name: '', priceVnd: '' });
          }}
        >
          <input aria-label="new seller sku" placeholder="Seller SKU" value={variant.sellerSku} onChange={(e) => setVariant({ ...variant, sellerSku: e.target.value })} required />
          <input aria-label="new variant name" placeholder="Variant" value={variant.name} onChange={(e) => setVariant({ ...variant, name: e.target.value })} required />
          <input aria-label="new variant price" placeholder="Price VND" inputMode="numeric" value={variant.priceVnd} onChange={(e) => setVariant({ ...variant, priceVnd: e.target.value })} required />
          <button type="submit" disabled={!isWholeVnd(variant.priceVnd)}>Add variant</button>
        </form>
      ) : null}
    </article>
  );
}

interface SkuRowProps {
  sku: Sku;
  warehouses: Warehouse[];
  disabled: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}

function SkuRow({ sku, warehouses, disabled, onPatch }: SkuRowProps) {
  const [price, setPrice] = useState(String(sku.priceVnd));
  const [stock, setStock] = useState<Record<string, string>>(Object.fromEntries(sku.stock.map((s) => [s.warehouseId, String(s.quantity)])));
  const priceValid = isWholeVnd(price);
  const normal = sku.status === 'NORMAL';
  return (
    <tr>
      <td>{sku.sellerSku}<div className="muted">{sku.externalId}</div></td>
      <td>{sku.name}{normal ? null : <span className="pill warn">{sku.status}</span>}</td>
      <td className="num">
        <input aria-label={`price ${sku.sellerSku}`} size={9} value={price} disabled={disabled} onChange={(e) => setPrice(e.target.value)} />
        <button disabled={disabled || !priceValid || Number(price) === sku.priceVnd} onClick={() => onPatch({ priceVnd: Number(price) })}>Set</button>
        <div className="muted">{priceValid ? vnd(Number(price)) : 'enter a whole VND amount'}</div>
      </td>
      <td className="num">
        {warehouses.map((w) => (
          <label key={w.externalId} title={w.name}>
            <input aria-label={`stock ${sku.sellerSku} ${w.name}`} size={4} value={stock[w.externalId] ?? '0'} disabled={disabled} onChange={(e) => setStock({ ...stock, [w.externalId]: e.target.value })} />
          </label>
        ))}
        <button
          disabled={disabled || Object.values(stock).some((v) => !/^\d+$/.test(v))}
          onClick={() => onPatch({ stock: Object.fromEntries(Object.entries(stock).map(([k, v]) => [k, Number(v)])) })}
        >
          Set
        </button>
      </td>
      <td>
        <button disabled={disabled} onClick={() => onPatch({ status: normal ? 'DEACTIVATED' : 'NORMAL' })}>{normal ? 'Deactivate' : 'Activate'}</button>
      </td>
    </tr>
  );
}

function NewProduct({ onCreate }: { onCreate: (body: Record<string, unknown>) => void }) {
  const empty = { title: '', description: '', sellerSku: '', variant: '', price: '' };
  const [f, setF] = useState(empty);
  const valid = f.title.trim() !== '' && f.sellerSku.trim() !== '' && f.variant.trim() !== '' && isWholeVnd(f.price);
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({ title: f.title, description: f.description, skus: [{ sellerSku: f.sellerSku, name: f.variant, priceVnd: Number(f.price) }] });
        setF(empty);
      }}
    >
      <h3>New product</h3>
      <div className="row-wrap">
        <input aria-label="new product title" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input aria-label="new product description" placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </div>
      <div className="row-wrap">
        <input aria-label="first seller sku" placeholder="Seller SKU" value={f.sellerSku} onChange={(e) => setF({ ...f, sellerSku: e.target.value })} />
        <input aria-label="first variant" placeholder="Variant" value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })} />
        <input aria-label="first price" placeholder="Price VND" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <button type="submit" disabled={!valid}>Create product</button>
      </div>
      <p className="muted">Stock starts at 0 in every warehouse; set it per variant afterwards.</p>
    </form>
  );
}
