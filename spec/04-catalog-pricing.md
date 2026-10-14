# Phase 04 — Catalog, SKU và giá

[← Overview](00-overview.md) · Dependency: Phase 01–03.

## Mục tiêu / mô tả

Seller tạo và sửa sản phẩm trên simulator; Buyer xem/chọn SKU; SmartOmni đọc API TikTok để nhập sản phẩm và theo dõi giá theo SKU.

## Tech stack

NestJS/Prisma, React, media volume; Spring Boot Integration/Catalog, Quartz Jobs, Flyway; contract tests và Playwright.

## Instructions

- Dùng product ID và SKU ID sàn riêng; không dùng SKU ID database SmartOmni làm ID TikTok.
- Price ở cấp SKU; không lấy SKU đầu tiên làm giá cho toàn sản phẩm.
- Search trả theo contract danh sách; adapter gọi detail khi cần dữ liệu không có ở search.
- Dùng cursor/page token chính thức, không chuyển API bên ngoài thành page index.
- Thay đổi sản phẩm trên Seller demo dùng API /demo; chỉ thêm OpenAPI ghi sản phẩm khi phạm vi và contract đã được xác minh.

## Steps

1. Tạo model sản phẩm, ảnh, SKU, seller SKU, trạng thái, giá và tồn theo kho.
2. Seller UI hỗ trợ tạo/sửa sản phẩm, thêm biến thể, cập nhật giá và trạng thái; Buyer có danh sách/chi tiết/chọn SKU.
3. Triển khai Search Products, Get Product và Get Warehouse List theo contract đã khóa; filter và pagination có dữ liệu nhiều trang.
4. Mở rộng DTO adapter để giữ external product/SKU IDs, seller SKU, currency và kho; không làm mất trường cần cho inventory.
5. Catalog lưu mapping theo connection + product/SKU sàn; mapping tới SKU nội bộ qua quy tắc rõ ràng, có xử lý seller SKU trùng hoặc chưa ghép.
6. Hoàn thiện ProductSyncService: upsert catalog, kiểm giới hạn SKU/feature, lỗi từng sản phẩm có báo cáo và không giả báo đã nhập thành công.
7. Hoàn thiện price scheduler đọc đúng mapping/config, cập nhật giá theo kênh, lưu lịch sử và kết quả cảnh báo bất thường.
8. URL sản phẩm dùng base URL demo khi chạy simulator để Storefront mở Buyer detail tương ứng.
9. Thêm migration mới cho mapping/metadata còn thiếu, giữ tenant isolation.

## Input / output

Contract chính: POST /product/202502/products/search và GET /product/202309/products/{product_id}, hoặc phiên bản áp dụng được khóa ở Phase 01.

Fixture cần có nhiều SKU với giá khác nhau, ảnh, dữ liệu rỗng, sản phẩm bị ẩn/xóa, cursor cuối trang và tiền VND. Giữ string/number đúng schema nguồn.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Import nhiều trang không bỏ sót hoặc tạo trùng khi chạy lại.
- [ ] Product ID/SKU ID giống nhau ở context shop khác không làm lẫn mapping.
- [ ] Hai SKU cùng sản phẩm cập nhật giá độc lập.
- [ ] Lỗi API không ghi đè giá cũ bằng null/0.
- [ ] Thay đổi giá bất thường được phát hiện theo cấu hình nghiệp vụ SmartOmni.
- [ ] Quá giới hạn SKU có kết quả rõ; không báo success giả.
- [ ] Buyer chọn đúng SKU và URL từ Storefront mở được sản phẩm demo.

## Theo dõi

- Người phụ trách:
- PR/commit:
- Bằng chứng kiểm thử:
- Blocker / quyết định bổ sung:
- Ngày hoàn thành:

### Phần SmartOmni (agent Phase 04, 15/10/2026) — chưa review bởi người, chưa commit

