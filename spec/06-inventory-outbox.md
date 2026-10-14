# Phase 06 — Tồn kho và outbox

[← Overview](00-overview.md) · Dependency: Phase 03–05.

## Mục tiêu / mô tả

SmartOmni xử lý tồn kho và đẩy số lượng tuyệt đối mới lên simulator theo SKU/kho, bảo đảm retry không gây trừ hai lần hoặc đánh dấu đã gửi khi sàn báo lỗi.

## Tech stack

NestJS/Prisma, PostgreSQL transactions, Spring Boot Inventory/Integration/Catalog, Quartz outbox worker, Flyway; concurrency và integration tests.

## Instructions

- Khóa mapping gồm tenant/connection, product ID, SKU ID, warehouse ID; không chỉ platformItemId.
- API Update Inventory nhận số lượng theo schema chính thức; fixture phải kiểm quy tắc hợp lệ và response lỗi từng item.
- Bước gọi HTTP không được giữ transaction database dài.
- Order debit dùng idempotency key ổn định; Inventory lưu receipt cùng transaction với thay đổi tồn.
- Outbox phải chứa connection/kho đích. Không hardcode SHOPEE như mã minh họa hiện tại.
- Nếu simulator đã reserve tồn khi Buyer đặt hàng, lệnh đồng bộ tồn từ SmartOmni là đặt số lượng tuyệt đối, không trừ lần nữa.

## Steps

1. Simulator lưu tồn theo SKU/kho; Seller điều chỉnh được và Buyer thấy khả năng mua tương ứng.
2. Triển khai Update Inventory, kiểm product/SKU/warehouse thuộc đúng shop và scope.
3. Ánh xạ request/response partial failure theo contract; fault injection riêng có thể tạo timeout/lỗi trước hoặc sau ghi dữ liệu.
4. Catalog cung cấp mapping kho/kênh cho Inventory qua API nội bộ có xác thực.
5. Inventory trừ tồn nguyên tử, kiểm quantity và đủ hàng, ghi receipt chống trùng + outbox cùng transaction.
6. Order gọi Inventory bằng idempotency key; khi timeout, retry cùng key. Không nuốt lỗi rồi báo xử lý đơn hoàn tất.
7. Outbox claim batch có lease, gửi ngoài transaction, chỉ mark SENT sau khi xác nhận toàn bộ kết quả tương ứng.
8. Retry có backoff, giới hạn và trạng thái failed có thể xử lý lại; chống job cũ ghi tồn thấp/cũ đè lên số mới.
9. Thêm internal service authentication và tenant context đáng tin cho luồng service-to-service.
10. Seller/Test Console hiển thị trước/sau, attempt và trạng thái đồng bộ.

## Input / output mẫu

Ví dụ body theo cấu trúc baseline; constraints và response lấy từ Phase 01:

```json
{
  "skus": [{
    "id": "1729592969712207013",
    "inventory": [{
      "warehouse_id": "7068517275539719942",
      "quantity": 12
    }]
  }]
}
```

Endpoint baseline: POST /product/202309/products/{product_id}/inventory/update.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Trừ tồn đồng thời không âm và không mất cập nhật.
- [ ] Retry cùng idempotency key không trừ lần nữa, kể cả sau restart.
- [ ] Đúng shop/SKU/kho; sai mapping trả lỗi và không sửa dữ liệu khác.
- [ ] HTTP 200 nhưng có lỗi nghiệp vụ/partial error không được mark SENT giả.
- [ ] Timeout sau cập nhật không gây trừ thêm; retry cập nhật tuyệt đối an toàn.
- [ ] Outbox cũ/replay không làm lùi tồn sau cập nhật mới.
- [ ] Luồng đơn → trừ tồn → outbox → simulator chạy với PostgreSQL/RabbitMQ thật.

## Theo dõi

