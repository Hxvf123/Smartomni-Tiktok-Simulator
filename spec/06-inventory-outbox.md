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

- Người phụ trách:
- PR/commit:
- Bằng chứng kiểm thử:
- Blocker / quyết định bổ sung:
- Ngày hoàn thành:

