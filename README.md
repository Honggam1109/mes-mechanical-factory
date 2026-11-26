# Phân tích nghiệp vụ và xây dựng hệ thống quản lý sản xuất (MES) cho nhà máy cơ khí

Khóa luận tốt nghiệp ngành Khoa học máy tính. Đây là mã nguồn **bản prototype minh họa nghiệp vụ**.

## 1. Giới thiệu và phạm vi sản phẩm

### 1.1. Mục tiêu

Minh họa cách một hệ thống MES quản lý dòng công việc tại xưởng cơ khí: từ dữ liệu gốc, định mức vật tư và quy trình công nghệ đến lệnh sản xuất, phân công, thực thi tại trạm và giám sát.

Luồng nghiệp vụ chính:

```text
Dữ liệu gốc → Định mức BOM → Quy trình công nghệ → Lệnh sản xuất (MO)
→ Lệnh làm việc theo công đoạn (WO) → Phân công → Thực thi → Giám sát
```

Dữ liệu mẫu mô phỏng việc gia công **trục truyền động** qua sáu công đoạn: Cắt phôi → Tiện → Phay rãnh then → Nhiệt luyện → Mài → KCS. Tên nhà máy, nhân viên và số liệu đều là dữ liệu giả định.

### 1.2. Các phân hệ đã có

| Phân hệ | Chức năng | Lưu trữ |
|---|---|---|
| Tổng quan | Chỉ số và biểu đồ tiến độ thực hiện công việc | Tính từ dữ liệu sản xuất |
| Dữ liệu gốc | Sản phẩm, danh mục, thuộc tính, đơn vị tính; máy móc, trạm, lý do dừng máy; kho, vị trí kho; đơn vị sản xuất, nhân viên, ca làm việc, nhà cung cấp | SQLite |
| Quy trình BOM | Công đoạn; định mức vật tư nhiều cấp có tỷ lệ hao hụt; quy trình công nghệ có phiên bản (nháp, đang áp dụng, lưu trữ) | SQLite |
| Lệnh sản xuất | Lập, phát hành, hủy lệnh; tự sinh một lệnh làm việc cho mỗi công đoạn; chốt bản chụp BOM và quy trình khi phát hành | SQLite |
| Phân công sản xuất | Gán trạm, ca, nhân viên; kiểm tra trùng lịch nhân viên và trạm | SQLite |
| Thực thi sản xuất | Bắt đầu, ghi sản lượng, tạm dừng kèm nguyên nhân, tiếp tục, hoàn thành; nhật ký không cho sửa, xóa | SQLite |
| Giám sát vận hành | Trạng thái theo trạm, cảnh báo quá hạn, thiếu nhân viên, đang dừng | Tự cập nhật từ máy chủ |
| Hệ thống | Đăng nhập, người dùng, vai trò, quyền chức năng, quyền dữ liệu, nhật ký kiểm toán ở máy chủ | SQLite |
| Kho: Lệnh chuyển hàng | Lập và xác nhận chứng từ | **Chỉ là dữ liệu giả lập trong bộ nhớ, mất khi tải lại trang** |

Nhiều màn danh mục hỗ trợ nhập, xuất Excel.

### 1.3. Ngoài phạm vi prototype

Các nội dung sau có thể được đề cập trong phần phân tích nhưng **chưa được cài đặt**:

- Quản lý chất lượng: kiểm tra, phân loại Đạt/Không đạt, phế phẩm, sửa lại. Công đoạn KCS trong dữ liệu mẫu chỉ ghi nhận sản lượng.
- Tồn kho thực: trừ vật tư theo sản xuất, nhập kho thành phẩm, theo dõi bán thành phẩm, thực thi chuyển hàng, kiểm kê, tra cứu tồn.
- Kết nối máy móc/IoT, lập lịch tối ưu, tích hợp ERP.
- Triển khai vận hành thực tế (HTTPS, sao lưu, chịu tải).

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript 5.7 (giao diện và quy tắc nghiệp vụ), JavaScript ES Module (máy chủ) |
| Giao diện | React 19, Ant Design 6, Ant Design Icons, Lucide React, Tailwind CSS 4 |
| Công cụ build | Vite 8, `@vitejs/plugin-react` |
| Máy chủ | Node.js 22, module `node:http` (không dùng framework web) |
| Cơ sở dữ liệu | SQLite qua module `node:sqlite` có sẵn trong Node.js |
| Xác thực | Mật khẩu băm scrypt, phiên đăng nhập bằng cookie HttpOnly, phân quyền kiểm tra ở máy chủ |
| Excel | ExcelJS |
| Kiểm thử | `node:assert`, các file `tests/*.test.mjs` |
| Quản lý gói | pnpm 10 |

