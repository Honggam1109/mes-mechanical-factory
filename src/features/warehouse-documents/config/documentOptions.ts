export const documentTypes = [
  { value: "receipt", label: "Nhập kho" }, { value: "issue", label: "Xuất kho" },
  { value: "internal", label: "Nội bộ" }, { value: "material-issue", label: "Cấp vật tư" },
]
export const documentStatuses = [
  { value: "draft", label: "Nháp", color: "default" }, { value: "waiting", label: "Đang chờ", color: "gold" },
  { value: "executing", label: "Đang thực hiện", color: "processing" }, { value: "completed", label: "Hoàn tất", color: "success" },
  { value: "cancelled", label: "Hủy", color: "error" },
]
export const warehouses = [
  { value: "raw", label: "Kho nguyên vật liệu" }, { value: "production", label: "Kho sản xuất" },
  { value: "finished", label: "Kho thành phẩm" },
]
