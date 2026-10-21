import { api } from './api';
import type {
  AftersaleList,
  Aftersale,
  Cart,
  CatalogProduct,
  CheckoutRequest,
  Conversation,
  Coupon,
  DemoSession,
  Fulfillment,
  Identities,
  Me,
  Order,
  OrderHistoryEntry,
  ReturnRequest,
  ShippingDocument,
  ShippingDocumentType,
  Shop,
  SignInIdentity,
  StorefrontProduct,
} from './types';

/** One function per /demo endpoint used by the Tiptop Shop screens. Shop-scoped calls take the signed-in session. */

const shop = (s: DemoSession, path = '') => `/demo/shops/${encodeURIComponent(s.shopId)}${path}`;
const id = encodeURIComponent;
const auth = (s: DemoSession) => ({ demoSession: s.sessionToken });

// Sessions
export const getIdentities = () => api<Identities>('/demo/identities');
export const createSession = (identity: SignInIdentity) => api<DemoSession>('/demo/sessions', { method: 'POST', body: identity });
export const getMe = (s: DemoSession) => api<Me>('/demo/me', auth(s));
export const endSession = (s: DemoSession) => api<void>('/demo/sessions/current', { method: 'DELETE', ...auth(s) });

// Shop (seller)
export const getShop = (s: DemoSession) => api<Shop>(shop(s), auth(s));
export const getCatalog = (s: DemoSession) => api<{ currency: string; items: CatalogProduct[] }>(shop(s, '/catalog'), auth(s));
export const getCoupons = (s: DemoSession) => api<{ items: Coupon[] }>(shop(s, '/coupons'), auth(s));
export const listConversations = (s: DemoSession) => api<{ items: Conversation[] }>(shop(s, '/chat/conversations'), auth(s));

// Storefront (buyer)
export const listStorefrontProducts = (s: DemoSession) =>
  api<{ currency: string; items: StorefrontProduct[] }>(shop(s, '/storefront/products'), auth(s));
export const getStorefrontProduct = (s: DemoSession, productId: string) =>
  api<{ currency: string; product: StorefrontProduct }>(shop(s, `/storefront/products/${id(productId)}`), auth(s));

// Cart and checkout (buyer)
export const getCart = (s: DemoSession) => api<Cart>(shop(s, '/cart'), auth(s));
/** quantity 0 removes the line. */
export const setCartItem = (s: DemoSession, skuId: string, quantity: number) =>
  api<Cart>(shop(s, '/cart/items'), { method: 'PUT', body: { skuId, quantity }, ...auth(s) });
export const checkout = (s: DemoSession, body: CheckoutRequest) =>
  api<{ replayed: boolean; order: Order }>(shop(s, '/checkout'), { method: 'POST', body, ...auth(s) });
export const payOrder = (s: DemoSession, orderId: string) =>
  api<{ replayed: boolean; order: Order }>(shop(s, `/orders/${id(orderId)}/pay`), { method: 'POST', ...auth(s) });

// Orders (both roles)
export const listOrders = (s: DemoSession) => api<{ items: Order[] }>(shop(s, '/orders'), auth(s));
export const getOrder = (s: DemoSession, orderId: string) =>
  api<{ order: Order; history: OrderHistoryEntry[] }>(shop(s, `/orders/${id(orderId)}`), auth(s));
export const cancelOrder = (s: DemoSession, orderId: string, reason?: string) =>
  api<{ order: Order }>(shop(s, `/orders/${id(orderId)}/cancel`), { method: 'POST', body: reason ? { reason } : {}, ...auth(s) });
export const getFulfillment = (s: DemoSession, orderId: string) => api<Fulfillment>(shop(s, `/orders/${id(orderId)}/fulfillment`), auth(s));

// Fulfillment (seller)
export const arrangeShipment = (s: DemoSession, orderId: string) =>
  api<Fulfillment>(shop(s, `/orders/${id(orderId)}/arrange-shipment`), { method: 'POST', ...auth(s) });
export const advanceShipment = (s: DemoSession, orderId: string) =>
  api<Fulfillment>(shop(s, `/orders/${id(orderId)}/advance-shipment`), { method: 'POST', ...auth(s) });
export const getShippingLabel = (s: DemoSession, orderId: string, documentType: ShippingDocumentType = 'SHIPPING_LABEL') =>
  api<ShippingDocument>(shop(s, `/orders/${id(orderId)}/shipping-label`), { method: 'POST', body: { documentType }, ...auth(s) });

// Aftersale
export const listAftersale = (s: DemoSession) => api<AftersaleList>(shop(s, '/aftersale'), auth(s));
export const requestReturn = (s: DemoSession, body: ReturnRequest) =>
  api<{ request: Aftersale }>(shop(s, '/aftersale/returns'), { method: 'POST', body, ...auth(s) });
export const requestCancellation = (s: DemoSession, orderId: string, reason?: string) =>
  api<{ request: Aftersale }>(shop(s, '/aftersale/cancellations'), { method: 'POST', body: { orderId, ...(reason ? { reason } : {}) }, ...auth(s) });
