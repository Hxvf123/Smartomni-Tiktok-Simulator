# SmartOmni TikTok Shop Simulator

Standalone simulator used to test SmartOmni's TikTok Shop features locally. It is **not** part of the SmartOmni Maven reactor and has its own database, volumes, ports and credentials. All data is fake; no real money or real TikTok access is involved.

Status: Phase 02 foundation, Phase 03 simulator side (seller consent, authorization codes, token exchange/refresh, signed Get Authorized Shops) and Phase 04 simulator side (catalog: Search Products, Get Product, Get Warehouse List, Seller product management, Buyer storefront). More TikTok-shaped endpoints arrive in Phase 04+ from `contracts/` (Phase 01). The implementation plan lives in `spec/` (copied from the SmartOmni platform repo; links inside it that point at SmartOmni docs are not available here).

## What is here

| Path | Purpose |
|---|---|
| `backend/` | NestJS + TypeScript + Prisma API (port 8090) |
| `frontend/` | React + TypeScript + Vite UI (port 3090): Seller, Buyer, Test Console |
| `docker-compose.yml` | db (internal only), api, ui; named volumes for DB, media and PDF |
| `contracts/`, `docs/` | Owned by Phase 01 (API contracts and documentation) |

### Three separate routers

| Router | Mount | Purpose | Auth |
|---|---|---|---|
| TikTok-shaped public API | root (`/order/...` etc., exact paths from `contracts/`) | What SmartOmni calls. Phase 03: `GET /api/v2/token/get`, `GET /api/v2/token/refresh` (provisional), `GET /authorization/202309/shops`. Phase 04 (read-only, signed, scope `sim.product.read`): `POST /product/202502/products/search` (`page_size` required, opaque `page_token`), `GET /product/202309/products/{product_id}`, `GET /logistics/202309/warehouses`. Unknown paths return a plain 404. | token endpoints: `app_key`+`app_secret` query; shops: `x-tts-access-token` + signed query |
| Demo | `/demo/*` | Seller/Buyer UI scenarios, demo sessions; Phase 04 product writes (`/demo/shops/:id/catalog/*`) and Buyer storefront (`/demo/shops/:id/storefront/*`) | `x-demo-session` (per shop) |
| Test admin | `/test-admin/*` | seed, reset, business clock, faults, webhook replay, logs, status, `catalog/bulk` (generate products for multi-page imports) | `x-test-admin-token` |

Seed, reset, clock and fault control are never reachable through the TikTok router. API fault rules created via `/test-admin/faults` only affect TikTok-router requests.

### Clocks

* **Business clock** (`BusinessClock`): drives business timestamps, adjustable at `/test-admin/clock` (shift, freeze, reset), persisted in the DB.
* **Auth clock** (`AuthClock`): real system time, used for request-signature/timestamp validation and for authorization-code/token expiry. Not adjustable.
* Worker leases and retry scheduling use real system time.

## Run with Docker (recommended)

Requires Docker Desktop / Docker Engine with Compose v2.

```bash
cd smartomni-tiktok-simulator
cp .env.example .env        # then replace every CHANGE_ME value
docker compose up --build -d
docker compose ps           # wait until db, api, ui are healthy
```

* UI: http://localhost:3090 (Test Console at `/console`)
* API: http://localhost:8090 (`/health/live`, `/health/ready`)
* PostgreSQL has no published port; it lives on an internal-only Docker network.
* Ports bind to `127.0.0.1` by default (`BIND_ADDRESS`). For team access, set `BIND_ADDRESS` deliberately and understand that the UI proxy injects the test-admin token for anyone who can reach port 3090.
* The API container applies migrations (`prisma migrate deploy`) and the deterministic seed on start.
* Data survives `docker compose down` / restart (named volumes `tiktok_sim_pgdata`, `tiktok_sim_media`, `tiktok_sim_pdf`). `docker compose down -v` deletes it.
* Reaching SmartOmni on the host from the containers: `HOST_CALLBACK_BASE_URL` (default `http://host.docker.internal`; Linux is covered by `host-gateway`). SmartOmni reaching the simulator uses `PUBLIC_API_BASE_URL` (default `http://localhost:8090`).

## Local development (without Docker for the app)

Needs Node 20+ and a PostgreSQL 14+ database whose name contains `simulator` (reset safety rail).

```bash
# backend
cd backend
npm ci
export DATABASE_URL=postgresql://USER:PASS@localhost:5432/tiktok_simulator
export TEST_ADMIN_TOKEN=some-local-token
npx prisma migrate deploy
npm run build && npm start          # or: npm run start:dev (tsc watch) in one shell, node dist/main.js in another

# frontend (new shell)
cd frontend
npm ci
TEST_ADMIN_TOKEN=some-local-token npm run dev    # http://localhost:3090, proxies /demo /test-admin /health to :8090
```

### Quality gates

```bash
cd backend  && npm run typecheck && npm run lint && npm run build && npm test
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

Backend integration tests need a real PostgreSQL (`FOR UPDATE SKIP LOCKED`). `npm test` starts a throw-away embedded PostgreSQL 16 automatically; set `TEST_DATABASE_URL` (database name must contain `simulator`) to use your own instead.

## Data model (Prisma, `backend/prisma/schema.prisma`)

Seller, Shop, Buyer (belongs to one shop), App (fake app key/secret, redirect URIs), Token (SHA-256 hashes only), Warehouse, Product, Sku, InventoryLevel, Scenario, DemoSession (hashed), HttpRequestLog, WebhookJob, WebhookAttempt, FaultRule, ClockState. Later phases add models with **new** migrations only.

### Seed

Deterministic and idempotent: two Vietnamese shops (VND), one seller and separate buyers per shop, products/SKUs, two warehouses each, scenarios. Ids are derived from stable names, so reset + reseed restores the same ids. Inventory is created but never overwritten by a re-run. Triggers: automatically on API start (`SEED_ON_START`), `POST /test-admin/seed`, the Test Console, or `npm run seed` (backend).

### Reset (explicit scope and confirmation)

`POST /test-admin/reset/prepare {scope, shopId?}` returns what will be deleted and a short-lived HMAC confirmation token bound to that scope/shop; `POST /test-admin/reset {scope, shopId?, confirmationToken}` executes it. Scopes: `LOGS`, `WEBHOOKS`, `SHOP` (one shop, then reseeded), `ALL`. The Test Console additionally requires typing `RESET <SCOPE>`. Reset refuses to run unless the connected database name contains `simulator`; it only ever touches the simulator database.

### Webhook worker

PostgreSQL-backed queue (`WebhookJob`/`WebhookAttempt`):

* atomic claim with `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`; the attempt row (`STARTED`) is written in the same transaction as the claim, i.e. **before** sending;
* lease (`WEBHOOK_LEASE_MS`); a job whose lease expired (worker crash/restart) is reclaimed, the abandoned attempt becomes `LEASE_EXPIRED`, and the new attempt is flagged `possibleDuplicate`;
* completion is fenced by `leaseToken`; a worker that lost its lease can only record its result as `lateCompletion`;
* exponential backoff (`WEBHOOK_BASE_BACKOFF_MS`, capped), `DEAD` after `maxAttempts`, replay creates a linked new job;
* faults (`HTTP_ERROR`, `DELAY`, `DROP`, `DUPLICATE`) from `/test-admin/faults`; injected duplicates are recorded in `deliveries`.

Real webhook payloads, topics and signatures are Phase 05; the foundation sends the stored JSON payload with `x-simulator-*` headers only.

### Logging and secrets

Every request (except health probes and console polling reads) is stored in `HttpRequestLog` with `x-request-id`. Tokens, secrets, signatures, authorization headers and session/confirmation tokens are redacted **before** storage (`backend/src/common/redaction.ts`). `.env` is git-ignored; `.env.example` contains placeholders only. The seeded app secret is a fake development value.

## Test Console

Status (DB, worker, clock, queue, seed), Shop & scenario, Reset (two-step), Clock, HTTP log (request-ID filter), Webhooks (history, replay, queue a test event), Faults. Seller and Buyer are shells for later phases (login as a demo identity, catalog view); every list has loading, error and empty states.

## Phase 03: authorization and token lifecycle (simulator side)

Everything below is simulator behaviour built on **unverified** contract material (`contracts/manifest.json`: authorization URL `unsupported`, token endpoints and scopes `unverified`, error codes undocumented). Scope names (`sim.*`), the consent URL, redirect parameter names and error bodies are simulator-defined.

| Step | Where | Notes |
|---|---|---|
| Consent page | UI `http://localhost:3090/seller/authorize?app_key=<key>&state=<state>[&redirect_uri=<registered uri>]` | Demo seller signs in, sees shop + scopes, authorizes or denies. API: `GET/POST /demo/authorization/consent` (`x-demo-session`). |
| Callback | registered redirect URI only (exact match) | `?code=<auth code>&state=<echo>` or `?error=access_denied&state=<echo>`. Codes are single use, TTL `OAUTH_AUTH_CODE_TTL_MS`. |
| Token exchange | `GET /api/v2/token/get?app_key&app_secret&auth_code[&grant_type]` | Envelope `{code:0,message,request_id,data:{access_token,access_token_expire_in,refresh_token,refresh_token_expire_in,open_id}}`. `*_expire_in` are absolute Unix seconds (unconfirmed). |
| Refresh | `GET /api/v2/token/refresh?app_key&app_secret&refresh_token[&grant_type]` | Rotates both tokens; the old refresh token is dead; concurrent use of one refresh token has exactly one winner. |
| Authorized shops | `GET /authorization/202309/shops?app_key&timestamp&sign[&shop_cipher]` + header `x-tts-access-token` | `sign` per `contracts/signing`; timestamp in Unix seconds within `OAUTH_SIGNATURE_WINDOW_MS`. Returns only the token's shop. |
| Test faults | `/test-admin/tokens`, `.../tokens/:id/{expire-access,expire-refresh,revoke,remove-scope}`, `/test-admin/authorization-codes/expire` | Also in the Test Console "Authorization" tab. Metadata only; token values and hashes are never listed. |

