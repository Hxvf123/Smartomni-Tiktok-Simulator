import type { Coupon } from '@prisma/client';
import { couponStatus } from './coupon-rules';

const secs = (d: Date): number => Math.floor(d.getTime() / 1000);
const money = (vnd: number) => ({ amount: String(vnd), currency: 'VND' });

/**
 * `data.coupons[]` item of Search Coupon List and `data.coupon` of Get Coupon (OAS: schemas/ops/promotion.coupon_*).
 * Detail adds display_channels and usage_stats. The simulator has no "claim" concept, so `claimed_count` equals `redeemed_count` (unverified).
 */
export function couponSearchItem(c: Coupon, now: Date) {
  return {
    id: c.externalId,
    title: c.title,
    status: couponStatus(c, now),
    creation_source: 'SELLER_CENTER',
    display_type: c.displayType,
    promo_code: c.promoCode,
    product_scope: 'FULL_SHOP',
    target_buyer_segment: c.audience,
    create_time: secs(c.createdAt),
    update_time: secs(c.updatedAt),
    discount:
      c.discountType === 'AMOUNT_OFF'
        ? { type: 'AMOUNT_OFF', reduction_amount: money(c.amountOffVnd ?? 0) }
        : { type: 'PERCENT_OFF', percentage: String(c.percentage ?? 0), ...(c.maxDiscountVnd != null ? { max_discount: money(c.maxDiscountVnd) } : {}) },
    threshold: c.minSpendVnd != null ? { type: 'MIN_SPEND', min_spend: money(c.minSpendVnd) } : { type: 'NONE' },
    claim_duration: { start_time: secs(c.startAt), end_time: secs(c.endAt) },
    redemption_duration: { type: 'ABSOLUTE', start_time: secs(c.startAt), end_time: secs(c.endAt) },
    usage_limits: c.redemptionLimit != null ? { redemption_limit: c.redemptionLimit } : {},
  };
}

export function couponDetail(c: Coupon, now: Date) {
  return { ...couponSearchItem(c, now), display_channels: ['PRIVATE'], usage_stats: { claimed_count: c.redeemedCount, redeemed_count: c.redeemedCount } };
}
