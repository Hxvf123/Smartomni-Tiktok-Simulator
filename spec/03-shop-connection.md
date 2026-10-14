# Phase 03 — Cấp quyền và kết nối shop

[← Overview](00-overview.md) · Dependency: Phase 01, 02.

## Mục tiêu / mô tả

Tenant Admin cấp quyền cho SmartOmni truy cập đúng shop. Simulator mô phỏng authorization và token lifecycle; SmartOmni chỉ đánh dấu connected sau khi xác minh token và shop được cấp quyền.

## Tech stack

NestJS/Prisma cho authorization và token; React cho trang consent; Spring Boot Integration, JWT/TenantContext và mã hóa token ở backend SmartOmni; Flyway migration mới.

## Instructions

- `app_key`/`app_secret` thuộc ứng dụng SmartOmni và cấu hình backend; không yêu cầu mỗi chủ shop nhập app secret.
- Seller identity, shop ID và shop cipher khác tenant ID nội bộ.
- `state` gắn với phiên cấp quyền và tenant, có thời hạn, dùng một lần; callback không tin tenant ID do trình duyệt tự cung cấp.
- Authorization code ngắn hạn, đổi một lần; xử lý token exchange/refresh theo contract Phase 01.
- Token chỉ được lưu an toàn ở backend; không trả token/secret qua UI, API danh sách kết nối hoặc log.
- Không đồng nhất đăng nhập SmartOmni với đăng nhập seller trên simulator.

## Steps

1. Simulator tạo app và seller/shop demo; cấu hình redirect URI hợp lệ và quyền được hỗ trợ.
2. SmartOmni thêm thao tác bắt đầu kết nối cho Tenant Admin, tạo state và URL cấp quyền.
3. Seller demo hiển thị shop/quyền, cho chấp nhận hoặc từ chối; redirect về callback đúng URI đăng ký.
4. SmartOmni kiểm state và callback error; đổi code lấy token ở backend.
5. Gọi Get Authorized Shops, kiểm quyền, liên kết shop với tenant theo giới hạn một shop TikTok/tenant.
6. Lưu connection, seller/shop/cipher, token mã hóa, hạn token, scope và trạng thái; app secret nằm trong config.
7. Tạo adapter HTTP dùng chung cho simulator và TikTok: cấu hình riêng authorization/token/OpenAPI base URL, signing, pagination và giải mã lỗi.
8. Refresh token an toàn khi có nhiều request đồng thời; lưu token mới nguyên tử, không tự retry vô hạn khi refresh bị từ chối.
9. Test Console hỗ trợ hết hạn token, thu hồi quyền và thiếu scope. SmartOmni hiển thị cần kết nối lại và ghi cảnh báo; thông báo email test dùng sink local.
10. Bổ sung migration mới và kiểm RLS; không trả entity có thông tin token trực tiếp từ controller.

## Data / input-output cần lưu

- Context nội bộ: tenant, connection, state hash, hạn state, redirect đích đã cho phép.
- Dữ liệu sàn: seller open ID, shop ID, shop cipher, scope và metadata token theo schema chính thức.
- Trạng thái kết nối: phân biệt kết nối thành công, thiếu quyền, refresh thất bại, revoked/disconnected.
- Public authorization/token I/O lấy từ contract Phase 01, không thêm tenant ID vào schema TikTok.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Chấp nhận/từ chối consent, code hết hạn/dùng lại, sai state và callback lặp.
- [ ] Tenant A không gắn hoặc đọc connection của tenant B.
- [ ] Access token hết hạn refresh được; refresh token hết hạn yêu cầu cấp quyền lại.
- [ ] Token shop A không truy cập shop B; thiếu scope bị từ chối.
- [ ] Sai chữ ký/timestamp bị từ chối theo contract.
- [ ] Chỉ đổi base URL/config để chuyển simulator/TikTok; không có nhánh bypass bảo mật riêng cho simulator.
- [ ] API trả về không lộ token/secret.

## Theo dõi

