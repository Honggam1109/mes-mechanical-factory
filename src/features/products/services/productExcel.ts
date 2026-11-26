import { decodeTable } from "../../../lib/tableExcel"

import type { Product } from "../types/product"

import { productExportRows } from "../lib/productImport"

async function workbook() {
  const { default: ExcelJS } = await import("exceljs")

  return new ExcelJS.Workbook()
}

export async function encodeProducts(
  products: Product[],
): Promise<ArrayBuffer> {
  const book = await workbook()

  const sheet = book.addWorksheet("Products")

  sheet.addRows(productExportRows(products))

  sheet.columns.forEach((column, index) => {
    column.width = [24, 40, 24, 14, 22, 70][index]
  })

  sheet.getRow(1).font = { bold: true }

  sheet.views = [{ state: "frozen", ySplit: 1 }]

  sheet.autoFilter = "A1:F1"

  const buffer = await book.xlsx.writeBuffer()

  return new Uint8Array(buffer).buffer
}

export async function decodeProducts(buffer: ArrayBuffer) {
  return decodeTable(buffer, "Products")
}

export async function downloadProducts(products: Product[], filename: string) {
  const buffer = await encodeProducts(products)

  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )

  const link = document.createElement("a")

  link.href = url

  link.download = filename

  document.body.appendChild(link)

  link.click()

  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
