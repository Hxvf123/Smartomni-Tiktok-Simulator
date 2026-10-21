import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, MapPin, ShieldCheck, Store, Ticket, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { ProductImage } from '@/components/shop/ProductCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CheckoutState } from '@/lib/checkout';
import { checkout, getCart, getMe, listStorefrontProducts, payOrder, setCartItem } from '@/lib/endpoints';
import { shopPrice } from '@/lib/format';
import type { CartItem, DemoSession, Order, OrderAmounts, Recipient } from '@/lib/types';
import { useAsync } from '@/lib/useAsync';
import { enrichProduct, imageBackgrounds, type EnrichedProduct } from '@/mocks';

const MESSAGE_MAX = 500;
const ITEM_ERRORS = ['insufficient_stock', 'not_for_sale', 'unknown_sku', 'invalid_quantity', 'too_many_units', 'empty_order'];

/** Idempotency key for POST checkout (8-100 chars), one per checkout attempt. */
export function newCheckoutKey(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `web-${random}`;
}

/** Limits from the checkout `recipient` schema in docs/openapi.json. */
const recipientFields: { key: keyof Recipient; label: string; min: number; max: number; autoComplete: string }[] = [
  { key: 'name', label: 'Full name', min: 1, max: 200, autoComplete: 'name' },
  { key: 'phone', label: 'Phone', min: 5, max: 30, autoComplete: 'tel' },
  { key: 'addressLine', label: 'Address line', min: 1, max: 300, autoComplete: 'street-address' },
  { key: 'district', label: 'District', min: 1, max: 100, autoComplete: 'address-level3' },
  { key: 'city', label: 'City', min: 1, max: 100, autoComplete: 'address-level2' },
  { key: 'postalCode', label: 'Postal code (optional)', min: 0, max: 20, autoComplete: 'postal-code' },
];

export function validateRecipient(r: Partial<Record<keyof Recipient, string>>): Partial<Record<keyof Recipient, string>> {
  const errors: Partial<Record<keyof Recipient, string>> = {};
  for (const f of recipientFields) {
    const v = (r[f.key] ?? '').trim();
    if (v.length < f.min) errors[f.key] = f.min === 1 ? 'Required.' : `At least ${f.min} characters.`;
    else if (v.length > f.max) errors[f.key] = `At most ${f.max} characters.`;
  }
  return errors;
}

function AddressDialog({ open, initial, onOpenChange, onSave }: { open: boolean; initial: Recipient | null; onOpenChange: (o: boolean) => void; onSave: (r: Recipient) => void }) {
  const [draft, setDraft] = useState<Partial<Record<keyof Recipient, string>>>(() => ({ ...initial, postalCode: initial?.postalCode ?? '' }));
  const [errors, setErrors] = useState<Partial<Record<keyof Recipient, string>>>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateRecipient(draft);
    setErrors(found);
    if (Object.keys(found).length) return;
    const t = (k: keyof Recipient) => (draft[k] ?? '').trim();
    onSave({ name: t('name'), phone: t('phone'), addressLine: t('addressLine'), district: t('district'), city: t('city'), postalCode: t('postalCode') || null });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-sans sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shipping address</DialogTitle>
          <DialogDescription>Used for this order only.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
          {recipientFields.map((f) => (
            <div key={f.key} className={f.key === 'addressLine' || f.key === 'name' ? 'flex flex-col gap-1.5 sm:col-span-2' : 'flex flex-col gap-1.5'}>
              <Label htmlFor={`recipient-${f.key}`}>{f.label}</Label>
              <Input
                id={`recipient-${f.key}`}
                value={draft[f.key] ?? ''}
                maxLength={f.max}
                autoComplete={f.autoComplete}
                aria-invalid={errors[f.key] ? true : undefined}
                aria-describedby={errors[f.key] ? `recipient-${f.key}-error` : undefined}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
              {errors[f.key] ? (
                <span id={`recipient-${f.key}-error`} className="text-xs text-destructive">
                  {errors[f.key]}
                </span>
              ) : null}
            </div>
          ))}
          <DialogFooter className="mt-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-buyer text-white hover:bg-buyer/90">
              Save address
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card bg-white p-5 shadow-xs ring-1 ring-line-soft">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-destructive">
      {children}
    </p>
  );
}

function PaymentDetails({ productTotal, amounts }: { productTotal: number; amounts: OrderAmounts | null }) {
  const later = <span className="text-muted-foreground">Calculated at order</span>;
  const rows: [string, ReactNode][] = [
    ['Product total', shopPrice(amounts?.productTotalVnd ?? productTotal)],
    ['Seller discount', amounts ? `-${shopPrice(amounts.sellerDiscountVnd)}` : later],
    ['Platform discount', amounts ? `-${shopPrice(amounts.platformDiscountVnd)}` : later],
    ['Shipping fee', amounts ? shopPrice(amounts.shippingFeeVnd) : later],
    ['Tax', amounts ? shopPrice(amounts.taxVnd) : later],
  ];
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between border-t border-line-soft pt-3">
        <dt className="font-semibold">{amounts ? 'Total' : 'Estimated total'}</dt>
        <dd className="text-xl font-bold text-buyer" data-testid="total">
          {shopPrice(amounts?.totalVnd ?? productTotal)}
        </dd>
      </div>
    </dl>
  );
}

