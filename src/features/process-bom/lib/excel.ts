import type { RecordData } from "../../master-data/config"

import {
  bomLines,
  orderedSteps,
  text,
  validateBom,
  validateRoute,
  routeCatalog,
  type Catalog,
} from "./model"

import { configurationRecord, type ConfigurationKind } from "./service"

export const headers = (kind: ConfigurationKind) =>
  kind === "boms"
    ? [
        "Mã BOM",
        "Mã sản phẩm",
        "Số lượng cơ sở",
        "Trạng thái",
        "Mô tả",
        "Thành phần (JSON)",
      ]
    : [
        "Mã quy trình",
        "Tên quy trình",
        "Mã BOM",
        "Sản lượng chuẩn",
        "Mã công đoạn chính",
        "Mã đơn vị sản xuất",
        "Phiên bản",
        "Trạng thái sử dụng",
        "Mô tả",
        "Công đoạn (JSON)",
        "Vật tư tiêu hao (JSON)",
        "Ghi chú thay đổi",
      ]

export async function encodeConfigurations(
  kind: ConfigurationKind,
  rows: RecordData[],
  all: Catalog,
) {
  const { default: ExcelJS } = await import("exceljs"),
    book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Data")

  sheet.addRow(headers(kind))

  for (const row of rows) {
    const source = kind === "routes" ? routeCatalog(row, all) : all,
      product = source.products.find((item) => item.id === row.product),
      status = row.status === "Hoạt động" ? "Hoạt động" : "Ngừng hoạt động"

    const details =
      kind === "boms"
        ? bomLines(row).map((line) => ({
            material: text(
              source.products.find((item) => item.id === line.material)?.code,
            ),
            quantity: line.quantity,
            waste: Number(line.waste || 0),
            bom: text(source.boms.find((item) => item.id === line.bom)?.code),
            note: line.note || "",
          }))
        : orderedSteps(row).map((step) => ({
            order: step.order,
            operation: text(
              source.operations.find((item) => item.id === step.operation)
                ?.code,
            ),
            note: step.note || "",
          }))

    const selected = Array.isArray(row.materials)
      ? row.materials.map((id) =>
          text(source.products.find((item) => item.id === id)?.code),
        )
      : []

    sheet.addRow(
      kind === "boms"
        ? [
            row.code,
            product?.code || "",
            row.quantity,
            status,
            row.description || "",
            JSON.stringify(details),
          ]
        : [
            row.code,
            row.name,
            source.boms.find((item) => item.id === row.bom)?.code || "",
            row.quantity,
            source.operations.find((item) => item.id === row.operation)?.code ||
              "",
            source.productionUnits.find(
              (item) => item.id === row.productionUnit,
            )?.code || "",
            row.version,
            status,
            row.description || "",
            JSON.stringify(details),
            JSON.stringify(selected),
            row.changeNote || "",
          ],
    )
  }

  sheet.columns.forEach((column) => {
    column.width = 28
  })
  sheet.getRow(1).font = { bold: true }

  const help = book.addWorksheet("Hướng dẫn")
  help.addRow([
    "Import chỉ thêm mới. Quy trình luôn được nhập ở Bản nháp; Áp dụng bằng thao tác trên màn hình. Dùng mã danh mục nguồn. Mọi dòng phải hợp lệ trước khi nhập.",
  ])
  help.addRow([
    kind === "boms"
      ? 'Thành phần (JSON): [{"material":"PRODUCT-0001","quantity":2,"waste":3,"bom":"","note":""}]'
      : 'Công đoạn (JSON): [{"order":10,"operation":"OP-0001","note":""}]. Vật tư tiêu hao (JSON): ["PRODUCT-0001"]',
  ])
  help.columns = [{ width: 130 }]

  return book.xlsx.writeBuffer()
}