Khung dự án được khởi tạo từ Figma Make; vì vậy cấu hình build có đọc file `.figma/make/site.json`.

Cách lưu dữ liệu: người dùng, vai trò, quyền, nhân viên, phiên đăng nhập và nhật ký kiểm toán có bảng riêng. Dữ liệu gốc còn lại và dữ liệu sản xuất được lưu thành một tài liệu JSON trong bảng `production_state`.

## 3. Cấu trúc thư mục

Trong gói nộp, toàn bộ mã nguồn nằm trong `Source/`.

```text
Source/
├── src/                      Giao diện và quy tắc nghiệp vụ
│   ├── main.tsx, App.tsx     Điểm khởi chạy
│   ├── app/                  Theme, menu, điều hướng, tab làm việc
│   ├── layouts/              Khung trang, thanh bên, tiêu đề
│   ├── components/shared/    Thành phần dùng chung (bảng, bộ lọc, hộp thoại)
│   ├── features/
│   │   ├── auth/             Đăng nhập, hồ sơ
│   │   ├── system/           Người dùng, vai trò, phân quyền
│   │   ├── master-data/      Dữ liệu gốc
│   │   ├── products/         Sản phẩm, trang tổng quan
│   │   ├── units/            Đơn vị tính
│   │   ├── process-bom/      BOM và quy trình công nghệ
│   │   ├── production/       Lệnh, phân công, thực thi, giám sát
│   │   └── warehouse-documents/  Chứng từ chuyển hàng (giả lập)
│   └── lib/, assets/         Tiện ích Excel, hình ảnh
├── server/                   API, phân quyền, SQLite, dữ liệu demo
│   ├── system.mjs            API xác thực và hệ thống
│   ├── production.mjs        API sản xuất và dữ liệu demo
│   ├── schema.sql            Cấu trúc bảng
│   └── data/                 File database, tự tạo khi chạy, không nộp
├── tests/                    Kiểm thử nghiệp vụ và API
├── scripts/                  Script hỗ trợ và đóng gói
├── docs/                     Tài liệu mô tả từng phân hệ
├── .env.example              Mẫu biến môi trường
└── package.json              Phụ thuộc và lệnh chạy
```

Máy chủ dùng lại quy tắc nghiệp vụ trong `src/` (nạp qua `server/domain-loader.mjs`), nên khi chạy bản build vẫn phải giữ cả `src/`, `server/` và `dist/`.

## 4. Hướng dẫn cài đặt và chạy thử

### 4.1. Yêu cầu

- **Node.js 22.13 trở lên** trong nhánh 22 (kiểm tra bằng `node -v`).
- Kết nối Internet ở lần cài đặt đầu tiên.
- Trình duyệt Chrome hoặc Edge.

### 4.2. Lấy mã nguồn

Giải nén file ZIP, mở terminal tại thư mục `Source/`. Nếu lấy từ kho Git thì clone và vào thư mục gốc của dự án.

### 4.3. Cài đặt

```sh
npx pnpm@10.34.3 install --frozen-lockfile
```

### 4.4. Chạy

Đặt mật khẩu quản trị **trước lần chạy đầu tiên** (tự chọn mật khẩu theo quy tắc: 8–50 ký tự, có chữ hoa, chữ thường, chữ số).

Windows PowerShell:

```powershell
$env:MES_ADMIN_PASSWORD = "<mật-khẩu-bạn-chọn>"
npm.cmd run dev
```

macOS / Linux:

```sh
MES_ADMIN_PASSWORD='<mật-khẩu-bạn-chọn>' npm run dev
```

Mở **http://localhost:8443**. API và giao diện chạy chung một tiến trình, không cần cài hay chạy database riêng.

