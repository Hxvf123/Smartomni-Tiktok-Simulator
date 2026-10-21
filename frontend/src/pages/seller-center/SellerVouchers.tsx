import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { humanize, Loaded, NativeSelect, SellerCard } from '@/components/seller/SellerUi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';
import { createCoupon, getCoupons, patchCoupon } from '@/lib/endpoints';
import { shopPrice } from '@/lib/format';
import type { DemoSession } from '@/lib/types';
import { useAsync } from '@/lib/useAsync';
import { cn } from '@/lib/utils';

/** Form rules and request body from src/features/coupons.seller.tsx. */
const isWhole = (v: string): boolean => /^\d+$/.test(v) && Number(v) >= 1;
export const emptyVoucher = { title: '', promoCode: '', kind: 'AMOUNT_OFF', value: '', cap: '', minSpend: '', days: '7', limit: '', audience: 'ALL' };
export type VoucherForm = typeof emptyVoucher;

export function voucherValid(f: VoucherForm): boolean {
  const valueOk = isWhole(f.value) && (f.kind === 'AMOUNT_OFF' || Number(f.value) <= 100);
  return (
    f.title.trim() !== '' &&
    /^[A-Za-z0-9]{6,12}$/.test(f.promoCode) &&
    valueOk &&
    isWhole(f.days) &&
    (f.cap === '' || isWhole(f.cap)) &&
    (f.minSpend === '' || isWhole(f.minSpend)) &&
    (f.limit === '' || isWhole(f.limit))
  );
}

export function voucherBody(f: VoucherForm, now = Date.now()) {
  const discount = f.kind === 'AMOUNT_OFF' ? { type: 'AMOUNT_OFF', amountVnd: Number(f.value) } : { type: 'PERCENT_OFF', percentage: Number(f.value), ...(f.cap ? { maxDiscountVnd: Number(f.cap) } : {}) };
  const endAt = new Date(now + Number(f.days) * 86_400_000).toISOString();
  return { title: f.title, promoCode: f.promoCode, discount, endAt, audience: f.audience, ...(f.minSpend ? { minSpendVnd: Number(f.minSpend) } : {}), ...(f.limit ? { redemptionLimit: Number(f.limit) } : {}) };
}

const tone = (s: string) => (s === 'ONGOING' ? 'bg-teal-soft text-teal' : s === 'DEACTIVATED' || s === 'EXPIRED' ? 'bg-buyer-soft text-buyer-ink' : 'bg-[#FFF4E0] text-[#9A5B00]');

function NewVoucherDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (f: VoucherForm) => Promise<void> }) {
  const [f, setF] = useState(emptyVoucher);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const text = (key: keyof VoucherForm, label: string, extra: { placeholder?: string; numeric?: boolean; maxLength?: number; upper?: boolean } = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`voucher-${key}`}>{label}</Label>
      <Input
        id={`voucher-${key}`}
        value={f[key]}
        placeholder={extra.placeholder}
        maxLength={extra.maxLength}
        inputMode={extra.numeric ? 'numeric' : undefined}
        onChange={(e) => setF({ ...f, [key]: extra.upper ? e.target.value.toUpperCase() : e.target.value })}
      />
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="theme-seller font-sans sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New voucher</DialogTitle>
          <DialogDescription>Validity starts now on the business clock. Code and discount cannot be changed afterwards.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              await onCreate(f);
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
            }
          }}
        >
          {text('title', 'Title')}
          {text('promoCode', 'Code', { placeholder: '6-12 letters/digits', maxLength: 12, upper: true })}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="voucher-kind">Discount type</Label>
            <NativeSelect id="voucher-kind" className="h-9" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="AMOUNT_OFF">Amount off (VND)</option>
              <option value="PERCENT_OFF">Percent off</option>
            </NativeSelect>
          </div>
          {text('value', f.kind === 'AMOUNT_OFF' ? 'Amount off (VND)' : 'Percent off (1-100)', { numeric: true })}
          {f.kind === 'PERCENT_OFF' ? text('cap', 'Maximum discount VND (optional)', { numeric: true }) : null}
          {text('minSpend', 'Minimum spend VND (optional)', { numeric: true })}
          {text('days', 'Valid days', { numeric: true })}
          {text('limit', 'Redemption limit (optional)', { numeric: true })}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="voucher-audience">Audience</Label>
            <NativeSelect id="voucher-audience" className="h-9" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              <option value="ALL">All buyers</option>
              <option value="NEW">New buyers only</option>
            </NativeSelect>
          </div>
          {error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!voucherValid(f) || busy}>
              Create voucher
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Vouchers({ seller }: { seller: DemoSession }) {
  const list = useAsync(() => getCoupons(seller), [seller.sessionToken, seller.shopId], 10000);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (id: string, deactivated: boolean) => {
    setBusy(id);
    try {
      await patchCoupon(seller, id, { deactivated });
      toast.success(deactivated ? 'Voucher deactivated' : 'Voucher reactivated');
      list.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Vouchers</h1>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> New voucher
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Vouchers are seller-created demo data. Buyers type the code at checkout; the backend prices the discount.</p>
      <SellerCard>
        <Loaded result={list} what="vouchers">
          {(d) =>
            d.items.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No vouchers yet. Create one with New voucher.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-2 hover:bg-surface-2">
                    <TableHead className="pl-4">Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Min spend</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((c) => (
                    <TableRow key={c.id} aria-label={`Voucher ${c.promoCode ?? c.id}`}>
                      <TableCell className="pl-4 font-mono font-semibold">{c.promoCode ?? '—'}</TableCell>
                      <TableCell>
                        {c.title}
                        {c.audience === 'NEW' ? <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs">New buyers</span> : null}
                      </TableCell>
                      <TableCell>{c.discountText}</TableCell>
                      <TableCell>{c.minSpendVnd != null ? shopPrice(c.minSpendVnd) : '—'}</TableCell>
                      <TableCell>
                        {c.redeemedCount}
                        {c.redemptionLimit != null ? ` / ${c.redemptionLimit}` : ''}
                      </TableCell>
                      <TableCell>
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', tone(c.status))}>{humanize(c.status)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => toggle(c.id, c.status !== 'DEACTIVATED')}>
                          {c.status === 'DEACTIVATED' ? 'Reactivate' : 'Deactivate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </Loaded>
      </SellerCard>

      {creating ? (
        <NewVoucherDialog
          onClose={() => setCreating(false)}
          onCreate={async (f) => {
            await createCoupon(seller, voucherBody(f));
            toast.success('Voucher created');
            setCreating(false);
            list.reload();
          }}
        />
      ) : null}
    </div>
  );
}

export function SellerVouchers() {
  const { seller } = useAuth();
  // the route is guarded by RequireRole SELLER
  return seller ? <Vouchers key={`${seller.sessionToken}:${seller.shopId}`} seller={seller} /> : null;
}
