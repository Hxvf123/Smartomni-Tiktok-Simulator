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

- Người phụ trách: (chưa gán) - agent Phase 08, chưa review bởi người.
- PR/commit: nhánh `phase-08` (worktree), commit `phase-08: conversations API + chat UI` - xem `git log phase-08`.
- Phạm vi đã làm (phía simulator): migration `20261030000000_phase08_conversations` (Conversation/ChatMessage; user_id và im_user_id tách riêng; tin lưu dạng chuỗi JSON); API ký `GET /customer_service/202309/conversations` (cursor, tối đa 20), `GET .../conversations/{id}/messages` (cursor, tối đa 10, sort theo create_time/index, need_data), `GET /customer_service/202601/conversations/{id}`, `POST /customer_service/202309/conversations/{id}/messages` (chỉ TEXT, tối đa 2000 ký tự); scope giả `sim.conversation.read|write`; webhook `NEW_MESSAGE` (mỗi tin) và `NEW_CONVERSATION` (agent vào/ra) qua outbox cùng transaction; Test Console: mất event, event kép, agent vào/ra, chặn gửi, cắt phản hồi gửi (gửi đã lưu nhưng người gửi không nhận kết quả), tạo hội thoại từ TikTok user không khớp buyer; chat Buyer/Seller (chỉ văn bản, hiển thị rõ loại tin chưa hỗ trợ); dữ liệu seed gồm lịch sử cũ, một hội thoại có nhãn `complaint test label` (nhãn dữ liệu test, không phải kết quả AI) và hội thoại danh tính không khớp.
- Chủ ý KHÔNG hỗ trợ (báo rõ, không giả): Send Message 202606 (không có snapshot schema) -> 501 `unsupported_operation`; Upload Image (multipart, ký chưa xác minh) -> 501; IMAGE/VIDEO/card -> 400 "TEXT only".
- Bằng chứng (Windows, Node 22, PostgreSQL 16 nhúng): xem commit message cho số test; backend `tiktok-conversations.e2e-spec.ts` 22 test (Buyer gửi -> API đọc -> shop trả lời bằng API ký -> Buyer thấy; phân trang hai chiều không sót/trùng; schema OAS; cô lập shop/buyer; scope; webhook cùng transaction, mất/kép event; lỗi HTTP trước khi ghi; cắt phản hồi; đồng thời cấp index tăng dần; seed idempotent); frontend `Chat.test.tsx` 3 test.
- BLOCKED / chưa làm: toàn bộ phần SmartOmni (lưu hội thoại, dedupe, inbox, audit, khóa phiên khiếu nại) - ghi tại `docs/smartomni-requirements/phase-08.md`. AI thật: BLOCKED (classifier Python nằm ngoài repo; mọi kiểm thử AI phải dùng test double ghi rõ). Playwright chưa chạy cho chat (để Phase 10). Tiêu chí "Buyer gửi → SmartOmni nhận → Staff trả lời" mới chứng minh được đến phía API simulator.
- Quyết định: xem `DECISIONS.md` mục Phase 08.
- Ngày hoàn thành: chưa (PARTIAL).
