import type { WarehouseDocument, DocumentValues, DocumentLine } from "../types/document"
import { productMockData } from "../../products/mocks/products"
import { warehouses } from "../config/documentOptions"
export function availableStock(productId: string, warehouse: string) {
  return warehouse ? (Number(productId) * 17 + warehouses.findIndex(item => item.value === warehouse) * 31) % 180 + 20 : 0
}
export function nextDocumentCode(rows: WarehouseDocument[], type: string) {
  const prefix = ({ receipt: "NK", issue: "XK", internal: "NB", "material-issue": "CVT" } as Record<string, string>)[type]
  let number = 1
  const codes = new Set(rows.map(row => row.code))
  while (codes.has(`${prefix}-${String(number).padStart(6, "0")}`)) number++
  return `${prefix}-${String(number).padStart(6, "0")}`
}
export function validateDocument(type: string, values: DocumentValues, lines: DocumentLine[], confirm = false) {
  if (!values.plannedDate) throw new Error("Vui lòng chọn ngày dự kiến.")
  if (!values.requiredAt) throw new Error("Vui lòng chọn thời điểm cần thực hiện.")
  if (type !== "receipt" && !warehouses.some(row => row.value === values.sourceWarehouse)) throw new Error("Vui lòng chọn kho nguồn.")
  if (type !== "issue" && !warehouses.some(row => row.value === values.destinationWarehouse)) throw new Error("Vui lòng chọn kho đích.")
  if (["internal", "material-issue"].includes(type) && values.sourceWarehouse === values.destinationWarehouse) throw new Error("Kho nguồn và kho đích phải khác nhau.")
  if (confirm && !lines.length) throw new Error("Thêm ít nhất một sản phẩm trước khi xác nhận.")
  if (new Set(lines.map(line => line.productId)).size !== lines.length) throw new Error("Sản phẩm bị trùng.")
  for (const line of lines) {
    if (!productMockData.some(product => product.key === line.productId) || !Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("Sản phẩm và số lượng phải hợp lệ.")
    if (confirm && type !== "receipt" && line.quantity > availableStock(line.productId, values.sourceWarehouse)) throw new Error("Số lượng vượt tồn khả dụng.")
  }
}