- Người phụ trách: (chưa gán) - agent Phase 06 (phía simulator), chưa review bởi người.
- PR/commit: nhánh `phase-06` (commit `phase-06: inventory absolute update + fault injection ...`), chưa merge/push.
- Đã làm (simulator): `POST /product/202309/products/{product_id}/inventory/update` (đặt số lượng TUYỆT ĐỐI, ký, scope giả `sim.inventory.write`); kiểm product/SKU/kho thuộc đúng shop, phải nêu đủ mọi kho của SKU, `warehouse_id` chỉ được bỏ khi SKU có một kho, quantity trong [1, 99999] (theo OAS), product FREEZE/DELETED bị từ chối; lỗi từng SKU trong `data.errors[]` (envelope code 0, theo fixture OAS), mỗi SKU áp dụng nguyên tử, các SKU hợp lệ khác vẫn được áp dụng (PARTIAL); migration `20261020000000_phase06_inventory` (bảng `InventoryChange` before/after + chuỗi `seq`, `InventoryUpdateAttempt`, 3 FaultKind mới); fault `TIMEOUT_BEFORE_WRITE`, `TIMEOUT_AFTER_WRITE`, `APP_ERROR_200` chỉ dùng cho đường dẫn inventory (không bị middleware/worker khác tiêu thụ); ghi log tồn kho từ API, Seller, đặt hàng/hủy đơn; Seller tab "Inventory" và Test Console tab "Inventory" hiển thị trước/sau + các lần gọi API.
- Bằng chứng (Windows, Node 22, PostgreSQL 16 nhúng, `TEST_PG_PORT=55441`): backend `npm run lint`, `typecheck`, `build` pass; `npm test` = 8 suites / 129 tests pass, 0 skip (19 test mới `tiktok-inventory.e2e-spec.ts`: set tuyệt đối + retry giống hệt cho cùng trạng thái, log no-op, cross-shop không đổi dữ liệu (kể cả khi trùng product/SKU ID), lỗi từng kho/SKU, PARTIAL, envelope 400, FREEZE/DELETED, trùng SKU, thiếu scope/sai chữ ký, TIMEOUT_AFTER_WRITE giữ giá trị mới và retry an toàn, TIMEOUT_BEFORE_WRITE giữ giá trị cũ, APP_ERROR_200 không ghi, fault không bị đường khác tiêu thụ, 9 checkout + 6 update đồng thời không âm và chuỗi before/after liền mạch (không mất cập nhật), hủy đơn hoàn tồn đúng một lần, Buyer mua đúng theo tồn đặt qua API, lịch sử cho Seller đúng quyền, phản hồi hợp lệ với `schemas/ops/product.inventory_update.response.json`). Frontend `typecheck`, `lint`, `build`, `npm test` = 9 test pass (2 mới).
- BLOCKED (cần repo SmartOmni, hiện chỉ để tham khảo): mọi mục Java/RabbitMQ: trừ tồn nguyên tử + receipt idempotency, outbox lease/backoff/không mark SENT khi lỗi 200, chống job cũ ghi đè, xác thực nội bộ, API mapping của Catalog, và tiêu chí "luồng đơn → trừ tồn → outbox → simulator với PostgreSQL/RabbitMQ thật". Yêu cầu chi tiết: `docs/smartomni-requirements/phase-06.md`. Không có test RabbitMQ nào được chạy.
- Quyết định/blocker bổ sung: xem `DECISIONS.md` mục Phase 06 (quantity 0 bị từ chối theo OAS; mã lỗi 12052990/12052097 chỉ là ví dụ trong OAS, chưa xác minh ý nghĩa; hình dạng lỗi từng SKU trong envelope code 0 và việc áp dụng từng phần chưa được xác minh; timeout mô phỏng bằng đóng kết nối). Token cấp trước Phase 06 thiếu scope `sim.inventory.write` và phải cấp quyền lại.
- Ngày hoàn thành: chưa (PARTIAL: phía SmartOmni BLOCKED).