- Người phụ trách: (chưa gán). PR/commit: chưa commit; thay đổi nằm trong working tree. Không sửa `smartomni-tiktok-simulator/`.
- File mới:
  - Migration `smartomni-db-migrations/.../V10__tiktok_catalog_mapping.sql`: cột `external_product_id`, `external_sku_id`, `seller_sku`, `currency`, `external_status` trên `product_marketplace_links` (unique `(connection_id, external_sku_id)`, FK `(tenant_id, connection_id)` ở dạng NOT VALID để không đụng dữ liệu cũ); `price_sync_history` thêm `connection_id`, `external_sku_id`, `currency`, `applied`; bảng mới `marketplace_warehouses`, `marketplace_import_runs` (RLS + FORCE, unique 1 run `running` mỗi connection).
  - Integration: `dto/tiktok/TiktokCatalogDtos`, `client/tiktok/TiktokCatalogClient`, `service/catalog/{CatalogMappingStore, JdbcCatalogMappingStore, PriceChangePolicy, TiktokProductMapper, TiktokProductImportService, TiktokPriceSyncService, TiktokTenantConnections, ImportReport}`, `controller/TiktokCatalogController`.
  - Test: `TiktokCatalogClientTest`, `TiktokCatalogDtosTest`, `PriceChangePolicyTest`, `TiktokPriceSyncServiceTest`, `TestTx` (integration); `TiktokCatalogDatabaseTest`, `FakeTiktokPlatform`, `TiktokCatalogTestApplication` (migration-tests).
- File sửa: `MarketplaceProductDto` (thêm `platformStatus`, `externalSkuId`, `sellerSku`, `currency`, `stock` theo kho), `TiktokProperties` (`productPageSize`, `productUrlTemplate`), `application.yml` (integration), `ProductSyncService` (TikTok chuyển sang `TiktokProductImportService`), `PriceSyncScheduler` (TikTok qua `TiktokPriceSyncService`, bỏ khung TODO), catalog `ProductMarketplaceLink` (map thêm cột V10), `docs/database-migrations.md`, `DatabaseMigrationTest` (47 bảng, 10 migration, baseline 5 migration) và `PackagedServiceStartupIT` (10 migration). `TiktokShopClient` (stub cũ) không còn được dùng cho catalog/giá; còn lại cho `updateStock` (Phase 06).
- Endpoint mới (JWT ADMIN hoặc MANAGER, tenant lấy từ JWT, không nhận tenant/connection id từ client), cùng prefix nginx hiện có `/api/marketplace-connections/tiktok-shop/`: `POST products/import`, `GET products/import-runs`, `POST warehouses/sync`, `POST prices/sync`.
- Bằng chứng kiểm thử (15/10/2026, Windows, JDK 17, PostgreSQL 16 nhúng, không Docker): `mvn -o -pl smartomni-migration-tests,smartomni-service-integration,smartomni-service-catalog -am verify` = BUILD SUCCESS. Integration 77 test (27 mới); `DatabaseMigrationTest` 11, `TiktokConnectionDatabaseTest` 5, `TiktokCatalogDatabaseTest` 16 (mới), `PackagedServiceStartupIT` 7 (7 service khởi động bằng JAR sau V10). Các test DB mới chứng minh trên PostgreSQL thật:
  - import 5 sản phẩm/6 SKU qua 3 trang bằng `page_token` (`t2`, `t4`; không có tham số page index), chạy lại: 0 sản phẩm/SKU mới, số dòng products/skus/links không đổi, không ghi history khi giá không đổi;
  - cùng product ID `P1` và SKU ID `S1` ở hai connection/tenant: hai link riêng, giá riêng (100000 vs 555000), tenant 2 không đọc/không sửa được link của tenant 1 dù nêu connection id của tenant 1; đổi giá tenant 1 không đổi giá tenant 2;
  - hai SKU cùng sản phẩm cập nhật giá độc lập (A 100000→110000 áp dụng; B 200000→10000 bị giữ);
  - lỗi tìm kiếm API, giá `0`, giá thiếu, giá không phân tích được: giá cũ giữ nguyên, không có history, không có `platform_price` null/0;
  - giá đổi quá `smartomni.price-sync.anomaly-threshold-percent` (mặc định 50, ≤0 tắt) ghi history `is_anomaly=true, applied=false`, giữ giá cũ, không ghi lặp cùng một anomaly đang chờ;
  - plan `max_skus=3`: run dừng `stopped_sku_limit`, `sku_limit_reached=true`, có thông báo lỗi, sản phẩm vượt giới hạn không tạo SKU nào; nâng plan rồi chạy lại hoàn tất, không tạo trùng;
  - seller SKU: SKU nội bộ chưa link → link (không tạo mới); thiếu seller SKU → `SKU_UNMATCHED`; seller SKU trùng trong cùng sản phẩm hoặc đã link sang SKU sàn khác → `SKU_CONFLICT`; không tạo sản phẩm nào cho các biến thể này;
  - lỗi detail một sản phẩm được báo `DETAIL_FAILED`, các sản phẩm khác vẫn nhập, run `completed_with_errors`; 5 lỗi liên tiếp → `failed`; lỗi search → `failed`;
  - sản phẩm `SELLER_DEACTIVATED` nhập ở trạng thái `hidden`, `DRAFT` bị bỏ qua, `DELETED` ẩn sản phẩm nội bộ (không xóa); import thứ hai khi run đang `running` bị từ chối (`IMPORT_ALREADY_RUNNING`), run `running` quá 30 phút bị coi là bỏ dở;
  - warehouse sync idempotent theo `(connection, warehouse id)` và tách theo tenant; RLS của hai bảng mới kiểm bằng role `smartomni_app`.
