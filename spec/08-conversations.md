# Phase 08 — Hội thoại và CSKH

[← Overview](00-overview.md) · Dependency: Phase 01–05; các card đơn/hoàn trả dùng Phase 07 khi cần.

## Mục tiêu / mô tả

Buyer gửi tin trong demo; SmartOmni nhận hội thoại, Staff trả lời qua API và Buyer thấy phản hồi. Hỗ trợ kiểm thử phân loại/chuyển xử lý khiếu nại của SmartOmni.

## Tech stack

NestJS/Prisma, React chat, webhook queue, media volume, Spring Boot Integration và Java AI gateway; API/contract tests và Playwright.

## Instructions

- Hội thoại phân biệt theo shop/customer sàn. Giữ user_id và im_user_id riêng; chỉ nối với order khi định danh đã được xác minh.
- Chỉ đồng bộ từ thời điểm kết nối theo quyết định sản phẩm; không tự nhập toàn bộ lịch sử trước đó.
- Nội dung hỗ trợ phải nằm trong contract: không tự thêm sticker/file nếu phiên bản API không cho phép.
- AI trong inbox chỉ phân loại thường/khiếu nại. Không tự soạn hoặc tự gửi trả lời.
- Simulator cung cấp dữ liệu test; không dùng nhãn seed làm kết quả AI thật.
- Timeout gửi tin là trạng thái chưa rõ khi không biết sàn đã nhận hay chưa; không retry mù gây gửi trùng.

## Steps

1. Simulator lưu conversation, participants, message và timestamps; UI Buyer/Seller đọc/gửi văn bản và các loại media/card được hỗ trợ.
2. Triển khai API đọc conversation/messages, phân trang và API gửi; xác thực scope + quyền trên hội thoại.
3. Thêm upload/media contract đã được xác minh; loại chưa hỗ trợ phải hiện rõ trên UI.
4. Phát webhook tin mới nếu contract được khóa; bổ sung polling bù và watermark theo shop.
5. SmartOmni Integration lưu hội thoại/tin, deduplicate external message ID trong connection, cung cấp API inbox/đọc/trả lời.
6. Audit người gửi, thời điểm và kết quả; dùng API trả lời cùng adapter với production.
7. Nối Java AI gateway với classifier theo interface thực tế; khi thiếu Python service, đánh dấu kiểm thử AI bị chặn hoặc dùng test double được ghi rõ.
8. Khiếu nại khóa phiên: tin tiếp theo bỏ qua classifier, chuyển Staff; Staff đánh dấu giải quyết mới mở lại.
9. Test Console tạo message trùng, mất event, thiếu quyền, API timeout và trường hợp không khớp buyer identity.

## Input / output mẫu

Send Message 202606 dùng content là chuỗi JSON serialize:

```json
{
  "type": "TEXT",
  "content": "{\"content\":\"Shop đã nhận yêu cầu của bạn.\"}",
  "sender_role": "CUSTOMER_SERVICE"
}
```

```json
{
  "code": 0,
  "message": "Success",
  "request_id": "test-request-001",
  "data": { "message_id": "7494560109732334261" }
}
```

[Schema nguồn](https://partner.tiktokshop.com/docv2/page/send-message-202606). Danh sách đọc baseline 202309, chi tiết hội thoại 202601; Phase 01 khóa phiên bản từng operation.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Buyer gửi → SmartOmni nhận → Staff trả lời → Buyer thấy đúng tin.
- [ ] Nhiều trang, polling bù và webhook trùng không nhân đôi tin.
- [ ] Không đọc/trả lời chéo shop hoặc tenant.
- [ ] Content serialize và media/card đúng schema.
- [ ] Thiếu scope/timeout thể hiện trạng thái đúng, không báo đã gửi giả.
- [ ] Phiên khiếu nại khóa/mở đúng; audit phân loại và Staff.
- [ ] Báo cáo test phân biệt integration với AI thật và test double.

## Theo dõi

- Người phụ trách:
- PR/commit:
- Bằng chứng kiểm thử:
- Blocker / quyết định bổ sung:
- Ngày hoàn thành:

