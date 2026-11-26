# Demo phân quyền và luồng MO → WO → thực thi

## Chạy và đăng nhập

Chạy `npm.cmd run dev`, mở http://localhost:8443. API cùng origin được Vite phục vụ; không cần chạy thêm backend. Bản build dùng `npm.cmd run build` rồi `npm.cmd start` (cổng mặc định 3001).

| Tài khoản | Mật khẩu lúc khởi tạo | Màn hình |
|---|---|---|
| admin | Giữ nguyên mật khẩu hiện có | Toàn bộ hệ thống |
| kehoach | Demo@123456 | Lệnh sản xuất |
| totruong | Demo@123456 | Phân công sản xuất; Giám sát vận hành sản xuất |
| thucthi | Demo@123456 | Thực thi sản xuất |

Database local hiện tại giữ mật khẩu admin đã đặt trước đó. Không ghi đè mật khẩu khi khởi động lại. Ba tài khoản demo được tạo bổ sung bằng migration 6; nếu username đã tồn tại thì không chiếm tài khoản đó. Mật khẩu demo đáp ứng policy hiện tại và có thể đổi trong Hồ sơ/Bảo mật.

Dùng các hồ sơ Chrome riêng, hoặc Chrome + Edge + phiên ẩn danh. Các cửa sổ thường của cùng một hồ sơ dùng chung cookie nên không phải ba phiên độc lập. Dùng cùng địa chỉ server; dữ liệu sản xuất giờ dùng chung SQLite kể cả khác trình duyệt. Các trình duyệt đọc lại dữ liệu mỗi 3 giây.

## Quyền

- Kế hoạch: PRODUCTION_ORDER VIEW/CREATE/UPDATE/DELETE/EXPORT/RELEASE, VIEW/WRITE ALL. Chỉ sửa/xóa nháp; phát hành chốt BOM/quy trình và sinh WO.
- Tổ trưởng: PRODUCTION_ASSIGNMENT VIEW/ASSIGN và PRODUCTION_MONITOR VIEW, phạm vi PRODUCTION_TEAM. Nhân viên liên kết thuộc `demo-team-a`. Không có quyền thực thi hoặc quản trị.
- Công nhân: PRODUCTION_EXECUTION VIEW/START/EXECUTE/PAUSE/RESUME/COMPLETE, VIEW/WRITE SELF. Liên kết nhân viên `demo-worker`; xác nhận thực thi phải đúng phân công của chính nhân viên trong ca hiện tại.
- Admin giữ nguyên quyền hiện có. Dữ liệu gốc/BOM/quy trình và các màn không được cấp riêng chỉ mở cho quản trị viên. Kiểm tra menu, URL, màn hình và API độc lập.

## Dữ liệu sẵn có

Lần đầu truy cập API sản xuất, hệ thống chuẩn bị các danh mục demo và một MO nháp 100 sản phẩm. Một MO khác của tổ B có ghi chú `demo-out-of-scope` để kiểm tra phạm vi. Tổ trưởng A và công nhân A không nhận lệnh tổ B trong phản hồi API.

- TP-DEMO-01: Trục truyền động, số lượng 100.
- VT-DEMO-01: Thép tròn C45, định mức 2,5 Kg; VT-DEMO-02: Dầu cắt gọt, định mức 0,05 Lít. Nhu cầu cho 100 trục là 250 Kg và 5 Lít.
- BOM và quy trình demo đang áp dụng; mã sinh theo quy tắc hiện có, nhận biết bằng tên/description demo.
- Sáu công đoạn: Cắt phôi (10) → Tiện (20) → Phay rãnh then (30) → Nhiệt luyện (40) → Mài (50) → KCS (60).
- Tổ gia công cơ khí A, sáu trạm TR-DEMO-01…06 theo đúng thứ tự công đoạn, mỗi trạm một máy.
- Ca demo ban ngày 06:00–18:00 và ban đêm 18:00–06:00, giờ Việt Nam. Lịch được chuẩn bị theo ca hiện tại, chia đều phần còn lại của ca cho sáu công đoạn; ca đêm trước 06:00 thuộc ngày hôm trước. Nên khởi tạo dữ liệu khi ca còn ít nhất 2 giờ.
- Nguyên nhân dừng: Chờ phôi, Thay dao, Chỉnh gá, Hỏng máy.

MO nháp chỉ được tạo một lần khi khởi tạo database. Muốn có lịch mới: tắt server, xóa `server/data/` rồi chạy lại (mất toàn bộ tài khoản và dữ liệu đã nhập), hoặc `kehoach` tự lập MO trong ca hiện tại. Tránh chuyển ca trong lúc trình diễn.

## Trình diễn 10–15 phút

### Lịch sử mẫu để tra cứu

Hệ thống bổ sung một lần **6 MO lịch sử** trong 7 ngày trước thời điểm cài bộ mẫu: 5 MO hoàn thành (80, 100, 120, 90/100 và 150 sản phẩm), 1 MO 60 sản phẩm hủy trước thực thi. Tổng thành phẩm lịch sử là **540**; mỗi lệnh có sáu WO, phân công đúng tổ/trạm/người và thời gian thực tế. Có **124 sự kiện** bắt đầu, ghi sản lượng, dừng, tiếp tục, hoàn thành; hai lần dừng 10 phút vì chờ phôi. Lệnh hoàn thành 90/100 có lý do thiếu 10 sản phẩm.

