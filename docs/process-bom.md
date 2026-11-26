# Quy trình BOM và phiên bản quy trình công nghệ

Theo yêu cầu được điều chỉnh sau đặc tả ban đầu: **một sản phẩm có nhiều BOM và nhiều mã quy trình công nghệ**. Quy trình liên kết với BOM cụ thể; không giới hạn một cấu hình hoạt động cho mỗi sản phẩm. Mỗi mã quy trình chỉ có một phiên bản Đang áp dụng và tối đa một Bản nháp.

## Quan hệ dữ liệu

- Công đoạn khai báo nhiều Đơn vị sản xuất có khả năng thực hiện. Tiếp tục dùng danh mục hiện có.
- BOM chọn sản phẩm đầu ra, số lượng cơ sở và các thành phần. Loại và đơn vị lấy từ Sản phẩm. Mỗi dòng có số lượng, hao hụt 0–100%, ghi chú và BOM con tùy chọn phù hợp sản phẩm thành phần.
- Do một bán thành phẩm có nhiều BOM, không tự lấy BOM con ngẫu nhiên. Chọn rõ phương án muốn triển khai; để trống nếu sử dụng thành phần mua ngoài/không triển khai cấp dưới. Chặn vòng lặp theo liên kết BOM con.
- Quy trình chọn BOM; sản phẩm và đơn vị đầu ra tự lấy theo BOM. Sản lượng chuẩn mặc định bằng số lượng cơ sở BOM, có thể thay đổi để quy đổi định mức.
- Quy trình chọn công đoạn chính và một đơn vị có khả năng thực hiện công đoạn đó, từ nguồn Dữ liệu gốc. Danh sách công đoạn tuần tự vẫn được giữ trong tab riêng; công đoạn chính phải có trong danh sách. Không cấu hình trạm, máy, nhân viên hoặc ca ở đây.
- Các phiên bản cùng mã quy trình thuộc cùng sản phẩm. Đổi phương án BOM trong phiên bản mới phải chọn BOM của sản phẩm đó. Sản phẩm khác tạo mã quy trình khác.

## Vật tư và cây BOM

Tab Vật tư tiêu hao chọn tập thành phần của BOM mà quy trình sử dụng; không nhập vật tư nằm ngoài BOM. Số lượng = định mức BOM × sản lượng chuẩn / số lượng cơ sở. Tổng nhu cầu = số lượng × (1 + hao hụt / 100). Được để không chọn vật tư nếu công đoạn không phát sinh tiêu hao.

Tab Cây BOM triển khai đúng BOM con đã chọn. Mỗi cấp quy đổi theo số lượng cơ sở BOM tương ứng và nhân hao hụt cấp đó. Có mở/thu gọn, tìm kiếm, chọn nút và xem thông số. Tổng định mức được nhóm theo đơn vị, không cộng Kg/Cái/Lít thành một số không có nghĩa.

## Phiên bản

1. Tạo quy trình mới: mã tự sinh, V1.0, Bản nháp.
2. Lưu bản nháp: kiểm tra BOM, công đoạn, đơn vị, số lượng và vật tư. Mã/phiên bản không sửa tay.
3. Áp dụng: kiểm tra lại toàn bộ nguồn, tạo bản chụp BOM/các BOM con/sản phẩm/công đoạn/đơn vị. Phiên bản Đang áp dụng cùng mã trước đó chuyển sang Lưu trữ trong cùng lần ghi dữ liệu.
4. Phiên bản đã áp dụng/lưu trữ khóa sửa và không xóa cứng. Bản chụp bảo đảm thay đổi BOM/danh mục hiện tại không đổi lịch sử hoặc tiêu hao của phiên bản cũ.
5. Tạo phiên bản mới: sao chép nội dung thành Bản nháp có ID mới, cùng mã, tăng phiên bản và ghi phiên bản nguồn. Bản nháp mới dùng lại dữ liệu danh mục hiện hành và có thể đổi BOM phù hợp.
6. Lưu trữ: giữ nguyên bản chụp và cấu hình, không áp dụng lại bản đã lưu trữ; muốn dùng lại tạo phiên bản mới.

Danh sách gom theo mã quy trình, hiển thị phiên bản đang áp dụng hoặc phiên bản mới nhất nếu chưa có bản áp dụng. Có mở rộng lịch sử, lọc theo sản phẩm/công đoạn/trạng thái phiên bản; từng phiên bản mở được đúng bản ghi.

## Toàn vẹn, Excel và lưu trữ

Dùng lại các component bảng, form, ImportDialog, ExportDialog, ConfirmDeleteDialog và cảnh báo chưa lưu. BOM được quy trình/BOM khác tham chiếu không được xóa hoặc đổi sản phẩm đầu ra. Dữ liệu đã có tham chiếu sản xuất cũng được bảo vệ. Mã bất biến, số lượng dương, không trùng thành phần/thứ tự; cho phép một công đoạn xuất hiện nhiều lần ở các thứ tự khác nhau.

Excel nhập cả lô nguyên tử; sai bất kỳ dòng nào không ghi gì. BOM hỗ trợ hao hụt và mã BOM con trong JSON. Quy trình có mã BOM, sản lượng, công đoạn chính, đơn vị, phiên bản, công đoạn và vật tư tiêu hao. Import quy trình luôn là Bản nháp, không tự áp dụng từ file. Áp dụng phải qua thao tác kiểm tra trên màn hình. Xuất phiên bản đã áp dụng dùng dữ liệu bản chụp.

Khóa localStorage `mes-linked-master-data-v1` dùng schema 3. Khi chuyển schema 1/2, giữ ID, phục hồi liên kết BOM/hao hụt/BOM con từ bản sao lưu cũ nếu còn và khớp ID. Không tự chọn BOM khi sản phẩm có nhiều phương án. Dữ liệu chuyển từ cấu trúc không phiên bản được giữ để rà soát ở Bản nháp; các bản trùng mã được tổ chức lại thành phiên bản. Bản gốc giữ tại `mes-linked-master-data-v1-legacy-bom-backup`. Nếu trước đó dữ liệu đã bị lược bỏ và không có bản sao lưu, cần người dùng chọn lại BOM, không tự đoán.

Đây vẫn là dữ liệu frontend theo trình duyệt/origin; chưa có backend BOM dùng chung giữa người dùng. Không thay API Nhân viên/Hệ thống hoặc triển khai Phân công sản xuất trong thay đổi này.

Kiểm tra: `npm run check`; tests bao phủ nhiều BOM/quy trình một sản phẩm, cây và hao hụt nhiều cấp, vật tư tiêu hao, áp dụng/thay thế/lưu trữ, khóa sửa, bản chụp bất biến, nhập nguyên tử, Excel, phục hồi dữ liệu cũ và reload.
