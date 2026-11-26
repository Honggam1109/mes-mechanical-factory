# Lệnh sản xuất và Phân công sản xuất

Triển khai theo đặc tả 2.1 và 2.2 người dùng cung cấp, nối tiếp Dữ liệu gốc và Quy trình BOM hiện có.

## Màn hình

- `/workspace/production-orders`: danh sách MO, lọc mã/sản phẩm/phiên bản quy trình/trạng thái/khoảng ngày bắt đầu, phân trang, xuất Excel và thêm mới.
- `?new=1`: tạo MO. `?record=<id>`: chi tiết. `&mode=edit`: sửa khi Nháp và có quyền.
- Form MO có Thông tin lệnh, Nguyên vật liệu, Kế hoạch công đoạn. Sau phát hành có thêm tab Lệnh làm việc.
- `/workspace/production-assignments`: danh sách WO, lọc từ khóa/công đoạn/trạm/trạng thái/khoảng kế hoạch, phân trang.
- `?record=<woId>`: phân công. Thêm `&mode=view` để chỉ xem.
- Chi tiết WO có thông tin kế thừa, chọn/lưu Trạm, bảng Máy của Trạm và danh sách Ngày + Ca + Nhân viên; dùng modal để thêm/sửa nhân sự.

Các màn dùng lại FilterPanel, DataToolbar, ActionToolbar, DataTable, FormHeader/FormToolbar, AddButton, ConfirmDeleteDialog, ExportDialog, thông báo và cảnh báo chưa lưu. Thời gian kế hoạch dùng control ngày–giờ của trình duyệt trong Input theo template hiện có. Ngày/giờ kế hoạch là thời gian địa phương; ngày phân công ca đêm là ngày bắt đầu ca.

## Dữ liệu và phát hành

Sản phẩm phải Hoạt động. Chỉ chọn đúng phiên bản quy trình Đang áp dụng, đang sử dụng của sản phẩm; không lấy bản nháp/lịch sử và không tự đổi sang phiên bản mới. Đổi sản phẩm xóa lựa chọn quy trình và toàn bộ kế hoạch bước cũ. Đổi quy trình sinh lại danh sách bước trống thời gian.

Vì một sản phẩm có nhiều BOM, MO dùng **BOM gắn với phiên bản quy trình đã chọn**, không lấy ngẫu nhiên BOM đang hoạt động của sản phẩm. Nguồn là bản chụp của phiên bản quy trình đã áp dụng. Nhu cầu vật tư MO gồm toàn bộ thành phần cấp đầu của BOM, không chỉ tập vật tư tiêu hao của công đoạn chính. Công thức `SL cần = SL kế hoạch × định mức / SL cơ sở`; có thêm cột hao hụt và nhu cầu gồm hao hụt để rõ hai đại lượng.

Kế hoạch công đoạn lấy đúng ID bước, công đoạn, thứ tự, danh sách đơn vị có thể thực hiện từ phiên bản quy trình. Người dùng chỉ nhập thời gian và ghi chú. Cho phép công đoạn lặp ở bước/thứ tự khác nhau; không gom WO theo ID công đoạn.

Lưu Nháp kiểm tra thông tin bắt buộc, số lượng dương, đầu/cuối hợp lệ, đầy đủ thời gian công đoạn. Mỗi bước nằm trong khoảng lệnh, kết thúc sau bắt đầu và bắt đầu không trước kết thúc công đoạn trước.

Phát hành kiểm tra lại toàn bộ nguồn. Một giao dịch ghi MO Đã phát hành, bản chụp dữ liệu nguồn và một WO cho từng ID bước. Không có trường hợp chỉ phát hành MO mà sinh thiếu WO, kể cả khi lưu trình duyệt thất bại. Phát hành lần hai bị từ chối, không sinh WO trùng.

Bản chụp MO giữ mã/tên/đơn vị sản phẩm, quy trình và phiên bản, BOM và số lượng cơ sở, vật tư, công đoạn/khả năng thực hiện và toàn bộ kế hoạch. Thay đổi BOM/danh mục/phiên bản áp dụng sau đó không làm thay đổi MO đã chốt. Mã hệ thống không sửa tay; thông tin WO kế thừa không sửa tại Phân công.

## Trạm, máy và nhân sự

WO chỉ có một Trạm. Trạm phải Hoạt động, đơn vị của Trạm phải Hoạt động và thuộc danh sách có khả năng thực hiện đã chốt cho bước. Người dùng không chọn đơn vị trước; đơn vị và máy hiển thị từ cấu hình Trạm hiện tại, không lưu/chọn một danh sách máy độc lập.

Lưu Trạm trước khi thêm nhân sự. Chưa có nhân sự có thể đổi Trạm. Nếu có nhân sự nhưng chưa thực thi, cảnh báo và xác nhận trước khi đổi; cập nhật Trạm và xóa toàn bộ nhân sự cũ trong cùng giao dịch. Khi đã thực thi không được đổi Trạm. Phân công đã được tham chiếu trong nhật ký không được sửa/xóa; có thể bổ sung ca tiếp theo khi WO chưa kết thúc.

Ca và nhân viên mới phải đang Hoạt động; nhân viên thuộc đúng đơn vị của Trạm. Danh sách nhân viên lấy API hiện có, không tạo bản sao mock riêng. Phân công lưu tham chiếu và một số nhãn/khung giờ tại lúc lưu để hiển thị lịch sử ổn định.

Toàn bộ ca phải nằm trong khoảng công đoạn. Ca có giờ kết thúc <= giờ bắt đầu được tính sang ngày kế tiếp; ví dụ 22:00–06:00 ngày 02/11 kết thúc lúc 06:00 ngày 03/11. Không chấp nhận ca chỉ giao nhau một phần với kế hoạch.