Các bản ghi có ghi chú **LỊCH SỬ DEMO** để phân biệt dữ liệu mô phỏng. Kế hoạch xem MO; tổ trưởng xem phân công/chi tiết/giám sát của tổ A; công nhân xem các WO đã hoàn thành được giao cho mình và nhật ký. MO hủy không còn phân công ACTIVE nên không nằm trong phạm vi SELF của công nhân. Lọc MO bằng trạng thái, ngày hoặc từ khóa `LỊCH SỬ DEMO`. Danh sách WO ưu tiên công việc chưa kết thúc trước lịch sử để dễ tiếp tục demo trực tiếp.

Bộ lịch sử được nạp tự động khi khởi tạo, không tạo trùng. Fixture đi qua quy tắc nghiệp vụ với đồng hồ riêng trong module backend, không đổi giờ hệ thống hay nhận thời gian thực thi từ client. Nhật ký ghi đúng các tài khoản `kehoach`, `totruong`, `thucthi`; audit nhập mẫu ghi tài khoản admin.

1. Đăng nhập `admin`, mở Lệnh sản xuất; ghi lại mã MO nháp.
2. `kehoach` mở MO đó, kiểm tra sản phẩm/100 trục/sáu công đoạn/vật tư, lưu nháp nếu sửa rồi Phát hành. Hoặc tạo MO thủ công từ sản phẩm và quy trình demo.
3. `totruong` vào Phân công sản xuất. Để kịp thời gian, chỉ phân công hai WO đầu: WO Cắt phôi chọn/lưu TR-DEMO-01, thêm ngày/ca demo hiện tại, Nguyễn Văn An (`demo-worker`), giờ phân công theo kế hoạch gợi ý. WO Tiện làm tương tự với TR-DEMO-02. Hai khoảng giờ nối tiếp, không giao nhau.
4. `thucthi` vào Thực thi: danh sách “Công việc được giao cho tôi” hiển thị hai WO vừa giao. Mở WO đầu; WO sau chưa được phép Bắt đầu trước khi WO đầu hoàn thành.
5. Bắt đầu WO đầu, ghi sản lượng **40**. Tổ trưởng mở Giám sát, thấy số lượng/trạng thái tự cập nhật.
6. Công nhân Tạm dừng với nguyên nhân “Chờ phôi”; tổ trưởng xem nguyên nhân/thời lượng. Khi dừng, ghi sản lượng bị chặn.
7. Công nhân Tiếp tục, ghi thêm **60**, xác nhận Hoàn thành WO đầu.
8. Mở WO thứ hai, Bắt đầu (có thể sớm hơn dự kiến), ghi **100**, xác nhận Hoàn thành.
9. Kế hoạch mở MO: trạng thái Đang thực hiện, hai công đoạn đầu đã hoàn thành. Mở một MO **LỊCH SỬ DEMO** để minh hoạ lệnh đã hoàn thành đủ sáu công đoạn: sản lượng MO lấy theo công đoạn cuối (KCS), không cộng dồn các công đoạn.
10. Chứng minh phân quyền: công nhân không thấy menu Lệnh/Phân công; tổ trưởng không có nút thực thi. URL trái quyền về 403; API cũng từ chối, không chỉ ẩn nút.

Ghi sản lượng là số phát sinh, không nhập số lũy kế. Đủ số lượng không tự hoàn thành: cần xác nhận. Chưa triển khai tích hợp trừ tồn, nhập kho thành phẩm hay phân loại chất lượng Đạt/NG trong luồng demo này.

## Thời gian và tính nhất quán

Phân công mới có `plannedStart`/`plannedEnd`, phải nằm trong cả ca và kế hoạch công đoạn. Dữ liệu cũ thiếu hai trường này vẫn dùng toàn ca. Không giao một nhân viên sang hai trạm trong các khoảng giao nhau.

Bước sau được bắt đầu sớm khi các bước trước hoàn thành, còn trong ca, chưa hết khoảng phân công và không xung đột nhân viên/trạm. Lịch dự kiến giữ nguyên; thời gian bắt đầu thực tế nằm trong nhật ký START. Không sửa lịch sử để giả lập thời gian. Nhân viên/trạm còn một WO đã bắt đầu chưa hoàn thành thì không mở thêm WO khác.

Backend chạy lại nghiệp vụ từ nguồn SQLite, không tin user/employee/time/status do client gửi. Giao dịch gồm trạng thái MO/WO, phân công, nhật ký và audit. Revision cũ trả 409 và UI tải lại để người dùng kiểm tra trước khi thử lại. Request ID bảo vệ việc gửi lặp cùng một giao dịch. Nhật ký cũ không cho sửa/xóa.

`server/domain-loader.mjs` nạp các quy tắc TypeScript dùng chung của frontend/tests vào module graph riêng cho từng database. Vì vậy khi triển khai cần giữ thư mục `src`, `server` và dependency runtime `typescript` cùng `dist`.

## Dữ liệu cũ và kiểm tra

Cache trình duyệt cũ `mes-linked-master-data-v1` vẫn được giữ, không tự nhập/ghi đè vào SQLite. Sau đăng nhập, màn nghiệp vụ dùng snapshot server làm nguồn chính; không trộn dữ liệu từ các trình duyệt khác nhau. Nhân viên và tài khoản hiện có trong SQLite được giữ nguyên. Các nghiệp vụ Kho cũ vẫn nằm ngoài luồng backend sản xuất này.

`npm.cmd run check` chạy TypeScript, toàn bộ test và build. `tests/production-backend.test.mjs` dùng database tạm và bốn phiên HTTP độc lập, kiểm tra phân quyền server, dữ liệu liên thông, sáu công đoạn cùng ca, bắt đầu sớm, dừng/tiếp tục, số lượng công đoạn cuối, chống gửi lặp, revision cũ, audit và persistence. Không ghi nhật ký thực thi thử lên database demo thật.
