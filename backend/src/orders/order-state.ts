/** Order statuses are the OAS values (order.detail `status` description). */
export const ORDER_STATUSES = [
  'UNPAID',
  'ON_HOLD',
  'AWAITING_SHIPMENT',
  'PARTIALLY_SHIPPING',
  'AWAITING_COLLECTION',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Allowed transitions. The OAS lists the statuses but not the transition rules, so this table is the SIMULATOR'S model (unverified):
 * - ON_HOLD can never jump to a shipping status (a held order is not shippable);
 * - DELIVERED is not COMPLETED; COMPLETED is terminal here (Phase 07 models returns as separate aftersale records).
 */
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  UNPAID: ['ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['AWAITING_SHIPMENT', 'CANCELLED'],
  AWAITING_SHIPMENT: ['PARTIALLY_SHIPPING', 'AWAITING_COLLECTION', 'CANCELLED'],
  PARTIALLY_SHIPPING: ['AWAITING_COLLECTION', 'CANCELLED'],
  AWAITING_COLLECTION: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: string, to: string): boolean {
  return (TRANSITIONS[from as OrderStatus] ?? []).includes(to as OrderStatus);
}

/** Statuses from which a stock reservation is still held (released on cancel). */
export const SHIPPING_STATUSES: readonly OrderStatus[] = ['AWAITING_COLLECTION', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'PARTIALLY_SHIPPING'];