- Người phụ trách: phần SmartOmni (Integration) do agent Claude thực hiện ngày 14/10/2026; phần simulator (consent, token, authorized shops, Test Console) do agent khác phụ trách, chưa có trong báo cáo này.
- PR/commit: chưa commit (theo yêu cầu). Thay đổi nằm trong working tree.
- Bằng chứng kiểm thử (phần SmartOmni, chạy 14/10/2026, Windows, JDK 17, PostgreSQL 16 nhúng, không dùng Docker):
  - File mới: `smartomni-db-migrations/.../V9__tiktok_shop_connection.sql`; trong `smartomni-service-integration`: `config/TiktokProperties|TiktokConfig`, `client/tiktok/*` (`TiktokApiSigner`, `TiktokOpenApiClient`, `TiktokAuthClient`, transport, envelope), `service/tiktok/*` (`TiktokConnectionService`, `TiktokConnectionStore`, `TiktokTokenService`, `TiktokShopApiExecutor`, `TokenCipher`, `LocalSinkReconnectNotifier`), `controller/TiktokConnectionController`, `entity/MarketplaceAuthorizationState`, `dto/tiktok/*`, `dto/MarketplaceConnectionDto`.
  - File sửa: `MarketplaceConnection` (cột mới, enum `ConnectionStatus` thêm MISSING_SCOPE/REFRESH_FAILED/REVOKED), `MarketplaceConnectionRepository`, `MarketplaceConnectionController` (trả DTO thay vì entity lộ `appSecretEncrypted`), `MarketplaceConnectionService` (từ chối `TIKTOK_SHOP` ở luồng cũ), `application.yml`, `scripts/db/verify-schema.sql` (chấp nhận enum `connection_status` 3 giá trị trước V9 hoặc 6 giá trị sau V9), `docs/database-migrations.md`, `DatabaseMigrationTest` và `PackagedServiceStartupIT` (danh sách migration, 45 bảng, 9 migration, đổi file tạm `V9__*` thành `V99__*`).
  - `mvn -o -pl smartomni-migration-tests,smartomni-service-integration -am verify`: BUILD SUCCESS. Integration: 50 test (signer đối chiếu 5 vector `contracts/signing/test-vectors.json`, adapter/ký/phân trang/giải mã lỗi, token client, AES-GCM, connection service, refresh). `PackagedServiceStartupIT`: 7 service khởi động bằng JAR đóng gói sau V9, pass. Migration-tests: 16 test, gồm 5 test mới `TiktokConnectionDatabaseTest` chạy trên PostgreSQL thật (RLS bật và FORCE cho bảng state, tenant B không đọc/consume/đổi connection hoặc state của tenant A, state dùng một lần với 8 thread đồng thời chỉ 1 thắng, state hết hạn/sai user, unique 1 dòng TikTok/tenant và 1 tenant/shop, enum round trip, refresh CAS thật với 8 thread chỉ gọi nền tảng 1 lần, refresh bị từ chối không retry và chỉ báo 1 lần).
  - Chưa chạy/chưa xác minh: tích hợp với simulator thật (phía simulator chưa có endpoint); gọi TikTok thật; email thật (chỉ sink local); không có test controller/Spring MVC cho phân quyền HTTP (kiểm role ở service, test bằng TenantContext).
  - Tiêu chí hoàn thành chưa tick: các mục cần phía simulator (consent chấp nhận/từ chối end to end, code hết hạn/dùng lại ở simulator, token shop A không truy cập shop B ở simulator, sai chữ ký/timestamp do simulator từ chối, Test Console) chưa có bằng chứng.
