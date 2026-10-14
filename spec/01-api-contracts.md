# Phase 01 — Khóa contract TikTok

[← Overview](00-overview.md) · Dependency: không có.

## Mục tiêu / mô tả

Tạo nguồn contract dùng chung cho simulator, adapter SmartOmni và bộ test. Kết quả phải cho biết endpoint nào mô phỏng được, schema nào được dùng và phần nào chưa xác minh cho shop Việt Nam.

## Tech stack

OpenAPI / JSON Schema, TypeScript types, JSON fixtures, Postman collection; nguồn OAS từ skill `tts-openapi-guide` và tài liệu Partner Center chính thức.

## Instructions

- OAS cài kèm chỉ là baseline, không phải bằng chứng về phiên bản mới nhất.
- So sánh các phiên bản cùng nghiệp vụ; chọn bản mới nhất áp dụng đúng thị trường/luồng. Không đổi nghiệp vụ vì một endpoint khác có số phiên bản lớn hơn.
- Ghi nguồn, ngày truy cập, scope, thị trường, lý do chọn phiên bản và chênh lệch OAS/docv2.
- Chưa xác minh applicability phải ghi là chưa xác minh, không tuyên bố shop Việt Nam thật được cấp quyền.
- Thiếu schema hoặc quy tắc ký quan trọng: đánh dấu operation chưa hỗ trợ và ghi blocker; không tự suy diễn trường/enum/mã lỗi.

## Baseline để đối chiếu

| Nghiệp vụ | Method và path baseline |
|---|---|
| Shop đã cấp quyền | GET /authorization/202309/shops |
| Tìm sản phẩm | POST /product/202502/products/search |
| Chi tiết sản phẩm | GET /product/202309/products/{product_id} |
| Kho | GET /logistics/202309/warehouses |
| Cập nhật tồn | POST /product/202309/products/{product_id}/inventory/update |
| Tìm đơn | POST /order/202309/orders/search |
| Chi tiết đơn | GET /order/202507/orders |
| Tracking | GET /fulfillment/202309/orders/{order_id}/tracking |
| Vận đơn | GET /fulfillment/202309/packages/{package_id}/shipping_documents |
| Tìm yêu cầu trả hàng | POST /return_refund/202309/returns/search |
| Danh sách hội thoại | GET /customer_service/202309/conversations |
| Danh sách tin nhắn | GET /customer_service/202309/conversations/{conversation_id}/messages |
| Chi tiết hội thoại | GET /customer_service/202601/conversations/{conversation_id} |
| Gửi tin | POST /customer_service/202606/conversations/{conversation_id}/messages |
| Tìm coupon | POST /promotion/202406/coupons/search |
| Chi tiết coupon | GET /promotion/202406/coupons/{coupon_id} |
| Cấu hình webhook | GET, PUT, DELETE /event/202309/webhooks |

Bổ sung contract authorization URL, token exchange/refresh, upload media, xử lý hoàn trả và từng webhook cần dùng từ nguồn chính thức. Không tự tạo đường dẫn cho operation chưa có trong bảng.

## Steps

1. Lập manifest operation gồm capability, method/path/version, nguồn, scope, applicability và trạng thái hỗ trợ.
2. Lưu snapshot OAS chính thức và phần bổ sung từ docv2; ghi rõ nguồn gốc, không lưu secret/tài khoản thật.
3. Khóa parameters/header/body/response, required fields, kiểu tiền/ID, timestamp, pagination, enum và lỗi cho từng operation.
4. Thu thập thuật toán ký API, ký webhook và test vector độc lập từ tài liệu chính thức.
5. Tạo fixtures: thành công, rỗng, nhiều trang, invalid input, token hết hạn, thiếu quyền; fixture lỗi chưa có tài liệu phải được phân loại là test fault.
6. Tạo Postman/cURL mẫu với biến môi trường và script ký request; không nhúng secret thật.
7. Viết validator contract dùng ở cả request/response tests; không chỉ kiểm tra HTTP 200.
8. Review manifest trước khi các phase nghiệp vụ sử dụng; cập nhật liên kết contract trong tài liệu của từng nhóm.

## Output / deliverables

