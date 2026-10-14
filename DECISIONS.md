# DECISIONS (to review)

| # | Issue | Choice | Reason |
|---|---|---|---|
| D1 | Two user instructions conflict: "work only in the simulator repo, platform is reference only" vs. the autonomous brief mentioning SmartOmni migrations (V100+), `mvn` and Inventory changes. | The platform repo is NOT modified. SmartOmni-side steps are written as requirement docs (`docs/smartomni-requirements/`) and marked BLOCKED; `mvn test` / `mvn -B clean verify` are run read-only on the platform repo for REPORT.md. | The explicit, earlier instruction is unambiguous and editing a teammate's working tree is not reversible by me; the safest option keeps their code untouched. |
| D2 | Order line items have no quantity field in the OAS. | One `OrderLine` row per purchased unit; max 20 units/SKU, 50 units/order. | Mirrors the OAS shape; makes partial refunds per unit natural. Unverified against real TikTok. |
| D3 | Order transition rules are not in the OAS. | Simulator model in `backend/src/orders/order-state.ts`; ON_HOLD can never jump to a shipping status; DELIVERED is not COMPLETED; COMPLETED/CANCELLED terminal. | Matches the phase instructions; documented as unverified. |
| D4 | Stock behaviour at order time. | The simulator reserves stock at checkout (single warehouse able to fill the order) and returns it once on cancel. SmartOmni's inventory update is an absolute set (Phase 06). | Phase 06 instruction: "if the simulator reserves on order, the sync command sets an absolute quantity". |
| D5 | Webhook `type` numbers. | Only ORDER_STATUS_CHANGE=1 appears in a (secondary) sample. Other topics use a clearly marked UNVERIFIED table in `webhook-emitter.service.ts`. | Receivers must route on topic-specific fields; avoids inventing contract values silently. |
| D6 | New placeholder scope for the Events API. | `sim.event.manage` (added to default seed scopes); tokens issued earlier must re-authorize. | Official scope names are unresolved. |
| D7 | Webhook delivery to `localhost` addresses from Docker. | `WEBHOOK_REWRITE_LOCALHOST` (true in compose) rewrites loopback hosts to `HOST_CALLBACK_BASE_URL`. | Subscription addresses are given by SmartOmni running on the host. |
| D8 | Hold period after payment. | ON_HOLD for `ORDER_HOLD_MINUTES` (30, business clock); released by a background timer or `/test-admin/orders/release-due`. | OAS describes ON_HOLD but not its duration. |

## Phase 07a
| # | Issue | Choice | Reason |
|---|---|---|---|
| D07a-1 | Package state vs. order state | Packages follow the order state machine through a transition listener added to `OrdersService` (`addTransitionListener`, runs inside the transition transaction). | One source of truth; package, tracking events and `PACKAGE_UPDATE` can never disagree with the order or be written without it. Minimal hook, `transition` logic unchanged. |
| D07a-2 | Package before shipment is arranged | Package row is created when the order enters AWAITING_SHIPMENT with status `TO_FULFILL` (OAS line-item `package_status` value). ON_HOLD/UNPAID orders have no package. | The package-detail enum has no pre-arrangement value; this keeps "ON_HOLD cannot be shipped" structural (nothing to ship) and gives SmartOmni a package id to call ship/label with. Unverified. |
| D07a-3 | One package per order | No split/combine; `split_and_combine_tag` is always `DEFAULT`. | Out of scope for this step. |
| D07a-4 | Where the document is served | `GET /demo/files/shipping-documents/<48-hex>.pdf`, public, token = capability; URL built from `PUBLIC_API_BASE_URL`. 24 h validity is not enforced. | Must be downloadable from host and Docker and must not be part of the TikTok router; browsers cannot send the demo header. |
| D07a-5 | Unsupported document options | `SHIPPING_LABEL_PICTURE`, `HAZMAT_LABEL`, `INVOICE_LABEL`, ZPL, unknown sizes -> 400 `invalid_input` (not silently ignored). | Honesty rule: no fake success for unmodelled features. |
| D07a-6 | `self_shipment` in Ship Package | Rejected (400). Only platform (TIKTOK) shipping is modelled. | The tracking number must come from the simulator's fake range. |
| D07a-7 | TikTok module imports `FulfillmentModule` | Router-separation test now expects imports `['OAuthModule','FulfillmentModule']`. | Ship Package is a write defined by the TikTok contract; the module only exposes fulfillment logic (no seed/reset/clock/admin). |
| D07a-8 | New placeholder scopes | `sim.fulfillment.read`, `sim.fulfillment.write` added to default seed scopes (config, .env.example, compose). Older tokens must re-authorize. | Official scope names unresolved. |
| D07a-9 | Pre-existing gap noticed (not fixed, shared file) | `ResetService` does not delete `Order`/`Package` rows, so a shop-scope reset after orders exist will fail on FK constraints. | Needs the coordinating agent: delete orders (cascade covers lines, audits, packages, tracking) before the shop in `reset.service.ts`. |
