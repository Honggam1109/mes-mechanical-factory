# Phân hệ Hệ thống MES

> Cập nhật: đã bổ sung backend sản xuất và ba vai trò demo, giữ nguyên admin. Xem [hướng dẫn demo và ma trận quyền hiện hành](demo-three-roles.md). Các đoạn mô tả production chưa có API hoặc còn là scaffold phía dưới phản ánh thời điểm triển khai ban đầu.

## Kiến trúc đã đối chiếu

Frontend: React 19 + TypeScript, Vite 8, Ant Design 6, Tailwind v4. `src/app/providers/AppProviders.tsx` giữ cấu hình theme/locale. Layout dùng `src/layouts/MainLayout.tsx`, `AppSidebar`, `AppHeader`, `WorkspaceTabs`, `PageContainer`.

Điều hướng nằm trong `src/app/navigation`: `menuData.tsx` định nghĩa cây menu, `menuConfig.tsx` chuyển thành Ant Menu, `screenRegistry.tsx` dựng màn hình, `useWorkspaceTabs.ts` giữ tab. Không tạo thêm router hoặc layout.

Đã dùng lại `DataTable`, `DataToolbar`, `FilterPanel`, `FilterActions`, `AddButton`, `FormHeader`/`FormToolbar`; Form/Input/Select/Checkbox/Tabs/Tag/Spin/Result/Alert/Modal và message của Ant Design. Tìm kiếm, phân trang, loading/empty/error/retry dùng các component này. Không thêm thư viện state, HTTP hay validation. Custom hooks và React context theo mô hình state sẵn có.

Repository ban đầu chưa có backend, database/ORM, API client hay xác thực thật. Màn người dùng ban đầu dùng mock state; login chỉ gọi callback. API mới dùng Node HTTP + SQLite có sẵn trong Node 22.13 trở lên, không thêm dependency. `server/schema.sql` tạo bảng, khóa ngoại và migration phiên bản 1; quan hệ nhiều-nhiều được chuẩn hóa. Các field entity và audit được lưu trong document JSON ở SQLite. Không lưu mật khẩu trong document; hash scrypt có salt riêng nằm ở cột riêng.

## Chạy

`npm run dev` sử dụng Vite hiện tại; middleware API cùng origin được gắn qua `vite.config.ts`. Không cần chạy hai server cho chế độ phát triển. `npm run preview` cũng gắn API. Không khởi động thêm Vite nếu phiên hiện tại đã chạy.

Build bằng `npm run build`, sau đó `npm start` phục vụ cả `dist` và `/api` tại `http://127.0.0.1:3001`. `MES_HOST` và `MES_PORT` cấu hình địa chỉ lắng nghe. Bản static dist đơn lẻ cần server API cùng origin để hoạt động.

Biến môi trường trước lần tạo database đầu tiên:

```powershell
$env:MES_ADMIN_USERNAME = 'admin'
$env:MES_ADMIN_PASSWORD = '<mat-khau-8-50-ky-tu-gom-hoa-thuong-so>'
$env:MES_DB = 'server/data/mes.sqlite'
npm run dev
```

Nếu không đặt mật khẩu, seed tạo mật khẩu ngẫu nhiên và in một lần ở terminal server. Không có mật khẩu mặc định trong source. Nếu database đã tồn tại, seed không ghi đè tài khoản/mật khẩu. `server/data/` được gitignore. Dùng biến `NODE_ENV=production` khi phục vụ qua HTTPS để cookie có Secure. Session token ngẫu nhiên nằm trong HttpOnly/SameSite=Strict cookie; SQLite chỉ lưu SHA-256 token, với hạn 8 giờ hoặc 30 ngày khi ghi nhớ đăng nhập. Logout xóa session; khóa/reset password thu hồi session của user. Đổi mật khẩu cá nhân yêu cầu mật khẩu hiện tại và thu hồi các session khác.

## Nghiệp vụ và API

Đủ route `/login`, `/dashboard`, `/403`, `/system/{users,roles,permissions,data-permissions}`, `/new`, `/:id`; chuyển trang, Back/Forward và reload URL vẫn dùng workspace tabs hiện có. Những màn hình ngoài Hệ thống giữ registry và layout hiện tại.

API xác thực: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; thêm `POST /api/auth/password` cho modal bảo mật hiện có. `/auth/me` trả user, employee, active roles, permissions và dataScopes. DataScopes được phân biệt theo `RESOURCE:VIEW` và `RESOURCE:WRITE` để không vô tình lấy quyền xem làm quyền ghi.

Users: list/detail/create/update, PATCH status, POST reset-password, PUT roles theo contract. Không hỗ trợ DELETE user. Vai trò: list/detail/create/update, PUT users/permissions/data-permissions. Permissions và data-permissions: list/detail/create/update, ngừng hoạt động qua update status. Danh sách có query `page`, `pageSize`, `status`, `keyword`; users hỗ trợ thêm username/fullName/email/roleId. `/api/system/options` cung cấp lựa chọn có kiểm tra quyền; không trả password/hash. `/api/employees` chỉ đọc danh mục tham chiếu cho người được tạo/sửa user.

Mọi mutation nằm trong transaction, kiểm tra validation và invariant trước commit; ghi audit actor/action/entity/time. Trạng thái user đổi trong form cũng yêu cầu LOCK. Username/mã không được đổi; username so sánh không phân biệt hoa thường. Active user phải có role active, chỉ gán mới role active. Employee chỉ liên kết một user active. Các thay đổi user/role/permission/data permission không được làm mất tài khoản quản trị có đầy đủ action quản trị và WRITE ALL.