Nếu không đặt mật khẩu, hệ thống in mật khẩu ngẫu nhiên của `admin` ra terminal đúng một lần. Các biến cấu hình khác xem trong `.env.example`.

### 4.5. Bản build và kiểm thử

```sh
npm run build
npm start          # phục vụ tại http://127.0.0.1:3001
npm run check      # kiểm tra kiểu, chạy kiểm thử, build
```

Trên PowerShell dùng `npm.cmd` thay cho `npm`. Cảnh báo `SQLite is an experimental feature` và cảnh báo kích thước bundle không ảnh hưởng đến việc chạy.

### 4.6. Làm lại dữ liệu từ đầu

Tắt máy chủ, xóa thư mục `server/data/` rồi chạy lại. Thao tác này xóa toàn bộ tài khoản và dữ liệu đã nhập.

## 5. Kịch bản demo

### Tài khoản

| Tài khoản | Mật khẩu ban đầu | Vai trò |
|---|---|---|
| `admin` | Đặt ở mục 4.4 | Quản trị, xem toàn bộ |
| `kehoach` | `Demo@123456` | Kế hoạch viên: lệnh sản xuất |
| `totruong` | `Demo@123456` | Tổ trưởng: phân công, giám sát |
| `thucthi` | `Demo@123456` | Công nhân: thực thi |

Các tài khoản demo chỉ dùng để chạy thử cục bộ. Để mở nhiều vai trò cùng lúc, dùng các hồ sơ trình duyệt khác nhau hoặc cửa sổ ẩn danh.

### Chuẩn bị

Với database mới, lần đầu vào màn sản xuất hệ thống tự tạo dữ liệu mẫu, lịch sử và **một lệnh nháp** 100 trục. Lịch của lệnh nháp chia phần còn lại của ca hiện tại cho sáu công đoạn, nên hãy chạy kịch bản khi ca còn ít nhất 2 giờ (ca ngày 06:00–18:00, ca đêm 18:00–06:00).

Lệnh nháp chỉ được tạo một lần. Nếu lịch đã quá giờ, làm lại dữ liệu theo mục 4.6, hoặc `kehoach` tự lập lệnh mới với thời gian thuộc ca hiện tại.

### Bước 1. Kế hoạch viên phát hành lệnh (`kehoach`)

Mở lệnh nháp vừa tạo, xem vật tư (thép C45, dầu cắt gọt) và sáu công đoạn, bấm **Phát hành**.
*Kết quả:* sinh sáu lệnh làm việc.

### Bước 2. Tổ trưởng phân công (`totruong`)

Vào **Phân công sản xuất**. Với công đoạn Cắt phôi, chọn và lưu trạm `TR-DEMO-01`, thêm nhân viên Nguyễn Văn An cho ca hiện tại theo giờ gợi ý. Làm tương tự công đoạn Tiện với trạm `TR-DEMO-02`.
*Kết quả:* hai lệnh làm việc chuyển sang Đã phân công.

### Bước 3. Công nhân thực thi (`thucthi`)

Vào **Thực thi sản xuất**, mở công đoạn Cắt phôi: **Bắt đầu** → ghi sản lượng 40 → **Tạm dừng** (Chờ phôi) → **Tiếp tục** → ghi thêm 60 → **Hoàn thành**.
*Kết quả:* công đoạn Tiện đủ điều kiện bắt đầu. Trước đó hệ thống không cho bắt đầu.

Sản lượng nhập là số phát sinh mỗi lần, không phải số lũy kế.

### Bước 4. Giám sát và kiểm tra phân quyền

Trong lúc công nhân đang tạm dừng ở bước 3, `totruong` mở **Giám sát vận hành sản xuất** để thấy trạng thái, nguyên nhân và thời lượng dừng. Tài khoản `thucthi` không có menu Lệnh sản xuất và Phân công; truy cập thẳng địa chỉ sẽ bị từ chối.

Để xem lệnh đã hoàn thành đủ sáu công đoạn, mở các lệnh có ghi chú **LỊCH SỬ DEMO**. Sản lượng của lệnh lấy theo công đoạn cuối, không cộng dồn.

Kịch bản chi tiết hơn: `docs/demo-three-roles.md`.