- Chưa chạy/chưa xác minh: tích hợp với simulator thật (phía simulator Phase 04 do agent khác làm; test dùng `FakeTiktokPlatform` ở lớp `TiktokShopApiExecutor`, nên ký request + HTTP của các lệnh catalog chỉ được test ở mức unit với `FakeTransport`/signer của Phase 03); gọi TikTok thật; Playwright/Buyer UI; test HTTP/Spring MVC cho phân quyền controller (vai trò kiểm ở `TiktokTenantConnections`, kiểm bằng `TenantContext`); chạy đồng thời hai import thật trên hai JVM (chỉ kiểm chặn bằng dòng `running` đã có); nút xác nhận anomaly cho Manager (chưa có API `confirmed_by`, mới ghi nhận).
- Giả định trường phản hồi (từ OAS, `contracts/snapshots/oas`, tất cả còn `unverified` trong manifest):
  - Search `POST /product/202502/products/search`: query `page_size` (bắt buộc), `page_token`; body `{}` (không filter, mặc định `status=ALL`); phản hồi `data.next_page_token` (rỗng = hết trang), `data.total_count`, `data.products[]` với `id`, `title`, `status`, `skus[].id`, `skus[].seller_sku`, `skus[].price.{currency,sale_price}` (chuỗi), `skus[].inventory[].{warehouse_id,quantity}`.
  - Detail `GET /product/202309/products/{product_id}`: `data.id`, `title`, `description`, `status`, `main_images[].urls[]`, `skus[]` như trên cộng `sales_attributes[].value_name` (ghép bằng " / " thành tên biến thể; thiếu thì dùng seller SKU).
  - Warehouses `GET /logistics/202309/warehouses`: `data.warehouses[].{id,name,type,sub_type,effect_status,is_default,address.city,address.region_code}`.
  - Trạng thái sản phẩm nhập: `ACTIVATE` → active; `SELLER_DEACTIVATED`/`PLATFORM_DEACTIVATED` → hidden; `DRAFT`, `PENDING`, `FAILED`, `FREEZE`, `DELETED`, giá trị lạ → bỏ qua (không tạo). Giá dùng `price.sale_price`; `tax_exclusive_price`, `list_price` không dùng. Tiền VND lưu `numeric(14,2)`.
  - Mã lỗi API vẫn đi qua `TiktokShopApiExecutor` (một lần refresh khi token bị từ chối); `TiktokApiException.summary()` là nội dung duy nhất đưa vào báo cáo/log.