- Blocker / quyết định bổ sung:
  - Quyết định luồng callback: redirect của trình duyệt không mang JWT, nên `redirect_uri` trỏ tới trang callback của frontend SmartOmni; trang này `POST /api/marketplace-connections/tiktok-shop/callback` với JWT Tenant Admin và body `{code, state, error, errorDescription}`. Tenant lấy từ JWT, phải trùng tenant và user gắn với state; không có tenant ID trong request. Cách này dùng nguyên RLS hiện có và route nginx hiện có (`/api/marketplace-connections/`), không cần endpoint công khai.
  - Endpoint (đều cần JWT role ADMIN trừ GET cần JWT hợp lệ): `POST .../tiktok-shop/authorization` (trả `authorizationUrl`, `expiresAt`), `POST .../tiktok-shop/callback`, `GET .../tiktok-shop`, `POST .../tiktok-shop/disconnect`.
  - Cần từ simulator (ghi vào contracts, hiện đều UNVERIFIED): (1) URL trang consent và tên query `app_key`, `state`, `redirect_uri` (cấu hình được `smartomni.tiktok.authorization-*`); (2) redirect về `redirect_uri` kèm query `code`, `state`, hoặc `error` (+ `error_description`); (3) `GET {token-base-url}/api/v2/token/get` với `app_key`, `app_secret`, `auth_code`, `grant_type=authorized_code` và `/api/v2/token/refresh` với `refresh_token`, `grant_type=refresh_token`, trả envelope `{code, message, request_id, data{access_token, access_token_expire_in, refresh_token, refresh_token_expire_in, open_id}}`; (4) scope: nguồn scope tạm là `data.granted_scopes` (mảng chuỗi) trong phản hồi token, chưa có trong contract; nếu `smartomni.tiktok.required-scopes` khác rỗng mà thiếu thì kết nối thành MISSING_SCOPE (fail closed); (5) `GET /authorization/202309/shops` ký theo `sign.ts`, một shop duy nhất cho mỗi consent; (6) mã lỗi cho access token bị từ chối chưa có tài liệu (simulator luôn trả `code=-1`): SmartOmni coi HTTP 401 (cấu hình `smartomni.tiktok.token-rejected-http-statuses`, mặc định 401) hoặc `token-rejected-codes` là token bị từ chối, buộc refresh một lần rồi retry một lần, không quyết định theo `simulator_fault.kind`; (7) `access_token_expire_in`: hiểu là epoch giây nếu >= 1e9, ngược lại là TTL giây (một hàm duy nhất `TiktokAuthClient.resolveExpiry`); (8) khi seller thu hồi, SmartOmni cần webhook SELLER_DEAUTHORIZATION hoặc một lệnh gọi `TiktokConnectionService.markRevoked` (chưa nối webhook, thuộc Phase 05).
  - Phase 05: `WebhookController` giải mã `app_secret_encrypted`, vốn null với kết nối TikTok mới (app secret nằm ở config). Chưa sửa; Phase 05 phải lấy secret từ `TiktokProperties` và theo quy tắc ký webhook trong contract. `TiktokShopClient` (stub cũ, URL cứng) và `PriceSyncScheduler`/`ProductSyncService` chưa chuyển sang `TiktokShopApiExecutor` (Phase 04).
  - Migration V9: unique 1 dòng TikTok/tenant và 1 tenant/shop sẽ làm migration thất bại nếu DB hiện có dữ liệu TikTok trùng; cần dọn trước. Trạng thái REVOKED/REFRESH_FAILED/MISSING_SCOPE vẫn giữ shop để tenant khác không chiếm; chỉ DISCONNECTED nhả shop. `ALTER TYPE ... ADD VALUE` không thể rollback đơn lẻ; mọi service phải đóng gói cùng bộ migration.
  - Email: chỉ có sink local (log WARN + file `smartomni.notifications.local-email-sink-file`); chưa tra email Tenant Admin và chưa có SMTP. Hiển thị "cần kết nối lại": DTO có `needsReconnect`; frontend chưa làm.
  - Biến môi trường mới (chưa sửa `docker-compose.yml`/`.env.example`, ngoài phạm vi): `TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET`, `TIKTOK_AUTHORIZATION_URL`, `TIKTOK_REDIRECT_URI`, `TIKTOK_TOKEN_BASE_URL`, `TIKTOK_OPEN_API_BASE_URL`, `TIKTOK_STATE_TTL`, `TIKTOK_REQUIRED_SCOPES`, `TIKTOK_TOKEN_REJECTED_CODES`, `SMARTOMNI_LOCAL_EMAIL_SINK_FILE`; tất cả có mặc định an toàn, thiếu thì chỉ lỗi khi bắt đầu kết nối.
  - Hạn chế đã biết: refresh giữ khóa theo connection trong JVM và CAS `token_version` ở DB (an toàn nhiều instance, nhưng nếu refresh token của sàn dùng một lần thì instance thua CAS đã tiêu thụ token; đã giảm bằng cách thua thì dùng token của bên thắng, và rejection sau khi bên khác đã xoay token không bị đánh dấu lỗi). Ký multipart chưa hỗ trợ (theo contract).
