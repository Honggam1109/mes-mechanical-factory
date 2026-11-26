import { productCategories, productStatuses } from "../config/productOptions"
import type { Product, ProductValues } from "../types/product"

export const productExcelColumns = [
  { key: "code", header: "Mã sản phẩm" },
  { key: "name", header: "Tên sản phẩm" },
  { key: "category", header: "Phân loại" },
  { key: "unit", header: "Đơn vị" },
  { key: "status", header: "Trạng thái" },
  { key: "description", header: "Mô tả sản phẩm" },
] as const

export interface ProductImportIssue {
  row: number
  message: string
}
export interface ProductImportPreview {
  rows: ProductValues[]
  issues: ProductImportIssue[]
  added: number
  updated: number
}

const text = (value: unknown) => value == null ? "" : String(value).trim()
const normalizeCode = (value: string) => value.trim().toLocaleUpperCase()

/** Row numbers include the header; blank rows are ignored. No state is changed here. */
export function validateProductImport(headers: unknown[], rows: unknown[][], existing: Product[]): ProductImportPreview {
  const preview: ProductImportPreview = { rows: [], issues: [], added: 0, updated: 0 }
  const labels = headers.map(text)
  const indexes = productExcelColumns.map(column => labels.indexOf(column.header))
  productExcelColumns.forEach((column, index) => {
    if (indexes[index] < 0) preview.issues.push({ row: 1, message: `Thiếu cột "${column.header}".` })
    if (labels.filter(label => label === column.header).length > 1) preview.issues.push({ row: 1, message: `Cột "${column.header}" bị trùng.` })
  })
  if (preview.issues.length) return preview
  const existingCodes = new Set(existing.map(product => normalizeCode(product.code)))
  const seen = new Set<string>()
  rows.forEach((row, index) => {
    if (row.every(value => !text(value))) return
    const values: ProductValues = {
      code: text(row[indexes[0]]), name: text(row[indexes[1]]), category: text(row[indexes[2]]),
      unit: text(row[indexes[3]]), status: text(row[indexes[4]]), description: text(row[indexes[5]]),
    }
    const rowNumber = index + 2
    const errors: string[] = []
    if (!values.code) errors.push("Mã sản phẩm là bắt buộc.")
    if (!values.name) errors.push("Tên sản phẩm là bắt buộc.")
    if (!productCategories.some(option => option.value === values.category)) errors.push("Phân loại không hợp lệ.")
    if (!productStatuses.some(option => option.value === values.status)) errors.push("Trạng thái không hợp lệ.")
    const code = normalizeCode(values.code)
    if (seen.has(code)) errors.push(`Mã "${values.code}" bị trùng trong file.`)
    seen.add(code)
    errors.forEach(message => preview.issues.push({ row: rowNumber, message }))
    if (errors.length) return
    preview.rows.push(values)
    if (existingCodes.has(code)) preview.updated += 1
    else preview.added += 1
  })
  if (!preview.rows.length && !preview.issues.length) preview.issues.push({ row: 2, message: "File không có dữ liệu sản phẩm." })
  return preview
}

/** Merge only after explicit confirmation of a valid preview, preserving feature-only fields. */
export function mergeImportedProducts(existing: Product[], preview: ProductImportPreview, updatedAt: string): Product[] {
  if (preview.issues.length || !preview.rows.length) throw new Error("Dữ liệu nhập chưa hợp lệ.")
  const next = existing.map(product => ({ ...product }))
  for (const row of preview.rows) {
    const index = next.findIndex(product => normalizeCode(product.code) === normalizeCode(row.code))
    if (index >= 0) next[index] = { ...next[index], ...row, code: next[index].code, updatedAt }
    else next.push({ ...row, key: crypto.randomUUID(), updatedAt })
  }
  return next
}

export function productExportRows(products: Product[]) {
  return [productExcelColumns.map(column => column.header), ...products.map(product => productExcelColumns.map(column => product[column.key]))]
}
