import type { Product } from "../types/product"

const seedProducts = [
  {
    key: "1",
    code: "FA-SHF-001",
    name: "Trục truyền động D40",
    category: "Thành phẩm",
    unit: "Cái",
    status: "Hoạt động",
    description: "Trục bậc có rãnh then, thép C45, tôi cải thiện và mài cổ lắp ổ.",
  },

  {
    key: "2",
    code: "FA-HSG-001",
    name: "Thân hộp giảm tốc",
    category: "Bán thành phẩm",
    unit: "Cái",
    status: "Hoạt động",
    description: "Thân hộp gang đúc đã gia công mặt lắp ghép.",
  },

  {
    key: "3",
    code: "FA-STL-C45",
    name: "Thép tròn C45 phi 45",
    category: "Linh kiện / Vật tư",
    unit: "Kg",
    status: "Hoạt động",
    description: "Phôi thép carbon dạng thanh dùng gia công trục.",
  },

  {
    key: "4",
    code: "FA-BRG-6208",
    name: "Cụm ổ bi 6208",
    category: "Linh kiện / Vật tư",
    unit: "Bộ",
    status: "Hoạt động",
    description: "Ổ bi đỡ một dãy kèm phớt chắn dầu.",
  },

  {
    key: "5",
    code: "FA-INS-CNMG",
    name: "Mảnh dao tiện CNMG 120408",
    category: "Linh kiện / Vật tư",
    unit: "Cái",
    status: "Hoạt động",
    description: "Mảnh hợp kim phủ dùng tiện thô và bán tinh.",
  },

  {
    key: "6",
    code: "FA-GER-001",
    name: "Bánh răng trụ răng thẳng M3",
    category: "Bán thành phẩm",
    unit: "Cái",
    status: "Ngừng hoạt động",
    description: "Bánh răng đã phay lăn, chờ nhiệt luyện (mã cũ, ngừng sản xuất).",
  },

  {
    key: "7",
    code: "FA-FLG-001",
    name: "Mặt bích thép DN100",
    category: "Thành phẩm",
    unit: "Cái",
    status: "Hoạt động",
    description: "Mặt bích tiện và khoan lỗ bu lông hoàn chỉnh.",
  },

  {
    key: "8",
    code: "FA-CUT-OIL",
    name: "Dầu cắt gọt pha nước",
    category: "Linh kiện / Vật tư",
    unit: "Lít",
    status: "Hoạt động",
    description: "Dung dịch làm mát và bôi trơn khi gia công.",
  },

  {
    key: "9",
    code: "FA-CPL-001",
    name: "Khớp nối trục đàn hồi",
    category: "Bán thành phẩm",
    unit: "Bộ",
    status: "Hoạt động",
    description: "Khớp nối bán thành phẩm, chờ lắp đệm đàn hồi.",
  },

  {
    key: "10",
    code: "FA-GRD-WHL",
    name: "Đá mài tròn ngoài",
    category: "Linh kiện / Vật tư",
    unit: "Cái",
    status: "Hoạt động",
    description: "Đá mài dùng cho nguyên công mài cổ trục.",
  },

  {
    key: "11",
    code: "FA-KEY-12",
    name: "Then bằng 12x8x50",
    category: "Linh kiện / Vật tư",
    unit: "Cái",
    status: "Hoạt động",
    description: "Then tiêu chuẩn lắp vào rãnh then trên trục.",
  },

  {
    key: "12",
    code: "FA-BLT-M12",
    name: "Bu lông M12x40",
    category: "Linh kiện / Vật tư",
    unit: "Cái",
    status: "Hoạt động",
    description: "Bu lông cường độ cao cấp bền 8.8.",
  },

  {
    key: "13",
    code: "FA-PUL-001",
    name: "Puly đai thang 2 rãnh",
    category: "Bán thành phẩm",
    unit: "Cái",
    status: "Hoạt động",
    description: "Puly gang đã tiện rãnh, chờ khoan lỗ then.",
  },

  {
    key: "14",
    code: "FA-SLV-001",
    name: "Bạc lót đồng phi 40",
    category: "Bán thành phẩm",
    unit: "Cái",
    status: "Hoạt động",
    description: "Bạc lót tiện từ phôi đồng thanh.",
  },

  {
    key: "15",
    code: "FA-PNT-GRY",
    name: "Sơn chống gỉ màu xám",
    category: "Linh kiện / Vật tư",
    unit: "Lít",
    status: "Hoạt động",
    description: "Sơn lót bảo vệ bề mặt chi tiết sau gia công.",
  },

  {
    key: "16",
    code: "FA-GBX-001",
    name: "Hộp giảm tốc một cấp",
    category: "Thành phẩm",
    unit: "Bộ",
    status: "Hoạt động",
    description: "Hộp giảm tốc lắp ráp hoàn thiện, đã kiểm tra KCS.",
  },

  {
    key: "17",
    code: "FA-WIR-EDM",
    name: "Dây cắt EDM 0.25 mm",
    category: "Linh kiện / Vật tư",
    unit: "Kg",
    status: "Hoạt động",
    description: "Dây đồng dùng cho máy cắt dây.",
  },

  {
    key: "18",
    code: "FA-SPD-001",
    name: "Trục chính đồ gá",
    category: "Bán thành phẩm",
    unit: "Cái",
    status: "Ngừng hoạt động",
    description: "Trục chính đồ gá (đang chờ bản thiết kế mới).",
  },
]

export const productMockData: Product[] = seedProducts.map(
  (product, index) => ({
    ...product,
    updatedAt: `2026-09-${String(index + 1).padStart(2, "0")}`,
  }),
)