- Quyết định/blocker cần team chốt:
  1. Quy tắc ghép SKU là `seller_sku` = `product_skus.sku_code` trong tenant; SKU nội bộ mới tạo lấy `seller_sku` làm `sku_code`. Thiếu seller SKU thì không nhập (báo `SKU_UNMATCHED`), không sinh mã tự động.
  2. Import dừng toàn bộ run khi một sản phẩm vượt giới hạn SKU của gói (đúng FR-086); sản phẩm đó không được tạo một phần. Sản phẩm không cần SKU mới ở các trang sau cũng không được xử lý trong run đó.
  3. Anomaly giá không áp dụng cho đến khi có người xác nhận; hiện chưa có endpoint xác nhận (cột `confirmed_by` đã có). Ngưỡng là cấu hình hệ thống (`PRICE_ANOMALY_THRESHOLD_PERCENT`), chưa theo từng tenant.
  4. Giá chỉ đồng bộ cho SKU có `price_sync_configs` bật (cấu hình SKU ưu tiên hơn cấu hình tenant); import lần đầu và các lần import sau cũng đi qua cùng chính sách giá.
  5. Tên cột/giá trị để dùng cho URL Buyer: `smartomni.tiktok.product-url-template` (biến `TIKTOK_PRODUCT_URL_TEMPLATE`, ví dụ `http://localhost:3090/<route Buyer>/{productId}`) ghi vào `platform_product_url`; route Buyer thật do phía simulator quyết định, mặc định rỗng. Tiêu chí "URL từ Storefront mở được sản phẩm demo" chưa kiểm.
  6. Số SKU được đếm lúc xử lý từng sản phẩm, không khóa toàn tenant: tạo SKU thủ công đồng thời có thể vượt giới hạn vài đơn vị (chấp nhận, ghi lại).
  7. Cần hợp đồng hóa phía simulator: `status` trong Search/Detail (giá trị `ACTIVATE`...), `sale_price` là chuỗi số, `next_page_token` rỗng ở trang cuối, `page_size` bắt buộc.
- Ngày hoàn thành: chưa (chờ review, phần simulator và e2e hai phía).


### Phần Simulator (agent Phase 04, 15/10/2026) — chưa review bởi người, chưa commit

- Người phụ trách: (chưa gán). PR/commit: chưa commit; thay đổi trong `smartomni-tiktok-simulator/` (không sửa `contracts/`).
- File: migration `backend/prisma/migrations/20261016000000_phase04_catalog` (ID sản phẩm/SKU unique theo shop `(shopId, externalId)`; bỏ unique `(shopId, sellerSku)`; thêm `Warehouse.externalId/effectStatus`, `Product.seq/isNotForSale`, `Sku.attributeName/status`; trạng thái `ACTIVE` → `ACTIVATE`); `src/tiktok/products.controller.ts`, `product.mapper.ts`; `src/demo/catalog.controller.ts`, `demo-session.guard.ts` (tách khỏi `demo.module.ts`); `POST /test-admin/catalog/bulk`; seed (cùng product/SKU ID ở hai shop, seller SKU trùng, sản phẩm ẩn/xóa); frontend `SellerCatalog`, `BuyerStorefront`, nút "Add 50 test products"; README.
- Endpoint TikTok (ký, scope giả `sim.product.read`, luôn giới hạn theo shop của token): `POST /product/202502/products/search` (`page_size` 1–100 bắt buộc, `page_token` là cursor keyset mờ trên `seq`, trang cuối `next_page_token:""`), `GET /product/202309/products/{id}`, `GET /logistics/202309/warehouses`. Ghi sản phẩm chỉ có ở `/demo`.
- Bằng chứng (15/10/2026, Windows, Node 22):
  - Backend `typecheck`, `lint`, `build` pass; `npm test` = 6 suites / 85 test pass trên PostgreSQL 16 nhúng, gồm 22 test mới `tiktok-catalog.e2e-spec.ts`: POST ký theo body thô (body bị đổi sau khi ký → 401, UTF-8/khoảng trắng), 75 sản phẩm qua nhiều trang không sót/trùng, sản phẩm thêm giữa hai trang vẫn được trả ở trang sau, filter `status`/`seller_skus`/`sku_ids`/thời gian, lỗi `invalid_input` cho `page_size`/cursor/filter chưa hỗ trợ, cùng product/SKU ID ở hai shop giữ riêng, `shop_cipher` shop khác bị từ chối, seller SKU trùng trong một shop, thiếu scope, giá theo SKU độc lập, soft delete, Seller/Buyer không vượt shop/role.
  - Migration kiểm trên DB đã có dữ liệu Phase 03 (backfill warehouse ID, `seq`, trạng thái): đúng.
  - Frontend `typecheck`, `lint`, `build`, `npm test` = 7 test pass (4 mới: đổi giá chỉ một SKU, hiện lỗi API, chọn đúng SKU, link sản phẩm shop khác).
  - Client ngoài (Python ký độc lập) chạy trên simulator build (`dist`) + PostgreSQL nhúng: consent → token → bulk 50 sản phẩm → search 3 trang, 56 sản phẩm không trùng, warehouses, detail.
  - Client Java thật (`TiktokOpenApiClient` + `TiktokCatalogClient`, ký + HTTP + DTO, chỉ đổi base URL) chạy trên simulator đó: `TiktokCatalogSimulatorLiveTest` (bỏ qua nếu không đặt `TIKTOK_SIM_LIVE_URL`, `TIKTOK_SIM_APP_KEY`, `TIKTOK_SIM_APP_SECRET`, `TIKTOK_SIM_ACCESS_TOKEN`, `TIKTOK_SIM_SHOP_CIPHER`) pass 1/1: nhiều trang không trùng, `sale_price` là chuỗi số, detail 3 SKU đúng giá, `warehouse_id` của tồn kho khớp danh sách kho. Đây cũng là bằng chứng một phần cho Phase 03 (token shop A đọc được dữ liệu shop A qua client Java).