Trong project simulator: `contracts/` chứa manifest, snapshots, schema, fixtures, nguồn và ngày xác minh; collection và ví dụ gọi trong `docs/`. Mỗi endpoint có ví dụ input/output đầy đủ thay vì chỉ envelope.

Envelope phổ biến cần kiểm tra theo từng operation: `code`, `message`, `request_id`, `data`. Token endpoints và webhook phải có schema riêng, không mặc định dùng chung envelope.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Tất cả capability trong overview có operation đã khóa hoặc blocker có lý do.
- [ ] Phân biệt API thật, API demo và API test.
- [ ] Có fixture và validation cho mỗi operation được hỗ trợ.
- [ ] Có test vector signing được đối chiếu độc lập.
- [ ] Đã ghi gap: Send Message 202606 thiếu trong OAS cũ; RMA 202604 không tự thay Search Returns.
- [ ] API tạo coupon chưa xác minh bị khóa; danh sách giới hạn được review.

## Nguồn

[Common parameters](https://partner.tiktokshop.com/docv2/page/common-parameters),
[Send Message](https://partner.tiktokshop.com/docv2/page/send-message-202606),
[Search Coupon List](https://partner.tiktokshop.com/docv2/page/search-coupon-list-202406).

## Theo dõi

- Người phụ trách:
- PR/commit: chưa commit (bản nháp 14/10/2026)
- Bằng chứng kiểm thử: `smartomni-tiktok-simulator/contracts/validator/contract.test.ts` — 10/10 pass (`node --experimental-strip-types --test contracts/validator/contract.test.ts`, chạy từ `smartomni-tiktok-simulator/`). Test vector ký (5 API gồm body JSON/PUT/UTF-8 + 1 webhook) khớp giữa 4 công cụ (hàm ký của broker cục bộ trong TTS Open Toolkit, `sign.ts`, Python, OpenSSL; chỉ 2 cái đầu tự dựng chuỗi cần ký, 2 cái sau chỉ chạy lại HMAC); chưa có vector công bố của TikTok.
- Cập nhật 14/10/2026 (lượt 2): đã có OAS chính thức (`tts-openapi-guide`, `@tts-open-toolkit/cli` 0.1.7). 32 operation có snapshot OAS (`contracts/snapshots/oas/`), schema/fixture sinh từ snapshot (`schemas/ops/`, `fixtures/ops/`: success, empty, multi-page, invalid input, token hết hạn, thiếu quyền). Manifest v0.2.0 có 49 operation: trước 29 unverified + 7 unsupported (36), sau 46 unverified + 3 unsupported, 0 supported. Quy tắc ký: body JSON thô nối sau query đã sắp xếp, trước secret cuối (bằng chứng gián tiếp: bộ ký của proxy broker cục bộ trong TTS Open Toolkit, không phải quy tắc phía server; chưa đọc được trang Common parameters nên chưa coi là đã xác minh; multipart và cửa sổ timestamp phía server chưa rõ). Webhook `NEW_MESSAGE` có tồn tại (chuyển sang unverified). Khóa tạo coupon giữ nguyên.
- Blocker / quyết định bổ sung: docv2 vẫn là SPA (không đọc được) nên chưa operation nào đạt `supported`: thiếu trang Common parameters (ký, timestamp), scope, mã lỗi, URL cấp quyền, schema token, payload/`type` webhook, Send Message 202606 và RMA 202604; OAS không có cờ required/enum có cấu trúc; ký multipart (upload) chưa xác minh; chưa xác minh shop Việt Nam (OAS không liệt kê region VN, chỉ VND/vi-VN/VN rải rác). Quyết định team cần chốt: (1) chấp nhận 0 supported đến khi có người có quyền Partner Center xuất trang Common parameters/token/authorization/webhook; (2) Send Message dùng 202606 hay 202309 (`cs.send_message_202309`); (3) hành động fulfillment/hoàn trả nào Phase 07 mô phỏng (đã tách `fulfillment.package_*`, `return.*`, `cancellation.*`). Chi tiết: `smartomni-tiktok-simulator/contracts/README.md`, `contracts/signing/README.md`.
- Ngày hoàn thành: chưa hoàn thành

