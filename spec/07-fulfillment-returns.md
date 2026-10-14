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

### 07a (steps 1-4) - phía simulator

- Người phụ trách: (chưa gán) - agent Phase 07a, chưa review bởi người.
- PR/commit: branch `phase-07a` (xem `git log`).
- Đã làm: migration `20261040000000_phase07a_fulfillment` (Package, PackageLine, TrackingEvent, ShippingDocument); package tạo khi đơn vào AWAITING_SHIPMENT (TO_FULFILL), sắp xếp giao -> PROCESSING (+ mã vận đơn giả `SIM` + 11 số), lấy hàng -> FULFILLING, giao -> COMPLETED, hủy -> CANCELLED, đi qua `OrdersService.transition` (listener cùng transaction) nên package/tracking/`PACKAGE_UPDATE` luôn khớp đơn; chặn ON_HOLD/UNPAID bằng mã `order_on_hold`; API `GET .../orders/{id}/tracking`, `GET .../packages/{id}`, `GET .../packages/{id}/shipping_documents`, `POST .../packages/{id}/ship`; PDF test (SHIPPING_LABEL, PACKING_SLIP, cả hai) lưu ở `PDF_DIR/shipping`, URL `PUBLIC_API_BASE_URL/demo/files/shipping-documents/<token>.pdf` (route ngoài router TikTok, công khai nhưng token 48 hex khó đoán); UI Seller (Shipping), Buyer (Tracking), Test Console (Fulfillment); `order.packages[]` và `line_items[].package_id` trong API đơn hàng.
- Bằng chứng: xem commit message / báo cáo (jest toàn bộ + 16 test mới `tiktok-fulfillment.e2e-spec.ts`: ON_HOLD bị chặn, tracking theo chuyển trạng thái (mili giây), PDF tải được, byte giống nhau sau "restart" (app mới đọc lại file), cô lập shop, scope, schema OAS, PACKAGE_UPDATE cùng transaction, ship lặp lại không tạo package thứ hai).
- BLOCKED: bước 4 (API nghiệp vụ SmartOmni lấy tracking/vận đơn có kiểm tenant) - repo platform chỉ để tham khảo; yêu cầu ở `docs/smartomni-requirements/phase-07.md`. Chưa có e2e trình duyệt cho giao diện này; chưa kiểm trong Docker (PDF qua volume dựa vào volume `tiktok_sim_pdf` đã có từ Phase 02).
- Quyết định/blocker: `DECISIONS.md` mục "Phase 07a". Hết hạn URL 24 giờ không được thực thi; `package_status` trước khi sắp xếp dùng `TO_FULFILL` (giá trị OAS của line item) vì enum package không có giá trị tương ứng; mọi mã lỗi là test fault của simulator.
- Ngày hoàn thành: chưa (PARTIAL).

### 07b (steps 5-9)

- Người phụ trách:
- PR/commit:
- Bằng chứng kiểm thử:
- Blocker / quyết định bổ sung:
- Ngày hoàn thành:
