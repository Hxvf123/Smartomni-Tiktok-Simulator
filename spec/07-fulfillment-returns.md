# Phase 07 — Vận chuyển, hủy, hoàn và trả hàng

[← Overview](00-overview.md) · Dependency: Phase 01, 03, 05, 06.

## Mục tiêu / mô tả

Mô phỏng các bước sau khi đặt hàng để SmartOmni thử đọc tracking, tải/in vận đơn và đồng bộ hủy/hoàn/trả toàn phần hoặc một phần.

## Tech stack

NestJS/Prisma, PDF generator và media volume, React Seller/Buyer, Spring Boot Integration/Order, webhook worker; contract tests và PDF/download smoke tests.

## Instructions

- Chỉ thao tác fulfillment khi trạng thái cho phép; không bỏ qua ON_HOLD.
- PDF ghi rõ dữ liệu test, không dùng mã vận chuyển thật.
- Return/refund có trạng thái riêng; không tự biến mọi yêu cầu hoàn một phần thành toàn đơn RETURNED.
- Endpoint tạo/duyệt/từ chối trả hàng phải được Phase 01 khóa trước; nếu chỉ có contract đọc, thao tác tạo tình huống chạy qua /demo.
- RMA 202604 không mặc nhiên thay API Search Returns.
- Chốt ownership việc hoàn tồn theo trạng thái/line item và idempotency; không vừa simulator vừa SmartOmni cộng tồn hai lần.

## Steps

1. Tạo package, tracking events và tài liệu vận đơn giả gắn với đúng shop/order.
2. Seller UI có thao tác xử lý giao hàng hợp lệ; Buyer xem tiến độ.
3. Triển khai API tracking và shipping documents theo schema, trả URL tải được từ môi trường SmartOmni.
4. Integration/Order thêm API nghiệp vụ lấy tracking/vận đơn cho người dùng có quyền.
5. Buyer tạo yêu cầu hủy/hoàn/trả với line items/số lượng/lý do; Seller chấp nhận/từ chối qua demo.
6. Lưu aftersale request, lịch sử, tiền hoàn và số lượng theo line; kiểm số lượng đã mua/đã hoàn.
7. Triển khai Search Returns và các API hành động đã được xác minh; phát webhook tương ứng nếu contract được khóa.
8. SmartOmni đồng bộ bằng webhook/polling, lưu nguyên trạng thái nguồn và update time.
9. Đưa trường hợp thiếu mapping, thiếu quyền hoặc trạng thái mâu thuẫn vào hàng xử lý lỗi có audit.

## Input / output

Baseline: GET /fulfillment/202309/orders/{order_id}/tracking,
GET /fulfillment/202309/packages/{package_id}/shipping_documents,
POST /return_refund/202309/returns/search.

Fixtures gồm package hợp lệ, order chưa giao được, PDF tải thành công, return một phần/toàn phần, lỗi không thuộc shop và sự kiện đến sai thứ tự.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Chặn giao khi ON_HOLD; tracking phản ánh chuyển trạng thái.
- [ ] URL PDF hoạt động trong Docker và host, file còn sau restart.
- [ ] Người dùng khác tenant không tải vận đơn hoặc đọc địa chỉ.
- [ ] Hoàn một phần không làm mất phần còn lại; số tiền/số lượng không vượt mức hợp lệ.
- [ ] Retry/replay không hoàn tiền hoặc hoàn tồn hai lần.
- [ ] SmartOmni không cho sửa tay completed/returned trái nguồn sàn.
- [ ] Thiếu API/scope được báo rõ, không giả xác nhận thành công.

## Theo dõi

- Người phụ trách:
- PR/commit:
- Bằng chứng kiểm thử:
- Blocker / quyết định bổ sung:
- Ngày hoàn thành:

