# Contracts (Phase 01)

Source of truth for the public TikTok-shaped simulator API. Access date for everything here: **2026-10-14**. Second pass: upgraded from the official bundled OAS.

## Honest state

- **Official OAS available**: skill `tts-openapi-guide` (OpenAPI 3.0.0, 405 paths, shipped with `@tts-open-toolkit/cli` 0.1.7, server `https://open-api.tiktokglobalshop.com`). 32 shop-API operations are snapshotted from it (`snapshots/oas/`), with schemas and fixtures generated from the snapshots.
- **docv2 still unreadable**: `partner.tiktokshop.com/docv2/page/*` is a client-rendered SPA (HTML shell only) and an unauthenticated call to the document API returned `98001001 internal error` (the toolkit's own document call requires login, which was not used: no toolkit login/DevAPI calls were made). So OAS-vs-docv2 differences, docv2-only newer versions (Send Message 202606), scopes, token/authorization pages, webhook payload pages and error-code tables were NOT read.
- **No operation is `supported`** (before: 29 unverified / 7 unsupported = 36; after: 46 unverified / 3 unsupported = 49, 0 supported). The gates for `supported` (see `manifest.json > statusLegend`) are not all met; each operation's `verification` object shows exactly which dimension is still open, and `blocker` says why.
- Skills used read-only: `tts-openapi-guide` (OAS), `tts-open-toolkit` (read its docs and signer code only), `tts-openapi-faq-index` (FAQ titles), `tts-developer-onboarding-guide`. Nothing that logs in or calls TikTok.

## Layout

- `manifest.json` (v0.2.0): operations with capability, method/path/version, sources, scope, market, `versionChoice` (candidates + reason), `oasVsDocv2`, status, evidence, `verification`, `request.params`, `pagination`, snapshot/schema/fixture refs, blocker.
- `snapshots/oas/<op>.json`: verbatim OAS operation + `_meta` (bundle version, date, sha256, candidate versions). Expired CDN signature values in doc examples are redacted. `snapshots/oas-extract.json`: compact summary.
- `schemas/ops/<op>.response.json` / `.request.json`: generated JSON-Schema subset. The OAS has no `required` arrays and no structured enums, so only the envelope trio `code/message/request_id` is required (plus a documented adapter overlay for `auth.shops`).
- `schemas/`: `envelope.json`, `error-envelope.json` (shape only), `token-response.json` and `webhook-envelope.json` (both PROVISIONAL, secondary).
- `fixtures/ops/<op>.json`: success, empty (list ops), multi_page_first/last (cursor ops), plus `invalid_input`, `token_expired`, `missing_scope` triggers. `fixtures/errors.json`: error classification and FAQ-referenced codes. `fixtures/token.json`, `fixtures/webhook.json`: provisional.
- `signing/`: algorithm, `sign.ts`, `test-vectors.json` (see `signing/README.md`).
- `validator/`: `contract.ts` (`validateRequest` checks method/path/OAS-required params/body schema/signature incl. body; `validateResponse` checks the envelope or error envelope and operation schema), `schema.ts`, `contract.test.ts`.
- `tools/`: `build-from-oas.mjs` (regenerate snapshots/schemas/fixtures from the OAS bundle), `build-manifest.mjs` (regenerate the manifest). Re-run them when a docv2 export or a newer bundle arrives.

Run tests (Node >= 22.6), from the simulator root: `node --experimental-strip-types --test contracts/validator/contract.test.ts` (also works from `contracts/` as `validator/contract.test.ts`).

Operation ids changed: `product.media_upload` now has its path; `fulfillment.actions` -> `fulfillment.package_detail` + `fulfillment.package_ship`; `return.actions` -> `return.approve/reject/records/reject_reasons/aftersale_eligibility` and `cancellation.*`; `cs.send_message_202309` added as a bundle candidate; webhook topics `NEW_CONVERSATION` and `REVERSE_STATUS_UPDATE` added.

## Version selection (per capability, bundle candidates)

| Capability | Candidates in bundle | Selected | Reason |
|---|---|---|---|
| Search products | 202309, 202312, 202502 | 202502 | highest, same capability |
| Product detail | GET 202309 (202509 is PUT EditProduct) | 202309 | 202509 is a different capability |
| Order detail | 202309, 202507 | 202507 | highest |
| Aftersale eligibility | 202309, 202512 | 202512 | highest |
| Send message | 202309 (bundle); 202606 (phase baseline) | 202606 kept, unreadable | docv2 only; 202309 kept as `cs.send_message_202309` candidate for a team decision |
| Search returns | 202309 | 202309 | RMA 202604 absent from the bundle and does not replace it |
| All others | single version | that version | `docv2` newer versions not checkable |

## Resolved / still-open questions from the previous report

| Question | Answer (evidence) |
|---|---|
| Vietnam region / seller_type | `seller_type` is `CROSS_BORDER` or `LOCAL` (OAS description). `region` is a free string (example `GB`); the OAS never lists `VN` as a shop region, but VN appears elsewhere: `VND` in product currency enums, `vi-VN` CS locale, VN in the coupon `redemption_limit` note and in the fulfillment service-district group 1. **VN shop applicability and the region code returned for a VN shop remain UNVERIFIED.** Fixture `local_shop_region_vn_unverified` is synthetic. |
| Webhook topics, `type` mapping, new-message topic | Official topic list (OAS `event_type`): ORDER_STATUS_CHANGE, RECIPIENT_ADDRESS_UPDATE, PACKAGE_UPDATE, PRODUCT_STATUS_CHANGE, SELLER_DEAUTHORIZATION, UPCOMING_AUTHORIZATION_EXPIRATION, CANCELLATION_STATUS_CHANGE, RETURN_STATUS_CHANGE, NEW_CONVERSATION, **NEW_MESSAGE**, PRODUCT_INFORMATION_CHANGE, PRODUCT_CREATION, PRODUCT_CATEGORY_CHANGE, NEW_MESSAGE_LISTENER, INVOICE_STATUS_CHANGE, PRODUCT_AUDIT_STATUS_CHANGE, REVERSE_STATUS_UPDATE. A new-message topic EXISTS (`NEW_MESSAGE`, payload page `66143486ef8a1202dc323258`), now `unverified` (was `unsupported`). The numeric `type` per topic and every payload `data{}` are NOT in the OAS: still open. |
| Cursor pagination per list op | In `manifest.pagination` and `snapshots`: `page_size` + `page_token` -> `next_page_token` (`""` on last page) `+ total_count` for product.search (1-100), order.search (default 20, 1-100), return.search (default 10, 10-50), cancellation.search (default 10, 1-50), coupon_search (default 50, 1-100); conversations (max 20) and messages (max 10) have `next_page_token` without `total_count`. Non-paginated: details, tracking, documents, warehouses, webhooks. |
| Coupon create / limits | No coupon-create operation in the OAS; coupons "are created in Seller Center or Seller App". `promotion/202309/activities` is a different capability. **Lock kept.** Listing: `usage_limits` {`redemption_limit` (ID, MY, PH, TH, SG, VN), `single_buyer_claim_limit`, `total_claim_limit`}; `page_size` 1-100. |
| Authorization URL | Not found in any readable official source (only FAQ titles confirming an app-level redirect URL and a `state` parameter). Stays `unsupported`; read docv2 page `678e3a344ddec3030b238fa0`. |
| Upload media | `POST /product/202309/images/upload` (multipart: `data`, `use_case`; JPG/JPEG/PNG/WEBP/HEIC/BMP, <=10MB, 100-20000 px), `POST /product/202309/files/upload`, `POST /customer_service/202309/images/upload`. Signing of multipart unverified -> `unverified`. |
| Return actions | `return.approve`, `return.reject`, `return.records`, `return.reject_reasons`, `return.aftersale_eligibility` (202512), `cancellation.search/approve/reject`; 202309 unless noted. Create-return (`POST /return_refund/202309/returns`, 'initiate a return request on behalf of the buyer') exists in the OAS but is not manifested: use `/demo`. |
| RMA 202604 | Not in the bundle (return_refund versions are 202309, 202405, 202512). Stays `unsupported`; does not replace Search Returns. |
| Token / authorized shops / error envelope | Authorized shops: official OAS schema. Token get/refresh: still provisional (not in OAS; FAQ confirms `/api/v2/token/get` and `open_id`). Error envelope: shape only; error code VALUES undocumented (FAQ mentions 105004, 36004001 'rt has expired' on the legacy refresh path, 36009003 without meanings). Scopes: nothing in the OAS. |

## Recorded gaps

- Send Message 202606 is missing from the bundled OAS (OAS coverage gap); only 202309 is in the bundle.
- RMA 202604 does not replace Search Returns.
- Real vs demo vs test API: real = TikTok OpenAPI (never called); demo = `/demo/*`; test = `/test-admin/*`.

## Secondary sources still used (provisional only)

Token get/refresh schema and host (npm `tiktok-shop-client`, packagist `haistar/tiktokshop-api-client`, useresponse auth article), webhook envelope and signature (Hookdeck). Everything else is from the official OAS bundle, the toolkit's local-broker signer (indirect evidence), or official FAQ titles.