Trong một WO không lặp Ngày + Ca. Trên các WO: một Trạm + Ngày + Ca chỉ có một nhân viên; một Nhân viên + Ngày + Ca chỉ ở một Trạm. Cùng nhân viên có thể phụ trách nhiều WO ở cùng Trạm trong cùng ca; quy tắc không biến thành cấm người đó nhận công việc khác tại cùng Trạm. Kiểm tra thêm khoảng giờ thật để tránh xung đột giữa hai ca khác tên/ngày nhưng giao nhau, nhất là qua đêm. Phân công bị hủy không còn chiếm chỗ.

Sản lượng giao không bắt buộc; nếu nhập phải dương. Không áp thêm quy tắc tổng sản lượng giao vì đặc tả chưa quy định cách chia nhân sự/sản lượng.

## Trạng thái và ranh giới Thực thi

MO: Nháp → Đã phát hành → Đang thực hiện → Hoàn thành; có Đã hủy. Chỉ xóa/sửa Nháp. Với điều kiện hủy chưa được đặc tả chi tiết hơn, triển khai cho Nháp/Đã phát hành chưa có bất kỳ thực thi; giữ MO/WO/phân công để tra cứu và giải phóng ca đã hủy. Không hủy giữa chừng hoặc xóa lịch sử.

WO: Chưa phân công khi thiếu Trạm hoặc nhân sự; Đã phân công khi có cả hai; Đang thực hiện/Hoàn thành từ dữ liệu thực thi; Đã hủy theo lệnh cha. Có thể phân trước cho mọi bước, không cần đợi bước trước hoàn thành.

Không thêm nút ghi sản lượng hoặc sửa trạng thái thủ công ở hai màn này. `executeWork` là ranh giới thao tác của Thực thi, kiểm tra quyền, phân công hiện tại và thứ tự trước khi cập nhật nhật ký cùng trạng thái MO. Xem `docs/production-execution.md`.

Theo đặc tả 2.3 mới, MO lấy **sản lượng thực hiện ở công đoạn cuối**, không cộng các công đoạn. Tiến độ = sản lượng thực hiện / kế hoạch, tối đa 100% trên thanh tiến độ. Dữ liệu mới không ghi Đạt/NG; Chất lượng chưa tích hợp. Dữ liệu thử cũ được đọc tương thích, không xóa nhật ký. MO hoàn thành khi tất cả WO có xác nhận hoàn thành; không tự coi đủ số lượng là hoàn thành.

## Quyền và lưu trữ

Thêm tài nguyên PRODUCTION_ORDER (VIEW/CREATE/UPDATE/DELETE/EXPORT/RELEASE), PRODUCTION_ASSIGNMENT (VIEW/ASSIGN) vào cơ chế quyền hiện có, cấp cho vai trò ADMIN hiện hữu khi chạy migration 3 của System DB. Vai trò khác cần cấp quyền/phạm vi trong Hệ thống. Không kiểm tra tên tài khoản admin trong UI. Menu, trang, nút, dịch vụ nghiệp vụ và dữ liệu danh sách dùng quyền cùng phạm vi VIEW/WRITE ALL, PRODUCTION_TEAM, SELF. Xuất chỉ lấy dữ liệu được phép xem.

API nhân viên cho phép vai trò có VIEW Phân công đọc danh sách theo phạm vi tương ứng mà không cần quyền quản trị Hệ thống. Quyền này không cấp quyền sửa nhân viên. Giữ nguyên các kiểm tra bảo vệ API ghi nhân viên.

MO, WO, phân công và nhật ký nay được lưu chung trong SQLite qua `/api/production/snapshot` và `/api/production/command`. Backend chạy lại quy tắc nghiệp vụ, phân quyền và giao dịch; frontend đọc lại snapshot mỗi 3 giây. Phân công mới có khoảng giờ trong ca; hỗ trợ bước sau bắt đầu sớm sau khi hoàn thành bước trước và kiểm tra xung đột. Cache trình duyệt cũ được giữ riêng, không tự nhập. Xem [hướng dẫn demo ba vai trò](demo-three-roles.md) cho cấu hình hiện tại.

## Kiểm thử

`npm run check`: TypeScript, toàn bộ tests và build.

- `tests/production.test.mjs`: thời gian kế hoạch, cấp phát nguyên tử và chống phát hành lặp, snapshot, tham chiếu, Trạm/nhân viên/ca, ca qua đêm, đổi Trạm, hủy, khóa sau thực thi, thứ tự bước, tổng sản lượng công đoạn cuối, phạm vi, xuất Excel và reload.
- `tests/production-access.test.mjs`: API danh sách nhân viên cho người phân công không có quyền System, từ chối ghi nhân viên, ALL/SELF/đơn vị/thiếu phạm vi.
- Bộ kiểm tra BOM/System/Employee và các màn hiện có vẫn chạy.

Đã kiểm tra web toàn luồng tại origin thử riêng `localhost:3001`: tạo BOM/quy trình từ danh mục, áp dụng, tạo MO 500 sản phẩm với nhu cầu 1.000 thành phần, nhập kế hoạch bước, phát hành một WO, lưu Trạm, tự hiện Máy, chọn ca 06:00–14:00 và nhân viên lấy từ API, trạng thái WO đổi thành Đã phân công. Không sửa cache master/production của origin chính `127.0.0.1:3001` để dựng ca thử này.

Chi tiết thực thi 2.3: xem [production-execution.md](production-execution.md).

Giám sát vận hành (2.4), dữ liệu mẫu và kiểm thử liên thông: xem [production-monitor.md](production-monitor.md).
