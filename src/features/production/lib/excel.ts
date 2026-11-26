import type { Catalog } from "../../process-bom/lib/model"

import type { ManufacturingOrder } from "../types"

import {
  formatTime,
  orderActuals,
  orderLabels,
  orderSource,
  percent,
} from "./model"

export async function encodeOrders(rows: ManufacturingOrder[], all: Catalog) {
  const { default: ExcelJS } = await import("exceljs"),
    book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Lệnh sản xuất")

  sheet.addRow([
    "Mã lệnh",

    "Mã sản phẩm",

    "Tên sản phẩm",

    "Quy trình",

    "Phiên bản",

    "BOM",

    "SL kế hoạch",

    "Đơn vị",

    "Ưu tiên",

    "Bắt đầu dự kiến",

    "Kết thúc dự kiến",

    "SL thực hiện",


    "Tiến độ (%)",

    "Trạng thái",

    "Ghi chú",
  ])

  for (const order of rows) {
    const source = orderSource(order, all),
      actual = orderActuals(order, all)

    sheet.addRow([
      order.code,

      source?.product.code || "",

      source?.product.name || "",

      source?.route.code || "",

      source?.route.version || "",

      source?.bom.code || "",

      order.quantity,

      source?.product.unit || "",

      order.priority,

      formatTime(order.start),

      formatTime(order.end),

      actual.quantity,


      Number(percent(actual.quantity, order.quantity).toFixed(2)),

      orderLabels[order.status],

      order.note,
    ])
  }

  sheet.getRow(1).font = { bold: true }

  sheet.columns.forEach((column) => {
    column.width = 24
  })

  return book.xlsx.writeBuffer()
}

export async function downloadOrders(rows: ManufacturingOrder[], all: Catalog) {
  const buffer = await encodeOrders(rows, all),
    url = URL.createObjectURL(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ),
    link = document.createElement("a")

  link.href = url

  link.download = "lenh-san-xuat.xlsx"

  link.click()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
