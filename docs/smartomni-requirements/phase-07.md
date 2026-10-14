# Phase 07 - SmartOmni-side requirements (not implemented here)

## 07a (steps 1-4): shipping, tracking, shipping documents - BLOCKED (platform repo is reference only)

The simulator side exists (this repo). SmartOmni (Integration/Order) still needs:

1. **Business API for tracking and label** (Order service, authenticated, role-checked): resolve the tenant from the JWT, never from the request; look the order up by (tenant, connection, external order id) so a user of another tenant gets 404 and never sees the tracking events or recipient address.
2. **Tracking**: call `GET /fulfillment/202309/orders/{order_id}/tracking` through `TiktokShopApiExecutor`; show `description` + `update_time_millis` (milliseconds, not seconds).
3. **Shipping document**: take the package id from `order.packages[].id` (Get Order Detail) or `line_items[].package_id`, call `GET /fulfillment/202309/packages/{package_id}/shipping_documents?document_type=SHIPPING_LABEL`, return the `doc_url` to the user only after the tenant check. The simulator URL is `PUBLIC_API_BASE_URL/demo/files/shipping-documents/<48-hex>.pdf` (the same host the other simulator calls use); do not persist it as permanent: TikTok documents the URL as valid for 24 hours (the simulator does not enforce expiry).
4. **Scopes**: the simulator placeholders are `sim.fulfillment.read` (tracking, package detail, documents) and `sim.fulfillment.write` (ship package). Tokens issued before Phase 07a must re-authorize. A missing scope must surface as an explicit error, not as an empty tracking list.
5. **Ship package** (optional): `POST /fulfillment/202309/packages/{package_id}/ship` with `handover_method` `PICKUP|DROP_OFF`; `self_shipment` is rejected by the simulator.
6. **Webhook**: `PACKAGE_UPDATE` (`data.package_id`, `data.order_id`, `data.package_status`, `data.update_time`; `type` is unverified) - handle it with the same signature check and notification-id idempotency as `ORDER_STATUS_CHANGE`.
