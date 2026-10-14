/** Optional promo code field for the Cart checkout (Phase 09a). The backend validates and prices the coupon; this only carries the text. */
export function CouponCodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline">
      Coupon code{' '}
      <input aria-label="coupon code" placeholder="Optional" maxLength={12} value={value} onChange={(e) => onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())} />
    </label>
  );
}