Failures return the error-envelope shape `{code:-1,message,request_id,simulator_fault:{kind,...}}`. TikTok error codes are undocumented, so `code` is a simulator sentinel; decide on HTTP status and `simulator_fault.kind`.


## Catalog (Phase 04)

* Product and SKU ids are strings and unique **per shop**: the seed deliberately gives both shops a product `sim-product-shared-1` / SKU `sim-sku-shared-1` with different data, and shop B has two SKUs with the same seller SKU `DUP-1`.
* Search order is a monotonic internal sequence; `page_token` is an opaque cursor over it, so products added during an import appear on a later page and nothing is skipped or repeated. The last page returns `next_page_token: ""`.
* `status` filter values come from the OAS (`ALL`, `DRAFT`, `PENDING`, `FAILED`, `ACTIVATE`, `SELLER_DEACTIVATED`, `PLATFORM_DEACTIVATED`, `FREEZE`, `DELETED`); `ALL` includes every status (whether real TikTok hides `DELETED` under `ALL` is unverified). Unsupported filters are rejected with a 400 test fault, never ignored.
* Prices are strings in VND (`price.sale_price`), per SKU. Warehouse ids (`inventory[].warehouse_id`) match `GET /logistics/202309/warehouses` `id`.
* Product writes exist only as `/demo` endpoints: the contract lists no verified product-write operation.
* Buyer product link: `http://localhost:3090/buyer/product/<marketplace product id>` (opens in the Buyer session's shop; a product of another shop shows "not available").
