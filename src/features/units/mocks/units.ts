import type { Unit, UnitKind } from "../types/unit"
const unit = (
  id: string,
  name: string,
  label: string,
  kind: UnitKind,
  description = "",
): Unit => ({ id, name, label, kind, description, status: "ACTIVE" })
export const mockUnits: Unit[] = [
  unit("u1", "Mét khối", "M3", "VOLUME"),
  unit("u2", "PHUT", "Phút", "TIME", "Đơn vị đo thời gian Phút"),
  unit("u3", "GIO", "Giờ", "TIME", "Đơn vị đo thời gian Giờ"),
  unit("u4", "M2", "Mét vuông", "AREA", "Đơn vị đo diện tích Mét vuông"),
  unit("u5", "LIT", "Lít", "VOLUME", "Đơn vị đo thể tích Lít"),
  unit("u6", "THUNG", "Thùng", "COUNT", "Đơn vị đóng gói Thùng"),
  unit("u7", "HOP", "Hộp", "COUNT", "Đơn vị đóng gói Hộp"),
  unit("u8", "CAI", "Cái", "COUNT", "Đơn vị đếm Cái"),
  unit("u9", "BO", "Bộ", "COUNT", "Đơn vị đếm Bộ"),
  unit("u10", "KG", "Kg", "MASS", "Đơn vị đo khối lượng Kilôgam"),
  unit("u11", "M", "Mét", "LENGTH", "Đơn vị đo chiều dài Mét"),
  unit("u12", "MM", "Milimét", "LENGTH", "Đơn vị đo chiều dài Milimét"),
]
