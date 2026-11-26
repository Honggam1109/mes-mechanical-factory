# Thực thi sản xuất (đặc tả 2.3)

> Cập nhật: luồng sản xuất hiện dùng API/SQLite chung và có ba vai trò demo. Phân công mới theo khoảng giờ trong ca, hỗ trợ công đoạn sau bắt đầu sớm có kiểm tra xung đột. Các mô tả cache cục bộ/không có backend bên dưới là bối cảnh triển khai trước đây. Xem [hướng dẫn hiện hành](demo-three-roles.md).

## Luồng và dữ liệu

URL `/workspace/production?unit=<id>&station=<id>`; mở WO bằng `&record=<woId>`. Chọn đơn vị sẽ xóa trạm/WO cũ. Chỉ lấy WO có `stationId` đúng Trạm, đồng thời kiểm tra quyền VIEW và phạm vi. Không lấy WO theo khả năng công đoạn.

Thông tin MO, sản phẩm, BOM/phiên bản quy trình, công đoạn, số lượng và lịch kế thừa từ bản chụp khi phát hành. Trạm/đơn vị/máy kế thừa cấu hình phân công và dữ liệu gốc; không chỉnh tại Thực thi. Trang dùng lại FilterPanel, DataTable, FormHeader, StatusBadge, cảnh báo chưa lưu.

Ca hiện tại dùng giờ hệ thống, khoảng [bắt đầu, kết thúc). Ca đêm xác định cả ngày hôm trước: lúc 01:00 ngày 03/11, ca 22:00–06:00 thuộc ngày làm việc 02/11. Nhân viên lấy phân công ACTIVE của Trạm/ngày/ca, ưu tiên bản ghi của WO đang mở; nếu cùng nhân viên nhận nhiều WO cùng Trạm thì vẫn chỉ một người hiện tại. Xung đột nhiều nhân viên bị chặn. Nhân viên phải còn hoạt động và thuộc đơn vị Trạm. Hệ thống cập nhật đồng hồ mỗi giây; Làm mới chỉ đọc lại thông tin, không sửa nhật ký.

## Thao tác

`executeWork` tự lấy thời gian/nhân viên/ca/trạm/người thao tác từ nguồn hiện tại, không nhận các trường này để sửa tay. Kiểm tra quyền/phạm vi và dữ liệu lại lúc xác nhận; commit chung MO và nhật ký, rollback nếu lưu thất bại.

- Bắt đầu: đúng trạm đang chọn, Trạm/đơn vị hoạt động, đã đến kế hoạch, có nhân viên hiện tại, MO còn phát hành/đang chạy, WO đã phân công, mọi bước trước hoàn thành. Không dùng ID công đoạn để suy thứ tự vì một công đoạn có thể lặp.
- Ghi sản lượng: chỉ Đang thực hiện, số hữu hạn > 0. Nhiều bản ghi tăng dần theo từng lần, không nhập tổng lũy kế và không tự hoàn thành khi đủ số lượng. Chưa có giới hạn vượt kế hoạch trong đặc tả nên không chặn sản xuất vượt.
- Tạm dừng: nguyên nhân hoạt động từ Dừng máy, tự chụp tên/nhóm; máy liên quan chỉ thuộc Trạm. Danh mục hiện chưa phân loại nguyên nhân phát sinh từ Máy nên máy là tùy chọn, không suy đoán từ tên nguyên nhân.
- Tiếp tục: chỉ Tạm dừng. Nhật ký dừng ghép PAUSE với RESUME kế tiếp để xác định thời gian kết thúc và thời lượng. Không ghi sản lượng/hoàn thành lúc đang dừng; cần Tiếp tục trước.
- Hoàn thành: xác nhận số lượng, thời gian; nếu thiếu kế hoạch phải nhập lý do. Khóa toàn bộ thực thi sau hoàn thành.