export async function downloadConfigurations(
  kind: ConfigurationKind,
  rows: RecordData[],
  all: Catalog,
  template = false,
) {
  const buffer = await encodeConfigurations(kind, rows, all),
    url = URL.createObjectURL(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ),
    link = document.createElement("a")
  link.href = url
  link.download = `${template ? "mau-nhap-" : ""}${
    kind === "boms" ? "dinh-muc-bom" : "quy-trinh-cong-nghe"
  }.xlsx`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function decodeConfigurations(
  buffer: ArrayBuffer,
  kind: ConfigurationKind,
  all: Catalog,
): Promise<RecordData[]> {
  const { default: ExcelJS } = await import("exceljs"),
    book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer)

  const sheet = book.getWorksheet("Data") || book.worksheets[0]

  if (!sheet || sheet.rowCount > 5001)
    throw new Error("File không hợp lệ hoặc vượt quá 5000 bản ghi.")

  if (
    headers(kind).some(
      (label, index) =>
        sheet
          .getRow(1)
          .getCell(index + 1)
          .text.trim() !== label,
    )
  )
    throw new Error("Cột dữ liệu không đúng file mẫu mới.")

  const rows: RecordData[] = []

  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index)
    if (!row.hasValues) continue

    const values = headers(kind).map((_, column) => {
      const cell = row.getCell(column + 1)
      if (cell.type === 6)
        throw new Error(`Dòng ${index}: không hỗ trợ công thức.`)
      return cell.text.trim()
    })

    const json = (value: string) => {
      try {
        const parsed = JSON.parse(value || "[]")
        if (!Array.isArray(parsed)) throw new Error()
        return parsed
      } catch {
        throw new Error(
          `Dòng ${index}: danh sách chi tiết cần mảng JSON hợp lệ.`,
        )
      }
    }

    const details = json(values[kind === "boms" ? 5 : 9])
    if (
      details.some(
        (item) => !item || typeof item !== "object" || Array.isArray(item),
      )
    )
      throw new Error(`Dòng ${index}: chi tiết không hợp lệ.`)

    const product = all.products.find((item) => item.code === values[1]),
      bom = all.boms.find((item) => item.code === values[2])

    const mapped = details.map((detail) =>
      kind === "boms"
        ? {
            ...detail,
            material:
              all.products.find((item) => item.code === detail.material)?.id ||
              detail.material,
            bom:
              all.boms.find((item) => item.code === detail.bom)?.id ||
              detail.bom ||
              "",
          }
        : {
            ...detail,
            operation:
              all.operations.find((item) => item.code === detail.operation)
                ?.id || detail.operation,
          },
    )

    if (!values[0]) throw new Error(`Dòng ${index}: mã là bắt buộc.`)

    const materials = kind === "routes" ? json(values[10]) : []

    if (materials.some((item) => typeof item !== "string"))
      throw new Error(
        `Dòng ${index}: vật tư tiêu hao cần danh sách mã sản phẩm.`,
      )

    rows.push(
      configurationRecord(
        kind,
        {
          id: crypto.randomUUID(),
          code: values[0],
          product:
            kind === "boms" ? product?.id || values[1] : bom?.product || "",
          bom: bom?.id || values[2],
          name: kind === "routes" ? values[1] : "",
          quantity: Number(values[kind === "boms" ? 2 : 3]),
          status:
            values[kind === "boms" ? 3 : 7] === "Ngừng hoạt động"
              ? "Không hoạt động"
              : values[kind === "boms" ? 3 : 7],
          description: values[kind === "boms" ? 4 : 8],
          details: mapped,
          lifecycle: "DRAFT",
          version: kind === "routes" ? values[6] : "1.0",
          operation:
            all.operations.find((item) => item.code === values[4])?.id ||
            values[4],
          productionUnit:
            all.productionUnits.find((item) => item.code === values[5])?.id ||
            values[5],
          materials: materials.map(
            (code) =>
              all.products.find((item) => item.code === code)?.id || code,
          ),
          changeNote: values[11] || "",
        },
        all,
      ),
    )
  }

  if (!rows.length) throw new Error("File không có dữ liệu.")

  const staged = { ...all, [kind]: [...all[kind], ...rows] },
    errors = rows.flatMap((row, index) =>
      (kind === "boms" ? validateBom : validateRoute)(row, staged, all).map(
        (error) => `Dòng ${index + 2}: ${error}`,
      ),
    )

  if (errors.length) throw new Error(errors.join("\n"))

  return rows
}
