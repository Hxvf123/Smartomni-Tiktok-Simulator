# Phase 06 - SmartOmni-side requirements (BLOCKED here: the platform repo is reference-only)

The simulator side (Update Inventory, fault injection, change log, Seller/Console history) is implemented and tested in this repo. The Java/RabbitMQ parts below are **BLOCKED**: no code, tests or RabbitMQ/PostgreSQL integration run exist for them in this work.

## What the simulator guarantees (so the SmartOmni adapter can rely on it)
- `POST /product/202309/products/{product_id}/inventory/update` sets ABSOLUTE quantities. Repeating a request leaves the same state; a retry after a lost answer is safe.
- A code-0 envelope can still carry `data.errors[]` (per SKU, with `detail.sku_id` and `detail.extra_errors[].warehouse_id`). A SKU listed there was NOT written. The adapter must only treat the SKUs absent from `errors` as sent.
- Fault `APP_ERROR_200` returns **HTTP 200 with a non-zero `code`** and writes nothing: never mark an outbox row SENT from the HTTP status alone.
- Faults `TIMEOUT_BEFORE_WRITE` / `TIMEOUT_AFTER_WRITE` close the connection with no answer; after AFTER the new value is stored. The outcome is unknown to the caller, so retry with the same absolute value.
- Quantity range per OAS: integer in [1, 99999]. `0` is rejected (OAS text), see DECISIONS.md D6.1.
- Every `inventory[]` entry must name every warehouse assigned to the SKU; `warehouse_id` may be omitted only for a single-warehouse SKU.
- The simulator already reserves stock at checkout and restores it once on cancel (Phase 05), so SmartOmni must send the absolute quantity, never "minus N" again.
- The token needs the placeholder scope `sim.inventory.write` (tokens issued before Phase 06 must re-authorize).

## Requirements for the SmartOmni repo (not implemented here)
1. **Mapping key** = tenant/connection + product id + SKU id + warehouse id (not only `platformItemId`); the outbox row carries connection and warehouse. No hardcoded `SHOPEE`.
2. **Inventory debit**: atomic, rejects quantity < 0 and insufficient stock; a **receipt** table with a stable idempotency key per (order, line) written in the same transaction as the stock change and the outbox row. A retry with the same key (also after a restart) debits nothing.
3. **Order -> Inventory call** uses that key; on timeout retry the same key; never swallow an error and report the order as processed.
4. **Outbox worker**: claim a batch with a lease (`FOR UPDATE SKIP LOCKED`), call the simulator **outside** any DB transaction, mark SENT only when the response is HTTP 2xx, `code == 0` and the SKU is not in `data.errors`; otherwise retry with backoff up to a limit, then FAILED (re-processable).
5. **Stale protection**: an old or replayed outbox row must not overwrite a newer quantity (compare a monotonic version / sequence per SKU+warehouse before sending, or send the current quantity at send time).
6. **Internal service authentication + trusted tenant context** for Order -> Inventory and Catalog -> Inventory calls.
7. **Catalog mapping API** (authenticated) that returns channel/warehouse mapping to Inventory.
8. Tests required by the spec that need real PostgreSQL + RabbitMQ: concurrent debits never negative, retry-after-restart, wrong-shop mapping, 200-with-error not SENT, timeout-after-update then retry, replayed outbox not lowering stock, order -> debit -> outbox -> simulator end to end.
