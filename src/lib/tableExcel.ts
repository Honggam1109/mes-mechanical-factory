export interface ExcelTable {
  headers: string[]
  rows: string[][]
}
export async function decodeTable(
  buffer: ArrayBuffer,
  sheetName: string,
): Promise<ExcelTable> {
  const { default: ExcelJS } = await import("exceljs")
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer)
  const sheet = book.getWorksheet(sheetName) ?? book.worksheets[0]
  if (!sheet) throw new Error("File không có worksheet.")
  if (sheet.rowCount > 5001 || sheet.columnCount > 100)
    throw new Error("File vượt giới hạn 5.000 dòng hoặc 100 cột.")
  const readRow = (index: number) =>
    Array.from({ length: sheet.columnCount }, (_, column) => {
      const cell = sheet.getRow(index).getCell(column + 1)
      if (cell.type === 6)
        throw new Error(
          `Dòng ${index}: không hỗ trợ ô công thức, vui lòng dán giá trị.`,
        )
      return cell.text
    })
  return {
    headers: readRow(1),
    rows: Array.from({ length: Math.max(0, sheet.rowCount - 1) }, (_, index) =>
      readRow(index + 2),
    ),
  }
}
export async function downloadTable(
  headers: string[],
  rows: string[][],
  filename: string,
  sheetName: string,
) {
  const { default: ExcelJS } = await import("exceljs")
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet(sheetName)
  sheet.addRow(headers)
  sheet.addRows(rows)
  sheet.columns.forEach((column) => {
    column.width = 26
  })
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: "frozen", ySplit: 1 }]
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(await book.xlsx.writeBuffer())], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