Role detail có bốn tab: thông tin, người dùng, quyền chức năng với subset action, quyền dữ liệu. Các tab quan hệ có nút lưu riêng. Các role mẫu ngoài ADMIN chưa được cấp quyền nghiệp vụ vì đặc tả không cung cấp ma trận chi tiết; quản trị viên cấu hình qua UI.

## Authorization và data scope

`useAuth().hasPermission(resource, action)` là helper dùng chung cho menu, route, nút và form. Menu không có VIEW bị loại khỏi cây; URL trực tiếp trái quyền về `/403`; 401 đưa về login. Quyền được tải lại sau mutation, khi focus và mỗi phút. Backend tính lại quyền từ session/user và role ACTIVE ở mỗi request, vì vậy không dựa vào cache frontend.

Backend kiểm tra session, resource/action rồi scope. UNION action từ role active; chỉ lấy permission active và action còn khai báo. Không có DENY. Scope rộng nhất ALL > PRODUCTION_TEAM > SELF được tính riêng cho loại truy cập. Không nhận filter field từ client. `applyDataScope` có mapping cố định cho SYSTEM_USER, PRODUCTION_ORDER, PRODUCTION_ASSIGNMENT; resource chưa mapping trả rỗng với scope hẹp. Thiếu Employee/tổ trả rỗng. Các endpoint users áp dụng VIEW trên danh sách/chi tiết và WRITE trên cả bản ghi cũ lẫn trạng thái dự kiến khi cập nhật.

Không triển khai API Production/Kho/Chất lượng trong task này. Các module đó hiện vẫn dùng scaffold/state cũ; khi bổ sung backend phải gọi guard và `applyDataScope` trước truy vấn.

## Nguồn Nhân viên dùng chung

Màn hình Nhân viên hiện có đã được nối vào SQLite qua `employeeService`, giữ form/table và danh mục phòng ban, bậc thợ hiện tại. Các trường email, phone, mã/tên tổ sản xuất được bổ sung để cung cấp dữ liệu tham chiếu cho tài khoản. Không coi phòng ban là tổ sản xuất. Migration 2 bổ sung trường còn thiếu của bản ghi seed EMP-001 khi nâng cấp database cũ.

`GET /api/employees` phục vụ danh mục dùng chung. `POST /api/employees`, `PUT /api/employees/:id`, `POST /api/employees/import` và `DELETE /api/employees/:id` phục vụ những thao tác sẵn có trên màn hình Nhân viên. Vì đây là nguồn quyết định quyền dữ liệu, thay đổi nguồn này yêu cầu cả SYSTEM_USER UPDATE, SYSTEM_ROLE UPDATE và SYSTEM_USER WRITE ALL. Giao diện chỉ cho sửa khi đạt cùng điều kiện. Người quản lý tài khoản với scope hẹp không thể tự đổi tổ thông qua endpoint này. Nhân viên đã liên kết bất kỳ tài khoản nào không được xóa; dùng trạng thái ngừng hoạt động để giữ lịch sử. Import chạy trong một transaction; một dòng sai sẽ rollback toàn bộ.

Sau khi đăng nhập/tải lại phiên, frontend tải danh mục này vào store Dữ liệu gốc hiện có. Sau mutation nhân viên, các màn hình Hệ thống tải lại lựa chọn. Thay đổi tên/email được cập nhật vào tài khoản liên kết; tổ được lấy trực tiếp từ Employee đã lưu ở backend. Các trường này ở form User là readonly khi Employee có dữ liệu. Nhân viên seed chưa có tổ nên PRODUCTION_TEAM mặc định trả rỗng đúng đặc tả. Các danh mục Dữ liệu gốc khác vẫn giữ state và hành vi cũ.

`tests/employees.test.mjs` kiểm tra danh mục dùng chung, validation, import nguyên khối, bảo vệ nhân viên đã liên kết, quyền cập nhật nguồn tổ, đồng bộ hồ sơ và audit. AuthProvider bỏ qua phản hồi refresh cũ sau đăng xuất hoặc sau khi một lượt tải mới hơn đã bắt đầu. Các form tài khoản/mật khẩu dùng khóa submit để tránh gửi lặp trong lúc validate bất đồng bộ.

## Kiểm tra

`npm run check` chạy typecheck, toàn bộ `tests/*.test.mjs` và build. `tests/system.test.mjs` dùng HTTP thật và database tạm, kiểm tra login sai/đúng/khóa, cookie, validation, trùng username/employee, role/action subset/union, VIEW/WRITE scope, forged query, gọi API trực tiếp, bảo vệ admin cuối, thu hồi session, hash mật khẩu, audit và persistence qua mở lại database. Bộ test cũ cho products/master-data/warehouse vẫn giữ và được chạy cùng.

Formatter hiện có: `npm run format -- <cac-file-thay-doi>`. Repository chưa có cấu hình/script lint; typecheck và các test được dùng để kiểm tra mã. Vite có cảnh báo bundle lớn do Ant Design/ExcelJS; build vẫn thành công.

Đã kiểm tra trình duyệt với database in-memory riêng: login sai/đúng và logout; Dashboard; route trực tiếp vai trò và bốn tab; validation form user; sửa email nhân viên, reload và chọn lại từ user dropdown; hồ sơ readonly cho user chỉ có VIEW; sidebar/action không hiện quyền quản trị; user SELF chỉ thấy bản ghi của mình; truy cập trực tiếp roles và users/new chuyển `/403`. Sản phẩm hiển thị 18 dòng và Kho hiển thị 24 chứng từ như scaffold cũ. Sản xuất/Chất lượng giữ màn hình “Chức năng đang phát triển” hiện có. Không ghi nhận console error trong phiên kiểm tra. Dữ liệu kiểm thử UI chỉ tồn tại trong database bộ nhớ riêng và được hủy khi dừng server.