- Ngày hoàn thành: chưa hoàn thành Phase 03 (mới xong phần SmartOmni, 14/10/2026)

### Phần Simulator (agent Phase 03, 14/10/2026) — chưa review bởi người, chưa commit

- Người phụ trách: (chưa gán).
- PR/commit: chưa commit; thay đổi trong working tree `smartomni-tiktok-simulator/backend` (migration `20261015000000_phase03_authorization`, `src/oauth/`, `src/tiktok/`, `src/demo`, `src/test-admin`, `src/reset`, `src/seed`, `src/config`, `src/common`, `test/tiktok-auth.e2e-spec.ts`, `test/routers.e2e-spec.ts`), `frontend` (`AuthorizePage`, `TokensPanel`), `README.md`, `.env.example`, `docker-compose.yml`. Không sửa `contracts/`, không sửa module Java.
- Bằng chứng kiểm thử (Windows, Node 22, Docker 29.8):
  - Backend `npm run typecheck`, `lint`, `build` pass; `npm test` = 5 suites / 63 tests pass trên PostgreSQL 16 embedded (33 test mới trong `tiktok-auth.e2e-spec.ts`: consent accept/deny, redirect_uri/state sai, code hết hạn/dùng lại/đổi đồng thời, refresh thành công/hết hạn/bị thu hồi, refresh đồng thời 8 request chỉ 1 thắng, token shop A với cipher shop B bị từ chối, thiếu scope, sai chữ ký/timestamp cũ/tương lai, tái hiện 5 test vector ký của `contracts/signing`, business clock dịch không đổi hiệu lực token, redaction trong `HttpRequestLog`, danh sách không lộ token/hash/app secret, reset xóa code+token). `routers.e2e-spec` được cập nhật: TikTok module chỉ có `TokenController`, `ShopsController`, chỉ import `OAuthModule`.
  - Frontend `typecheck`, `lint`, `build`, `npm test` (3 test, gồm 2 test mới cho trang consent) pass.
  - Docker: `docker compose up --build` chạy (migration mới áp dụng trên DB trống), luồng consent -> `token/get` -> `shops` có chữ ký trả 200, chữ ký sai trả 401, route UI `/seller/authorize` trả 200; log container không chứa token/code/app secret. Đã `down -v` sau khi kiểm.
  - Chưa tick checkbox: các mục "tenant A/B", "liên kết shop với tenant", "chỉ đổi base URL" và phần SmartOmni (state/tenant, mã hóa token, adapter HTTP, RLS) thuộc phía Java; chưa có e2e end to end hai phía; chưa có e2e trình duyệt (Playwright) cho trang consent.
