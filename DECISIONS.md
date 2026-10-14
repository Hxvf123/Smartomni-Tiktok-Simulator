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

## Phase 06
| # | Issue | Choice | Reason |
|---|---|---|---|
| D6.1 | OAS says quantity "Valid range: [1, 99,999]". A client may want to mark a SKU sold out with 0. | Quantity 0 is rejected as a per-warehouse error; follow the OAS text. | The phase says fixtures must check the official validity rules; accepting 0 would be inventing behaviour. Revisit if Partner Center confirms 0 is accepted. |
| D6.2 | Partial failure semantics are not stated in the OAS. | Each SKU is atomic; valid SKUs in the same request are applied, failing ones are listed in `data.errors[]` inside a code-0 envelope (as in the OAS fixture). | The response schema is a per-SKU error list, not an envelope failure. Unverified. |
| D6.3 | Error code values are undocumented. | Main error 12052990 and secondary 12052097 (the two example numbers printed in the OAS) for every per-SKU failure; messages describe the reason. | No readable source defines the codes; do not invent new ones. Their meaning is unverified. |
| D6.4 | How to simulate "timeout". | The connection is closed without a response (before or after the write, optional `delayMs`). | A client then sees the same unknown outcome as a real timeout. |
| D6.5 | HTTP 200 application error. | Envelope `code` = simulator sentinel -1 plus `simulator_fault.kind=app_error_200`, nothing written. | TikTok error codes are undocumented. |
| D6.6 | Inventory faults must not leak. | `INVENTORY_FAULT_KINDS` are excluded from the generic fault lookup (API middleware and webhook worker) and consumed only by the inventory handler. | Otherwise a rule meant for inventory would be used up by an unrelated request. |
| D6.7 | Scope. | New placeholder `sim.inventory.write` in default seed scopes; tokens issued earlier must re-authorize. | Official scope names are unresolved. |
| D6.8 | Which writers are logged. | API, SELLER edit, ORDER (checkout reservation and cancel restore) write `InventoryChange` rows in the same transaction as the stock change under the row lock, so the per-row log is a verifiable before/after chain. | Lets tests prove that no update is lost under concurrency. |
