# Phase 07 - SmartOmni-side requirements (not implemented here)

## 07a (steps 1-4): shipping, tracking, shipping documents - BLOCKED (platform repo is reference only)

The simulator side exists (this repo). SmartOmni (Integration/Order) still needs:

1. **Business API for tracking and label** (Order service, authenticated, role-checked): resolve the tenant from the JWT, never from the request; look the order up by (tenant, connection, external order id) so a user of another tenant gets 404 and never sees the tracking events or recipient address.
2. **Tracking**: call `GET /fulfillment/202309/orders/{order_id}/tracking` through `TiktokShopApiExecutor`; show `description` + `update_time_millis` (milliseconds, not seconds).
3. **Shipping document**: take the package id from `order.packages[].id` (Get Order Detail) or `line_items[].package_id`, call `GET /fulfillment/202309/packages/{package_id}/shipping_documents?document_type=SHIPPING_LABEL`, return the `doc_url` to the user only after the tenant check. The simulator URL is `PUBLIC_API_BASE_URL/demo/files/shipping-documents/<48-hex>.pdf` (the same host the other simulator calls use); do not persist it as permanent: TikTok documents the URL as valid for 24 hours (the simulator does not enforce expiry).
4. **Scopes**: the simulator placeholders are `sim.fulfillment.read` (tracking, package detail, documents) and `sim.fulfillment.write` (ship package). Tokens issued before Phase 07a must re-authorize. A missing scope must surface as an explicit error, not as an empty tracking list.
5. **Ship package** (optional): `POST /fulfillment/202309/packages/{package_id}/ship` with `handover_method` `PICKUP|DROP_OFF`; `self_shipment` is rejected by the simulator.
6. **Webhook**: `PACKAGE_UPDATE` (`data.package_id`, `data.order_id`, `data.package_status`, `data.update_time`; `type` is unverified) - handle it with the same signature check and notification-id idempotency as `ORDER_STATUS_CHANGE`.

## 07b - cancellations, returns/refunds (BLOCKED: SmartOmni platform repo is reference-only)

Simulator side is implemented (Search Returns / Cancellations, Records, Approve/Reject, Reject Reasons, Aftersale Eligibility, `RETURN_STATUS_CHANGE` / `CANCELLATION_STATUS_CHANGE` webhooks). The SmartOmni side below is NOT implemented here. All contract facts are `unverified` in `contracts/manifest.json`.

1. **Sync**: webhook (`RETURN_STATUS_CHANGE`, `CANCELLATION_STATUS_CHANGE`, verified like ORDER_STATUS_CHANGE) plus polling backfill with `POST /return_refund/202309/returns/search` and `.../cancellations/search` using `update_time_ge` (inclusive) / `update_time_lt` (exclusive) and `page_token`; advance the checkpoint only after durable storage. Returns `page_size` valid range is [10-50]; cancellations [1-50].
2. **Source state**: store the marketplace status string (`return_status`, `cancel_status`) and `update_time` per request; ignore an event older than the stored `update_time`. Order status stays unchanged by returns (the OAS order statuses have no RETURNED value); a partial refund must NOT turn the order into a fully returned/cancelled order.
3. **No manual override**: block local "completed/returned" marking that contradicts the marketplace state.
4. **Restock ownership**: the simulator never adds stock back. SmartOmni Inventory restocks via a receipt keyed by an idempotency key per (order, order line item) - use `return_line_items[].order_line_item_id` / `cancel_line_items[].order_line_item_id` - and only for the lines of a request that reached `RETURN_OR_REFUND_REQUEST_SUCCESS`/`COMPLETE` (returns), so a webhook replay or polling overlap cannot restock twice. A cancellation approval already restores the simulator's reservation; SmartOmni must restore its own debit separately.
5. **Money**: each line carries `refund_amount.{refund_subtotal, refund_shipping_fee, refund_tax, refund_total}` as strings (VND); cancellations include the shipping fee on the request total, returns do not. Never derive refunds from the order total.
6. **Error queue with audit**: missing SKU mapping, missing scope (`sim.aftersale.read/write`), or contradicting states go to a reviewable queue with who/when/why.
7. **Eligibility** (`GET /return_refund/202512/orders/{order_id}/aftersale_eligibility`): `ineligible_code` is a simulator sentinel (-1); the return window (default 15 days after delivery, business clock) is a simulator/SmartOmni TEST rule, not a verified TikTok policy.
8. **Unsupported in the simulator** (do not rely on them): replacement flows, seller-proposed partial refunds, `buyer_keep_item` (returnless refund), arbitration, `return.rma_202604`.