- Blocker / quyết định bổ sung (mọi thứ dưới đây do simulator tự định, KHÔNG phải contract đã xác minh):
  1. URL cấp quyền `auth.authorization_url` vẫn `unsupported`. Simulator dùng `http://localhost:3090/seller/authorize?app_key=<key>&state=<state>[&redirect_uri=<uri đã đăng ký>]`; API `GET/POST /demo/authorization/consent`. Tham số callback `code`, `state`, và từ chối là `error=access_denied` (kiểu OAuth, chưa xác minh). `redirect_uri` chỉ được chấp nhận khi khớp chính xác URI đã đăng ký; thiếu thì dùng URI đầu tiên.
  2. Token endpoints (`GET /api/v2/token/get|refresh`) chỉ có nguồn thứ cấp. Xác thực bằng `app_key`+`app_secret` trong query, không ký. `grant_type` được chấp nhận nhưng không ép giá trị (contract không chốt). `access_token_expire_in`/`refresh_token_expire_in` trả về Unix seconds tuyệt đối (theo `fixtures/token.json`), ngữ nghĩa chưa xác nhận. Schema token không có trường scope/seller name, nên SmartOmni không biết scope đã cấp qua token; cần quyết định của Phase 01 nếu muốn thêm.
  3. Scope chính thức chưa có trong contract: dùng scope giả `sim.authorized_shops.read`, `sim.product.read`, `sim.order.read` (cấu hình `SEED_APP_SCOPES`). Không phải tên scope TikTok.
  4. Mã lỗi TikTok chưa được tài liệu hóa: lỗi trả envelope đúng hình `{code,message,request_id}` nhưng `code` luôn là `-1` (sentinel của simulator), kèm `simulator_fault.kind`. HTTP status do simulator chọn: 400 invalid_input/auth_code_*/refresh_token_*/authorization_revoked (ở refresh), 401 bad_signature/stale_timestamp/unknown_app_key/invalid_app_credentials/token_invalid/token_expired/authorization_revoked (ở API), 403 missing_scope/shop_cipher_mismatch/token khác app. `invalid_input`, `token_expired`, `missing_scope`, `bad_signature` có trong `fixtures/errors.json`; các kind còn lại là bổ sung riêng của simulator. SmartOmni phải quyết định theo HTTP status + `simulator_fault.kind`, không map theo giá trị `code`. Không dùng 36004001 (đường refresh cũ).
  5. Ký request: theo `contracts/signing` (bằng chứng gián tiếp). Timestamp là Unix seconds, chấp nhận lệch ±`OAUTH_SIGNATURE_WINDOW_MS` (mặc định 300 s, chưa xác minh; cả timestamp tương lai bị từ chối), kiểm bằng `AuthClock`. Query được parse từ URL thô, tham số lặp bị từ chối. `sign` và `access_token` bị loại khỏi chuỗi ký; `x-tts-access-token` là header. multipart chưa hỗ trợ (đúng blocker của contract).
  6. `shop_cipher` là tùy chọn trên Get Authorized Shops (đây là call để SmartOmni lấy cipher); nếu có thì phải đúng shop của token. Chỉ trả shop của token. Trường `code` của shop do simulator sinh (`SIMVN` + 4 số cuối shop id), `region: VN`, `seller_type: LOCAL` chưa xác minh (fixture đã ghi VN synthetic).
  7. Thời hạn code/token dùng `AuthClock` (giờ thật), không dùng business clock; hành động hết hạn trong Test Console dời mốc hết hạn về quá khứ. TTL mặc định: code 5 phút, access 1 giờ, refresh 30 ngày, đều là lựa chọn của simulator. Refresh xoay vòng cả hai token với TTL mới; dùng lại refresh token cũ bị từ chối, không thu hồi cả chuỗi. Authorize lại cùng (app, shop) thu hồi token cũ.
  8. Token/code chỉ lưu SHA-256; trả raw một lần tại lúc cấp. `[?&]code=` được che trong log (không thể che key `code` vì envelope có `code: 0`).
  9. App secret: `config.ts` và `docker-compose.yml` (Phase 02) vẫn có giá trị mặc định giả `smartomni-dev-app-secret-fake` khi không đặt `SEED_APP_SECRET`; chưa đổi hành vi Phase 02, ghi lại để quyết định (khuyến nghị bắt buộc env khi chạy ngoài dev). Không endpoint `/demo` hoặc `/test-admin` nào trả `App`.
  10. Chưa phát webhook `SELLER_DEAUTHORIZATION`/`UPCOMING_AUTHORIZATION_EXPIRATION` khi thu hồi/sắp hết hạn: thuộc Phase 05 (payload chưa xác minh).
  11. Migration thêm `Shop.code`, `Shop.sellerType` (backfill) và bảng `AuthorizationCode`; không sửa migration cũ.
- Ngày hoàn thành: chưa (chờ review và phía SmartOmni).

