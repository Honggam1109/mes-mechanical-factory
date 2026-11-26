# Giám sát vận hành sản xuất (2.4)

> Cập nhật: dữ liệu sản xuất hiện lưu ở SQLite dùng chung giữa các phiên, đọc lại qua API mỗi 3 giây. Bộ mẫu trong tài liệu này là bộ mẫu cũ; bộ demo ba vai trò hiện hành được mô tả trong [hướng dẫn demo](demo-three-roles.md).

## Giao diện và dữ liệu

Thay nhãn Báo cáo tiến độ bằng Giám sát vận hành sản xuất, giữ URL `/workspace/production-progress` để liên kết cũ vẫn mở được. Bộ lọc Đơn vị/Trạng thái/Công đoạn/Từ khóa/Chỉ có vấn đề, các thẻ tổng quan bấm để lọc, lưới Card Trạm, chi tiết Trạm và WO đều lấy dữ liệu nguồn chung của sản xuất.

Giám sát không có nút tạo/sửa/phát hành/phân công/thực thi. Link MO/WO kiểm tra quyền và mở chế độ xem; người chỉ có quyền Giám sát vẫn xem được chi tiết vận hành trong module. Nguyên nhân, máy, nhân viên và ca trong nhật ký sử dụng nhãn đã chụp khi phát sinh.

Cập nhật 15 giây/lần và nút Làm mới. `refreshMasterData` đọc commit mới nhất từ cache dùng chung giữa các tab cùng origin, giữ danh mục nhân viên từ API. Hiển thị lần cập nhật gần nhất. Không dùng số Đạt/NG để tính tiến độ.

## Trạng thái

Trạng thái trạm tính từ các WO chưa hoàn thành/hủy, có stationId đúng Trạm, trong phạm vi người xem. Ưu tiên: Tạm dừng → Quá hạn/Thiếu nhân viên → Đang thực hiện → Sẵn sàng → Chờ công đoạn trước → Chưa đến thời gian → Không có công việc. Trạm tạm dừng đồng thời quá hạn có thêm nhãn Quá hạn.

WO chính được chọn riêng theo mục 2.4.16: đang dừng → đang chạy → sẵn sàng → chờ bước trước → kế hoạch tương lai gần nhất → các WO quá hạn còn lại. Vì vậy có thể có nhãn Quá hạn cho cả trạm trong khi WO chính là công việc đang chạy khác tại trạm. Công việc kế tiếp sắp theo giờ bắt đầu và giới hạn 5; nhật ký gần nhất giới hạn 10.

Thẻ tổng quan đếm theo điều kiện độc lập: một trạm có WO đang chạy và WO quá hạn xuất hiện trong cả hai số liệu. Bấm thẻ trả đúng các trạm đóng góp vào số đó; không cộng các thẻ để suy ra tổng. Bộ lọc Công đoạn xét WO đang chờ/chạy tại Trạm; từ khóa tìm mã/tên Trạm, WO, MO, sản phẩm. Đặt lại giữ Đơn vị, xóa các bộ lọc khác. Cảnh báo sắp hạn dùng ngưỡng 30 phút; thanh tiến độ tối đa 100%, số lượng thực tế vẫn giữ nguyên nếu vượt kế hoạch.

## Dữ liệu mẫu đã thêm

Nhân viên EMP-SX-001…008 được tạo qua API nhân viên hiện có bằng `scripts/seed-production-personnel.mjs` (cần MES_SEED_PASSWORD; không lưu mật khẩu trong mã). Không đổi nhân viên đã có. Bộ mẫu dùng đơn vị Sản xuất hiện hữu (`dept1`), sản phẩm Cụm động cơ 150cc và vật tư hiện có.

Khi có đủ nhân viên và quyền quản trị sản xuất, `seedProductionData` thêm dữ liệu còn thiếu: 1 BOM, 1 quy trình ba bước Lắp ráp → Chạy thử → Hoàn thiện, 9 trạm/máy, 3 ca, 3 nguyên nhân dừng, 10 MO (nháp, hủy, phát hành, đang thực hiện, hoàn thành), 24 WO và phân công theo ca. Mỗi máy thuộc đúng một trạm; mỗi trạm/ca chỉ một người. Bộ mẫu không thay thế bản ghi cũ; tại localhost còn giữ MO/WO/Trạm thử từ lượt trước nên tổng lớn hơn riêng bộ mẫu.

Các kịch bản: đang lắp ráp, chạy thử tạm dừng, chậm tiến độ, sẵn sàng, chờ bước trước, kế hoạch ngày sau, hoàn thành cả ba bước, lệnh hủy và lệnh dự phòng. Có nhật ký sản lượng nhiều lần, phiên dừng đang mở và phiên dừng đã tiếp tục. Ngày mẫu neo theo ca hiện tại khi cài lần đầu, không tự dịch lịch hay xóa lịch sử vào ngày sau.

Nguồn mẫu đi qua nghiệp vụ tạo/phát hành/phân công và kiểm tra nhật ký cùng ràng buộc thực thi. Bộ mẫu chỉ cài một lần khi đã có lệnh dự phòng đánh dấu, không nhân đôi khi refresh. Dữ liệu lịch sử chỉ được thêm, không sửa/xóa nhật ký cũ.

## Phân quyền và giới hạn hiện tại

System DB migration 5 đăng ký PRODUCTION_MONITOR: VIEW với phạm vi VIEW ALL mặc định cho ADMIN. Không có WRITE hoặc quyền thực thi trong tài nguyên này. Hỗ trợ ALL/PRODUCTION_TEAM/SELF; danh mục nhân viên API đọc theo phạm vi Giám sát mà không cấp quyền chỉnh nhân viên.

Dữ liệu sản xuất và dữ liệu gốc frontend vẫn nằm ở cache trình duyệt. Polling đồng bộ các tab cùng origin, chưa phải backend sản xuất nhiều máy. `localhost` và `127.0.0.1` là hai kho trình duyệt riêng; bộ mẫu đã được cài ở cả hai trong kiểm tra này.

## Kiểm tra

- `tests/production-monitor.test.mjs`: cài không trùng, 10 MO/24 WO/24 phân công/9 trạm, tổng từng trạng thái, ưu tiên, bộ lọc kết hợp, phạm vi chỉ xem, nhật ký, tiếp tục/ghi/hoàn thành và dữ liệu sau reload.
- `tests/production-monitor-access.test.mjs`: tài nguyên chỉ VIEW, danh mục nhân viên theo ALL/SELF/đơn vị, từ chối ghi nhân viên, thu hồi quyền.
- Browser: bấm Tạm dừng trả một trạm; chi tiết hiện đúng Trần Quốc Huy, WO chạy thử 200/400 và nguyên nhân/máy dừng. Tại localhost, WO-0011 thực hiện Bắt đầu → ghi 100 → Tạm dừng → Tiếp tục → ghi 500 → Hoàn thành 600; trạm trở thành Không có công việc. Bộ dữ liệu gốc có trước được giữ nguyên.

Kiểm tra polling hai tab: tại localhost ghi thêm 10 cho WO-0002 từ màn Thực thi; tab Giám sát đang mở tự đổi từ 250/500 (50%) sang 260/500 (52%) mà không bấm Làm mới.