Mọi thao tác thực thi cần nhân viên trong ca hiện tại, kể cả khi WO đã bắt đầu từ ca trước. Quá hạn là cảnh báo, không cấm thao tác khi vẫn có phân công hiện tại hợp lệ. Không giới hạn thời gian thực tế bằng giờ kết thúc kế hoạch. Việc lập phân công ca vẫn tuân thủ ràng buộc lịch tại 2.2; nếu cần cấp ca ngoài kế hoạch phải điều chỉnh nghiệp vụ kế hoạch trước, không sửa lịch tại màn Thực thi.

Trạm không đổi sau Bắt đầu. Bản ghi phân công đã được nhật ký tham chiếu không sửa/xóa, kể cả được dùng bởi WO khác tại cùng Trạm; phân công chưa dùng có thể cập nhật/bổ sung khi WO chưa kết thúc. Phân công không chuyển MO sang Đang thực hiện.

## Trạng thái và sản lượng

Trạng thái WO nghiệp vụ: Chưa phân công / Đã phân công / Đang thực hiện / Tạm dừng / Hoàn thành / Đã hủy. Được tái dựng từ dữ liệu phân công và nhật ký đã lưu, tránh hai nguồn trạng thái độc lập. Nhãn Chưa đến thời gian / Chờ công đoạn trước / Sẵn sàng / Quá hạn chỉ được tính theo thời gian. Quá hạn có ưu tiên hiển thị cảnh báo; trạng thái nghiệp vụ vẫn hiện riêng ở chi tiết.

Bắt đầu WO đầu tiên cập nhật MO Đang thực hiện. Hoàn thành mọi WO cập nhật MO Hoàn thành. Dừng/tiếp tục không thay đổi trạng thái MO. MO hiển thị sản lượng bước cuối, không cộng qua tất cả bước. Các bảng MO/WO, chi tiết phân công và Excel đã dùng sản lượng thực hiện. Chức năng sản xuất không nhập Đạt/NG. Dữ liệu tích hợp cũ có good/ng chỉ được đọc tương thích; dữ liệu mới dùng quantity và không phát sinh kết quả chất lượng.

## Quyền và lưu trữ

System DB migration 4 đăng ký PRODUCTION_EXECUTION với VIEW/START/EXECUTE/PAUSE/RESUME/COMPLETE, phạm vi VIEW/WRITE. ADMIN hiện hữu nhận quyền mặc định theo cơ chế seed; các vai trò khác được quản trị trong Hệ thống. API danh sách nhân viên cho phép người có VIEW Thực thi đọc theo ALL/PRODUCTION_TEAM/SELF, không cấp quyền sửa nhân viên. Menu, trang, nút và command đều kiểm tra quyền/phạm vi.

Nhật ký dùng store/cache frontend hiện có (`mes-linked-master-data-v1`, schema 3), không sửa/xóa; nguyên nhân và máy đã được dùng được bảo vệ tham chiếu. Nhân viên lấy từ API. **Chưa có backend sản xuất dùng chung nhiều máy/người dùng**; phân quyền và khóa giao dịch sản xuất hiện áp dụng trong ứng dụng cục bộ.

## Kiểm tra

`tests/production-execution.test.mjs`: giờ bắt đầu, trạm, quyền, số lượng không hợp lệ, ghi nhiều lần, không sinh Đạt/NG, ca đêm/đổi nhân viên, dừng/tiếp tục và thời lượng, không thực thi lúc dừng/ngoài ca, hoàn thành thiếu lý do, khóa nhật ký, MO tự hoàn thành và tổng bước cuối.

`tests/production-execution-access.test.mjs`: quyền riêng, API nhân viên cho người chỉ có quyền Thực thi, từ chối sửa nhân viên, ALL/SELF/đơn vị/thiếu phạm vi.

Kiểm tra giao diện tại origin thử localhost: chọn đơn vị/trạm, hiện đúng WO-0001/MO-0001, số lượng 500 và Máy thử MO-WO từ dữ liệu đã có. Tại ngày 01/11, WO kế hoạch 02/11 hiển thị Chưa đến thời gian, Bắt đầu bị khóa và cảnh báo chưa phân công nhân viên cho ca hiện tại. Không đổi ngày hệ thống hoặc sửa dữ liệu thật để bỏ qua các điều kiện này.