- Docker (15/10/2026, Docker 29.8.0; lần đầu daemon chưa sẵn sàng nên đã kiểm lại sau): `docker compose up --build` với `.env` tạm (đã xóa, đã `down -v`): db/api/ui healthy, migration Phase 04 áp dụng trên DB trống, bulk 50 sản phẩm, search qua 3 trang = 56 sản phẩm không trùng (trạng thái ACTIVATE/SELLER_DEACTIVATED/DELETED), 2 kho, UI `/seller`, `/buyer`, `/buyer/product/<id>`, `/console` và ảnh qua proxy UI đều 200, restart api giữ nguyên dữ liệu (61 sản phẩm), log api không chứa token/code/app secret.
- Chưa chạy: import đầy đủ SmartOmni (service + DB) ↔ simulator; Playwright cho Buyer; gọi TikTok thật.
- Quyết định/blocker (simulator tự định, không phải contract đã xác minh):
  1. Giá trị `status` filter/trường lấy từ mô tả OAS; `ALL` trả mọi trạng thái kể cả `DELETED` (người dùng xác nhận 15/10/2026 giữ cách này; TikTok thật có ẩn `DELETED` hay không chưa xác minh). `audit.status` suy ra từ status bằng danh sách giá trị OAS.
  2. Filter OAS khác (`audit_status`, `listing_platforms`, ...) bị từ chối 400 thay vì lờ đi.
  3. Lỗi sản phẩm không tồn tại/thuộc shop khác: HTTP 404 + `simulator_fault.kind=product_not_found` (mã lỗi TikTok chưa có tài liệu).
  4. Kho dùng chung scope `sim.product.read` (không thêm scope mới để token Phase 03 còn dùng được).
  5. Ảnh: placeholder SVG `/demo/media/products/{uuid}.svg` (không upload; API upload ảnh còn `unverified`).
  6. URL Buyer: `/buyer/product/<product ID sàn>` mở trong shop của phiên Buyer; SmartOmni đặt `TIKTOK_PRODUCT_URL_TEMPLATE=http://localhost:3090/buyer/product/{productId}`. Chưa có e2e trình duyệt nên tiêu chí "URL từ Storefront mở được sản phẩm demo" **chưa tick**.
  7. Không có ràng buộc unique cho seller SKU (OAS không nêu); mã giới hạn SKU/sản phẩm của simulator là 100 (lựa chọn của simulator).
- Ngày hoàn thành: chưa (chờ review, Docker, e2e hai phía đầy đủ và Playwright).