interface Line extends CartItem {
  product: EnrichedProduct | undefined;
}

function Checkout({ buyer }: { buyer: DemoSession }) {
  const navigate = useNavigate();
  const wanted = (useLocation().state as CheckoutState | null)?.items;
  const data = useAsync(async () => {
    const [cart, products, me] = await Promise.all([getCart(buyer), listStorefrontProducts(buyer).catch(() => null), getMe(buyer).catch(() => null)]);
    return { cart, products: products?.items.map(enrichProduct) ?? [], me };
  }, [buyer.sessionToken]);

  const [key] = useState(newCheckoutKey);
  const [address, setAddress] = useState<Recipient | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [coupon, setCoupon] = useState('');
  const [errors, setErrors] = useState<{ coupon?: string; items?: string; general?: string }>({});
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);

  if (data.loading && !data.data) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" role="status" aria-label="Loading checkout">
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-card" />)}
        </div>
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  }
  if (data.error && !data.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <p>Could not load checkout: {data.error.message}</p>
          <Button variant="outline" size="sm" className="mt-1" onClick={data.reload}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!data.data) return null;

  const { cart, products, me } = data.data;
  const productById = new Map(products.map((p) => [p.id, p]));
  const cartBySku = new Map(cart.items.map((l) => [l.skuId, l]));
  const lines: Line[] = (wanted ?? cart.items.filter((l) => l.available).map((l) => ({ skuId: l.skuId, quantity: l.quantity })))
    .flatMap((w) => {
      const l = cartBySku.get(w.skuId);
      return l ? [{ ...l, quantity: w.quantity, lineTotalVnd: l.unitPriceVnd * w.quantity, product: productById.get(l.productId) }] : [];
    });
  const productTotal = lines.reduce((n, l) => n + l.lineTotalVnd, 0);
  const shopName = me?.shop.name ?? 'Shop';
  const placed = order !== null;

  if (!lines.length && !placed) {
    return (
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-card border border-dashed border-line p-12 text-center">
        <p className="text-lg font-semibold">Nothing to check out</p>
        <Button asChild variant="outline">
          <Link to="/cart">Back to cart</Link>
        </Button>
      </div>
    );
  }

  const place = async () => {
    setPlacing(true);
    setErrors({});
    try {
      const r = await checkout(buyer, {
        checkoutKey: key,
        items: lines.map((l) => ({ skuId: l.skuId, quantity: l.quantity })),
        ...(address ? { recipient: address } : {}),
        ...(message.trim() ? { buyerMessage: message.trim() } : {}),
        ...(coupon.trim() ? { couponCode: coupon.trim() } : {}),
      });
      setOrder(r.order);
      if (!r.replayed) {
        // `items` was sent, so the API keeps the cart: take the bought quantities out of it
        for (const l of lines) {
          const inCart = cartBySku.get(l.skuId)?.quantity ?? 0;
          await setCartItem(buyer, l.skuId, Math.max(0, inCart - l.quantity)).catch(() => undefined);
        }
      }
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      const text = (e as Error).message;
      if (code?.startsWith('coupon_')) setErrors({ coupon: text });
      else if (code && ITEM_ERRORS.includes(code)) setErrors({ items: text });
      else setErrors({ general: text });
    } finally {
      setPlacing(false);
    }
  };

  const pay = async () => {
    if (!order) return;
    setPaying(true);
    try {
      await payOrder(buyer, order.id);
      toast.success('Payment successful (simulated)');
      navigate('/account/orders');
    } catch (e) {
      setErrors({ general: (e as Error).message });
      setPaying(false);
    }
  };

  const recipient = order?.recipient ?? address;
  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">Checkout</h1>
      {placed ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-card bg-teal-soft px-5 py-4 text-ink" role="status">
          <CheckCircle2 className="size-6 text-free-ship" aria-hidden />
          <div className="flex flex-col">
            <span className="font-bold">Order placed · {order.status}</span>
            <span className="text-sm text-muted-foreground">
              Order <span className="font-mono">{order.id}</span>. Pay now to send it to the seller.
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title="Shipping address"
            icon={<MapPin className="size-5 text-buyer" aria-hidden />}
            action={
              placed ? null : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Change
                </Button>
              )
            }
          >
            {recipient ? (
              <div className="text-sm" data-testid="address">
                <p className="font-semibold">
                  {recipient.name} <span className="font-normal text-muted-foreground">· {recipient.phone}</span>
                </p>
                <p className="text-muted-foreground">{[recipient.addressLine, recipient.district, recipient.city, recipient.postalCode].filter(Boolean).join(', ')}</p>
              </div>
            ) : (
              <div className="text-sm" data-testid="address">
                <p className="font-semibold">{me?.buyer?.name ?? 'Your account'}</p>
                <p className="text-muted-foreground">
                  {me?.buyer?.city ? `${me.buyer.city} · ` : ''}Saved address of your account
                </p>
              </div>
            )}
          </Card>

          <Card title={shopName} icon={<Store className="size-5" aria-hidden />}>
            <ul className="divide-y divide-line-soft" aria-label="Items">
              {lines.map((l) => (
                <li key={l.skuId} className="flex items-center gap-3 py-3">
                  <ProductImage product={l.product ?? ({ imageUrl: '', imageBg: imageBackgrounds[0] } as EnrichedProduct)} className="w-16 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="line-clamp-1 text-sm font-medium">{l.productTitle}</span>
                    <span className="w-fit rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground">{l.skuName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {shopPrice(l.unitPriceVnd)} × {l.quantity}
                  </span>
                  <span className="w-28 text-right text-sm font-semibold">{shopPrice(l.lineTotalVnd)}</span>
                </li>
              ))}
            </ul>
            {errors.items ? <FieldError id="items-error">{errors.items}</FieldError> : null}

            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="buyer-message">Message to seller</Label>
              <Textarea
                id="buyer-message"
                value={message}
                maxLength={MESSAGE_MAX}
                disabled={placed}
                placeholder="Optional"
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                className="min-h-16"
              />
              <span className="self-end text-xs text-muted-2">
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm">
              <Truck className="size-5 text-free-ship" aria-hidden />
              <div className="flex flex-col">
                <span className="font-semibold">Shipping · Simulator Express</span>
                <span className="text-xs text-muted-foreground">Fake carrier. The fee is calculated when the order is placed.</span>
              </div>
            </div>
          </Card>

          <Card title="Voucher" icon={<Ticket className="size-5 text-buyer" aria-hidden />}>
            <Label htmlFor="coupon" className="sr-only">
              Voucher code
            </Label>
            <Input
              id="coupon"
              value={coupon}
              maxLength={20}
              disabled={placed}
              placeholder="Enter a voucher code"
              aria-invalid={errors.coupon ? true : undefined}
              aria-describedby={errors.coupon ? 'coupon-error' : undefined}
              onChange={(e) => setCoupon(e.target.value)}
              className="max-w-xs uppercase"
            />
            {errors.coupon ? <FieldError id="coupon-error">{errors.coupon}</FieldError> : null}
          </Card>
        </div>

        <aside className="self-start lg:sticky lg:top-20">
          <section aria-labelledby="payment-details" className="flex flex-col gap-3 rounded-card bg-white p-5 shadow-xs ring-1 ring-line-soft">
            <div className="flex items-center gap-2">
              <h2 id="payment-details" className="text-lg font-bold">
                Payment details
              </h2>
              <Badge variant="outline" className="ml-auto gap-1 rounded-full border-free-ship/40 text-free-ship">
                <ShieldCheck /> Simulated payment
              </Badge>
            </div>
            <PaymentDetails productTotal={productTotal} amounts={order?.amounts ?? null} />
            {errors.general ? (
              <Alert variant="destructive">
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            ) : null}
            {placed ? (
              <>
                <Button size="lg" className="h-12 bg-buyer text-base text-white hover:bg-buyer/90" disabled={paying} onClick={pay}>
                  {paying ? 'Paying...' : 'Pay now (simulated)'}
                </Button>
                <Button asChild variant="ghost" className="text-muted-foreground">
                  <Link to="/account/orders">Pay later</Link>
                </Button>
              </>
            ) : (
              <Button size="lg" className="h-12 bg-buyer text-base text-white hover:bg-buyer/90" disabled={placing} onClick={place}>
                {placing ? 'Placing order...' : 'Place order'}
              </Button>
            )}
            <p className="text-xs text-muted-2">No real money is charged. Payment is simulated.</p>
          </section>
        </aside>
      </div>

      {editing ? (
        <AddressDialog
          open
          initial={address ?? (me?.buyer ? { name: me.buyer.name, phone: '', addressLine: '', district: '', city: me.buyer.city } : null)}
          onOpenChange={setEditing}
          onSave={(r) => {
            setAddress(r);
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}

export function CheckoutPage() {
  const { buyer } = useAuth();
  // the route is guarded by RequireRole BUYER
  return buyer ? <Checkout key={buyer.sessionToken} buyer={buyer} /> : null;
}
