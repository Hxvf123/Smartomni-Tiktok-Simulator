# Phase 02 — Nền tảng, database và giao diện khung

[← Overview](00-overview.md) · Dependency: Phase 01 cho cấu trúc contract; được dựng hạ tầng trong khi contract đang review.

## Mục tiêu / mô tả

Tạo project độc lập có thể chạy lặp lại trên máy team, lưu dữ liệu bền vững và cung cấp nền tảng dùng chung cho mọi nghiệp vụ.

## Tech stack

NestJS, TypeScript, React, Vite, PostgreSQL, Prisma, Docker Compose; backend tests và Playwright. Chốt/pin phiên bản tương thích trong lockfile khi khởi tạo.

## Instructions

- Project tên `smartomni-tiktok-simulator`, không thêm module vào Maven reactor.
- Không dùng database, volume hoặc credential production của SmartOmni.
- Docker bind các cổng demo trên localhost theo mặc định. Khi cần truy cập nhóm, phải cấu hình truy cập riêng.
- API theo TikTok, API demo và API quản trị test phải được phân biệt trong router và tài liệu.
- Không để seed/reset/fault injection khả dụng qua adapter TikTok public.
- Dữ liệu seed là dữ liệu giả; mọi reset phải nêu rõ phạm vi và yêu cầu xác nhận thao tác trên UI.

## Steps

1. Dựng backend, frontend và cấu hình lint/typecheck/build/test.
2. Tạo Compose: UI 3090, API 8090, PostgreSQL chỉ trong Docker network; đặt tên volume riêng.
3. Tạo Prisma models/migrations cho shop, seller, buyer, ứng dụng cấp quyền, token; các miền nghiệp vụ được mở rộng trong phase sau.
4. Thêm HTTP request log, webhook job/attempt và thiết lập scenario. Che token/secret trong log.
5. Thiết kế worker claim job nguyên tử, lease và retry bền vững để restart hoặc hai worker không làm mất job. Ghi attempt trước/sau mỗi lần gửi.
6. Tạo seed xác định được: hai shop VN, buyer riêng, sản phẩm/SKU và kho mẫu; seed có thể chạy lặp mà không tạo trùng.
7. Tạo frontend layout và điều hướng Seller, Buyer, Test Console; trạng thái loading/error/empty thống nhất.
8. Tạo volume media/PDF, health checks, cấu hình đường dẫn công khai và callback cho môi trường Docker/host.
9. Thêm Clock nghiệp vụ injectable; thời gian kiểm chữ ký request vẫn dựa vào clock xác thực riêng.
10. Thêm Test Console: trạng thái dịch vụ, shop/scenario, reset, lịch sử HTTP, webhook và bộ lọc theo request ID.

## Output / deliverables

Project chạy bằng Compose, env example không có secret thật, migration/seed, giao diện khung và hướng dẫn local. API test có thao tác seed/reset/clock/fault/replay nhưng không giả làm TikTok API.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Máy mới có thể build/start theo README.
- [ ] Restart không mất dữ liệu, file hoặc lịch sử webhook.
- [ ] Seed lặp không nhân đôi dữ liệu; reset không chạm database SmartOmni.
- [ ] Hai shop không đọc/sửa chéo dữ liệu qua session demo.
- [ ] Worker restart tiếp tục job; lease quá hạn được xử lý và delivery có thể trùng được ghi nhận.
- [ ] Không có secret thật trong repo hoặc log.
- [ ] UI ba khu vực và health checks hoạt động.

## Theo dõi

- Người phụ trách: (chưa gán) — bản dựng ban đầu do agent Phase 02; chưa review bởi người.
- PR/commit: chưa commit (thay đổi nằm trong working tree: `smartomni-tiktok-simulator/` trừ `contracts/` và `docs/` thuộc Phase 01).
- Bằng chứng kiểm thử (ngày 14/10/2026, Windows, Node 22.17, Docker 29.8):
  - Backend: `npm run typecheck`, `npm run lint`, `npm run build` pass; `npm test` = 4 suites / 30 tests pass trên PostgreSQL 16 embedded thật (seed idempotent + đồng thời, reset có token xác nhận theo scope, claim `FOR UPDATE SKIP LOCKED` không trùng, lease hết hạn/crash/restart, fencing late completion, retry/backoff/DEAD, duplicate được ghi, redaction, tách router, cô lập session demo giữa 2 shop, business clock tách auth clock).
  - Frontend: `npm run typecheck`, `lint`, `build`, `npm test` (1 test AsyncState) pass.
  - Docker: `docker compose up --build` chạy; db/api/ui đều healthy; `/health/ready` ok; Postgres không publish cổng; down/up (không `-v`) giữ nguyên seed, lịch sử webhook, log HTTP và file trong volume PDF; webhook thật tới receiver trên host (`host.docker.internal`) retry 500 -> 200 và ghi 2 attempt.
  - Chưa tick checkbox vì chưa có review và chưa kiểm: máy sạch hoàn toàn theo README (cần người khác chạy), UI ba khu vực bằng trình duyệt/Playwright (mới kiểm HTTP 200 + unit test, chưa có e2e UI), hai worker là hai tiến trình/container riêng (chỉ kiểm hai instance trong một process + claim đồng thời trên PG thật).
- Blocker / quyết định bổ sung:
  - Chưa có endpoint TikTok nào (module `tiktok` là stub, chỉ có middleware fault cho API); chờ `contracts/` Phase 01 để Phase 03 thêm. Envelope lỗi của fault API là marker `simulatorFault`, không phải envelope TikTok.
  - Webhook foundation chưa ký và chưa theo schema sự kiện TikTok (Phase 05).
  - Test Console gọi `/test-admin` qua proxy nginx/Vite chèn `x-test-admin-token` ở server; nếu mở `BIND_ADDRESS` ra LAN thì ai vào UI cũng có quyền admin.
  - Tiền lưu `Int` VND; Phase 04+ cần xác nhận định dạng tiền theo contract.
  - Seed app có `scopes` rỗng (không tự bịa scope), redirect URI mặc định chỉ là giá trị cấu hình.
- Ngày hoàn thành: chưa (chờ review và các mục chưa kiểm ở trên).
