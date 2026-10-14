# Phase 09 — Coupon và dữ liệu loyalty

[← Overview](00-overview.md) · Dependency: Phase 01, 03, 05, 07; coupon card dùng Phase 08.

## Mục tiêu / mô tả

Tạo dữ liệu coupon trên Seller demo, thử API đọc và việc áp dụng coupon trong checkout giả; cung cấp dữ liệu đơn để kiểm thử Customer Portal tích điểm đúng quy tắc SmartOmni.

## Tech stack

NestJS/Prisma/React, Clock nghiệp vụ, Spring Boot Order và miền Customer Portal/loyalty, Flyway migration mới, email sink local nếu có luồng email được hỗ trợ.

## Instructions

- Không tạo endpoint OpenAPI phát voucher khi chưa xác minh được contract TikTok áp dụng cho shop Việt Nam.
- Tạo coupon trên Seller demo là thao tác tạo dữ liệu sàn giả; không đổi yêu cầu Admin phát voucher qua API thành nhập mã thủ công trong SmartOmni.
- Đọc coupon không chứng minh có quyền tạo hoặc audit sử dụng coupon qua API.
- Customer Portal là tài khoản riêng; không gộp danh tính buyer TikTok với customer SmartOmni.
- Quy tắc 15 ngày là nghiệp vụ SmartOmni để test, không được diễn giải như chính sách hoàn trả TikTok đã được xác minh.
- V7/V8 có phần khác quyết định mới; chỉ sửa bằng migration mới, không sửa lịch sử đã áp dụng.

## Steps

1. Seller demo tạo dữ liệu coupon: thời hạn, trạng thái, điều kiện và đối tượng theo schema đã xác minh; lưu số lượt dùng trong simulator.
2. Triển khai Search Coupon List và Get Coupon; kiểm scope, filter, pagination.
3. Buyer checkout thử coupon hợp lệ/hết hạn/không đạt điều kiện; backend tính giảm giá, snapshot khoản tiền.
4. Nếu hỗ trợ coupon card, kiểm điều kiện card theo Send Message; không mặc định mọi coupon đều gửi được.
5. SmartOmni khóa API tạo voucher chưa xác minh và trả thông báo rõ; không email mã như thể đã được tạo thành công.
6. Bổ sung dữ liệu đơn cần cho loyalty: shop/connection, trạng thái gốc, thời điểm hoàn tất và tiền hàng thực trả có nguồn đối soát.
7. Customer Portal/Order bổ sung claim theo tài khoản đã xác thực và tenant; người claim hợp lệ đầu tiên nhận điểm theo quyết định hiện tại, không tự thêm điều kiện xác minh buyer sàn.
8. Thực thi claim một lần bằng constraint/transaction; kiểm đơn đúng tenant/shop và đã qua 15 ngày kể từ hoàn tất.
9. Tính floor(tiền hàng thực trả sau giảm giá / 1000 VND), không gồm phí vận chuyển/thuế; thiếu chứng cứ tách tiền thì giữ pending reconciliation.
10. Điểm không hết hạn/không tiêu khi nhận ưu đãi; hạng Standard <500, Silver >=500, Platinum >=1000, Diamond >=1500.
11. Test Console tạo dữ liệu trước/sau ngưỡng bằng Clock nghiệp vụ, không thay thời gian xác thực API.

## Input / output

Baseline: POST /promotion/202406/coupons/search, GET /promotion/202406/coupons/{coupon_id}. Không thêm API TikTok claim điểm; đó là API nội bộ SmartOmni.

[Search Coupon List](https://partner.tiktokshop.com/docv2/page/search-coupon-list-202406) là nguồn khởi điểm cho việc đọc coupon. Trạng thái hỗ trợ API tạo voucher ghi trong manifest Phase 01.

## Kiểm thử / tiêu chí hoàn thành

- [ ] Đọc/filter/page coupon đúng schema và shop.
- [ ] Checkout kiểm expiry/điều kiện/số lượng; retry không tăng lượt dùng hai lần.
- [ ] Luồng tạo voucher chưa xác minh bị chặn rõ ràng, không email success.
- [ ] DELIVERED chưa đủ điều kiện; COMPLETED chưa đủ 15 ngày bị từ chối.
- [ ] Đúng ngưỡng 15 ngày và tiền hàng đủ đối soát được tính điểm đúng.
- [ ] Hai request/khách claim đồng thời chỉ có một lần nhận điểm.
- [ ] Sai tenant/shop bị từ chối; không tin customer_id tùy ý từ client.
- [ ] Không dùng total_amount gồm ship/thuế để cộng điểm.
- [ ] Ngoại lệ hoàn/trả sau mốc claim được ghi pending decision; không tự thay chính sách điểm.

## Theo dõi

- Người phụ trách:
- PR/commit:
- Bằng chứng kiểm thử:
- Blocker / quyết định bổ sung:
- Ngày hoàn thành:

