import type { OrderStatus } from './types';

/** Seller Center order rules, taken from src/features/orders.seller.tsx and fulfillment.seller.tsx. */

export type SellerOrderTab = 'all' | 'unpaid' | 'to-ship' | 'shipped' | 'completed' | 'cancelled';

export const sellerOrderTabs: { key: SellerOrderTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'to-ship', label: 'To ship' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function sellerTabOf(status: OrderStatus): Exclude<SellerOrderTab, 'all'> {
  switch (status) {
    case 'UNPAID':
      return 'unpaid';
    case 'ON_HOLD':
    case 'AWAITING_SHIPMENT':
    case 'AWAITING_COLLECTION':
      return 'to-ship';
    case 'PARTIALLY_SHIPPING':
    case 'IN_TRANSIT':
      return 'shipped';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
  }
}

export type SellerAction = 'arrange' | 'label' | 'advance' | 'cancel';

/** Statuses that have a package (and so a fulfillment view worth loading). */
export const hasPackage = (status: OrderStatus) => ['AWAITING_COLLECTION', 'PARTIALLY_SHIPPING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(status);

/**
 * Arrange shipment only from AWAITING_SHIPMENT; the fake carrier advances AWAITING_COLLECTION -> IN_TRANSIT -> DELIVERED;
 * a label exists once there is a tracking number; the seller can cancel until the parcel is arranged.
 */
export function sellerActionsFor(status: OrderStatus, hasTracking: boolean): SellerAction[] {
  const actions: SellerAction[] = [];
  if (status === 'AWAITING_SHIPMENT') actions.push('arrange');
  if (hasTracking && status !== 'CANCELLED') actions.push('label');
  if (status === 'AWAITING_COLLECTION' || status === 'IN_TRANSIT') actions.push('advance');
  if (status === 'UNPAID' || status === 'ON_HOLD' || status === 'AWAITING_SHIPMENT') actions.push('cancel');
  return actions;
}

/** What "Simulate carrier" does next. */
export const advanceHint = (status: OrderStatus) => (status === 'AWAITING_COLLECTION' ? 'Carrier collects the parcel' : 'Parcel is delivered');
