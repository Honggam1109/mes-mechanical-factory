import { decodeTable, downloadTable } from "../../../lib/tableExcel"
import { unitKinds, type UnitValues } from "../types/unit"
import { importUnits } from "../lib/unitData"
export const unitHeaders = [
  "Tên đơn vị",
  "Nhãn đơn vị",
  "Loại đơn vị",
  "Mô tả đơn vị",
  "Trạng thái",
]
export const downloadUnits = (rows: UnitValues[], template = false) =>
  downloadTable(
    unitHeaders,
    rows.map((row) => [
      row.name,
      row.label,
      unitKinds.find((k) => k.value === row.kind)?.label || row.kind,
      row.description,
      row.status === "ACTIVE" ? "Sử dụng" : "Ngừng sử dụng",
    ]),
    template ? "mau-don-vi-tinh.xlsx" : "don-vi-tinh.xlsx",
    "Units",
  )
export function parseUnits(headers: string[], rows: string[][]): UnitValues[] {
  const columns = unitHeaders.map((header) =>
    headers.findIndex((value) => value.trim() === header),
  )
  if (columns.some((index) => index < 0))
    throw new Error("Cột không đúng định dạng. Vui lòng sử dụng file mẫu.")
  const result = rows.flatMap((row, index) => {
    if (row.every((value) => !value.trim())) return []
    const [name, label, type, description, status] = columns.map((column) =>
      (row[column] || "").trim(),
    )
    const kind = unitKinds.find((k) => k.value === type || k.label === type)
      ?.value
    if (!kind) throw new Error(`Dòng ${index + 2}: loại đơn vị không hợp lệ.`)
    if (!["Sử dụng", "Ngừng sử dụng", "ACTIVE", "INACTIVE"].includes(status))
      throw new Error(`Dòng ${index + 2}: trạng thái không hợp lệ.`)
    return [
      {
        name,
        label,
        kind,
        description,
        status:
          status === "Sử dụng" || status === "ACTIVE"
            ? "ACTIVE" as const
            : "INACTIVE" as const,
      },
    ]
  })
  if (!result.length) throw new Error("File không có dữ liệu.")
  importUnits([], result)
  return result
}
export async function readUnits(file: File) {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024)
    throw new Error("Chỉ nhập file .xlsx tối đa 5 MB.")
  const data = await decodeTable(await file.arrayBuffer(), "Units")
  return parseUnits(data.headers, data.rows)
}
