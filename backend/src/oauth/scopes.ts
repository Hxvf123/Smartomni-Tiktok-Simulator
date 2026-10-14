/**
 * SIMULATOR-DEFINED PLACEHOLDER scopes. The contract has no official TikTok scope names (manifest: "scope unresolved"),
 * so these are namespaced `sim.` and must never be treated as TikTok scopes. Later phases add one per operation.
 */
export const SCOPE_AUTHORIZED_SHOPS = 'sim.authorized_shops.read';
export const SCOPE_ORDER_READ = 'sim.order.read';
/** Placeholder scope for the Events API (webhook subscriptions). Tokens issued before Phase 05 lack it and must re-authorize. */
export const SCOPE_EVENT_MANAGE = 'sim.event.manage';
export const DEFAULT_APP_SCOPES = [SCOPE_AUTHORIZED_SHOPS, 'sim.product.read', SCOPE_ORDER_READ, SCOPE_EVENT_MANAGE];
/** Placeholder scope for product reads; the simulator also uses it for the warehouse list (listing needs warehouses). */
export const SCOPE_PRODUCT_READ = 'sim.product.read';
