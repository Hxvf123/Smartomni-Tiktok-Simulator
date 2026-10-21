import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Store, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/shop/ProductCard';
import { QuantityStepper } from '@/components/shop/QuantityStepper';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { MAX_PER_LINE, type CheckoutState } from '@/lib/checkout';
import { getCart, getMe, listStorefrontProducts, setCartItem } from '@/lib/endpoints';
import { shopPrice } from '@/lib/format';
import type { CartItem, DemoSession } from '@/lib/types';
import { useAsync } from '@/lib/useAsync';
import { cn } from '@/lib/utils';
import { enrichProduct, imageBackgrounds, originalPrice, type EnrichedProduct } from '@/mocks';

const lineTotal = (l: CartItem) => l.unitPriceVnd * l.quantity;

/** Put `line` back where it was (or drop the sku when `line` is undefined), keeping other lines as they are now. */
function restore(lines: CartItem[], skuId: string, line: CartItem | undefined, index: number): CartItem[] {
  const rest = lines.filter((l) => l.skuId !== skuId);
  if (!line) return rest;
  return [...rest.slice(0, index), line, ...rest.slice(index)];
}

function CartLine({
  line,
  product,
  stock,
  selected,
  pending,
  onSelect,
  onQuantity,
}: {
  line: CartItem;
  product: EnrichedProduct | undefined;
  stock: number | undefined;
  selected: boolean;
  pending: boolean;
  onSelect: (on: boolean) => void;
  onQuantity: (n: number) => void;
}) {
  const name = `${line.productTitle} (${line.skuName})`;
  const image = product ?? ({ imageUrl: '', imageBg: imageBackgrounds[0] } as EnrichedProduct);
  const was = product && product.discountPct > 0 ? originalPrice(line.unitPriceVnd, product.discountPct) : null;
  return (
    <li className="flex gap-3 py-4" aria-label={name}>
      <div className="flex w-5 shrink-0 items-center">
        {line.available ? <Checkbox checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label={`Select ${name}`} /> : null}
      </div>
      <Link to={`/product/${encodeURIComponent(line.productId)}`} className={cn('w-20 shrink-0', !line.available && 'opacity-50')}>
        <ProductImage product={image} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className={cn('flex flex-col gap-1.5', !line.available && 'opacity-50')}>
          <Link to={`/product/${encodeURIComponent(line.productId)}`} className="line-clamp-2 text-sm font-medium text-ink hover:underline">
            {line.productTitle}
          </Link>
          <span className="w-fit rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground">{line.skuName}</span>
        </div>
        {line.available ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-buyer">{shopPrice(line.unitPriceVnd)}</span>
              {was ? <span className="text-xs text-muted-2 line-through">{shopPrice(was)}</span> : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <QuantityStepper size="sm" value={line.quantity} max={Math.min(MAX_PER_LINE, stock ?? MAX_PER_LINE)} onChange={onQuantity} disabled={pending} label={`Quantity of ${name}`} />
              <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} disabled={pending} onClick={() => onQuantity(0)} className="text-muted-foreground hover:text-buyer">
                <Trash2 />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-3">
            <span className="rounded bg-surface px-2 py-0.5 text-xs font-semibold text-muted-foreground">No longer available</span>
            <Button variant="outline" size="sm" className="ml-auto" disabled={pending} onClick={() => onQuantity(0)}>
              Remove
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyCart() {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-card border border-dashed border-line p-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-buyer-soft">
        <ShoppingCart className="size-7 text-buyer" />
      </span>
      <p className="text-lg font-semibold">Your cart is empty</p>
      <p className="text-sm text-muted-foreground">Find something you like and add it here.</p>
      <Button asChild className="h-10 bg-buyer px-6 text-white hover:bg-buyer/90">
        <Link to="/">Continue shopping</Link>
      </Button>
    </div>
  );
}

function Cart({ buyer }: { buyer: DemoSession }) {
  const navigate = useNavigate();
  const data = useAsync(async () => {
    const [cart, products, me] = await Promise.all([
      getCart(buyer),
      listStorefrontProducts(buyer).catch(() => null),
      getMe(buyer).catch(() => null),
    ]);
    return { cart, products: products?.items.map(enrichProduct) ?? [], shopName: me?.shop.name ?? 'Shop' };
  }, [buyer.sessionToken]);

  const [lines, setLines] = useState<CartItem[] | null>(null);
  // lines start selected; this holds the ones the buyer unticked
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (data.data) setLines(data.data.cart.items);
  }, [data.data]);

  if (data.loading && !data.data) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Loading cart">
        <Skeleton className="h-8 w-40" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-card" />)}
      </div>
    );
  }
  if (data.error && !data.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <p>Could not load your cart: {data.error.message}</p>
          <Button variant="outline" size="sm" className="mt-1" onClick={data.reload}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!data.data || !lines) return null;

  const { products, shopName } = data.data;
  const productById = new Map(products.map((p) => [p.id, p]));
  const stockBySku = new Map(products.flatMap((p) => p.skus.map((s) => [s.id, s.stock] as const)));

  const selectable = lines.filter((l) => l.available);
  const selected = selectable.filter((l) => !unticked.has(l.skuId));
  const allChecked = selectable.length > 0 && selected.length === selectable.length ? true : selected.length === 0 ? false : 'indeterminate';
  const itemCount = selected.reduce((n, l) => n + l.quantity, 0);
  const total = selected.reduce((n, l) => n + lineTotal(l), 0);

  const tick = (skuId: string, on: boolean) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (on) next.delete(skuId);
      else next.add(skuId);
      return next;
    });
  const tickAll = (on: boolean) => setUnticked(on ? new Set() : new Set(selectable.map((l) => l.skuId)));

  /** Optimistic: show the new quantity now, take the server cart on success, put the line back on failure. */
  const changeQuantity = async (skuId: string, quantity: number) => {
    const index = lines.findIndex((l) => l.skuId === skuId);
    const before = lines[index];
    if (!before) return;
    setLines((cur) => (cur ?? []).flatMap((l) => (l.skuId !== skuId ? [l] : quantity === 0 ? [] : [{ ...l, quantity, lineTotalVnd: l.unitPriceVnd * quantity }])));
    setPending((p) => new Set(p).add(skuId));
    try {
      const cart = await setCartItem(buyer, skuId, quantity);
      setLines(cart.items);
    } catch (e) {
      setLines((cur) => restore(cur ?? [], skuId, before, index));
      toast.error((e as Error).message);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(skuId);
        return next;
      });
    }
  };

  if (lines.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-bold">Cart (0)</h1>
        <EmptyCart />
      </>
    );
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">Cart ({lines.length})</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <label className="flex items-center gap-3 rounded-card bg-white px-4 py-3 text-sm font-semibold shadow-xs ring-1 ring-line-soft">
            <Checkbox checked={allChecked} onCheckedChange={(v) => tickAll(v === true)} disabled={!selectable.length} />
            Select all ({selectable.length})
          </label>
          <section aria-label={shopName} className="rounded-card bg-white px-4 shadow-xs ring-1 ring-line-soft">
            <div className="flex items-center gap-3 border-b border-line-soft py-3">
              <Checkbox checked={allChecked} onCheckedChange={(v) => tickAll(v === true)} disabled={!selectable.length} aria-label={`Select all from ${shopName}`} />
              <Store className="size-4" aria-hidden />
              <span className="text-sm font-semibold">{shopName}</span>
            </div>
            <ul className="divide-y divide-line-soft">
              {lines.map((l) => (
                <CartLine
                  key={l.skuId}
                  line={l}
                  product={productById.get(l.productId)}
                  stock={stockBySku.get(l.skuId)}
                  selected={l.available && !unticked.has(l.skuId)}
                  pending={pending.has(l.skuId)}
                  onSelect={(on) => tick(l.skuId, on)}
                  onQuantity={(n) => changeQuantity(l.skuId, n)}
                />
              ))}
            </ul>
          </section>
        </div>

        <aside className="self-start lg:sticky lg:top-20">
          <section aria-labelledby="summary" className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-xs ring-1 ring-line-soft">
            <h2 id="summary" className="text-lg font-bold">
              Order summary
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items ({itemCount})</dt>
                <dd>{shopPrice(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping · vouchers · tax</dt>
                <dd className="text-muted-foreground">At checkout</dd>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-line-soft pt-3">
                <dt className="font-semibold">Total</dt>
                <dd className="text-xl font-bold text-buyer" data-testid="total">
                  {shopPrice(total)}
                </dd>
              </div>
            </dl>
            <Button
              size="lg"
              className="mt-1 h-12 bg-buyer text-base text-white hover:bg-buyer/90"
              disabled={!selected.length || pending.size > 0}
              onClick={() => navigate('/checkout', { state: { items: selected.map((l) => ({ skuId: l.skuId, quantity: l.quantity })) } satisfies CheckoutState })}
            >
              Check out ({selected.length})
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function CartPage() {
  const { buyer } = useAuth();
  // the route is guarded by RequireRole BUYER
  return buyer ? <Cart key={buyer.sessionToken} buyer={buyer} /> : null;
}
