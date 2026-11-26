import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { runInThisContext } from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
const nativeRequire = createRequire(import.meta.url)
function load(file) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
  const require = name => {
    if (!name.startsWith('.')) return nativeRequire(name)
    const base = resolve(dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(existsSync))
  }
  runInThisContext("(function(require,module,exports){" + code + "\n})")(require, module, module.exports)
  return module.exports
}
const { encodeProducts, decodeProducts } = load(resolve('src/features/products/services/productExcel.ts'))
const { validateProductImport } = load(resolve('src/features/products/lib/productImport.ts'))
const { productMockData } = load(resolve('src/features/products/mocks/products.ts'))
const buffer = await encodeProducts(productMockData)
assert.equal(new Uint8Array(buffer)[0], 80)
assert.equal(new Uint8Array(buffer)[1], 75)
const decoded = await decodeProducts(buffer)
assert.equal(decoded.rows.length, 18)
const preview = validateProductImport(decoded.headers, decoded.rows, productMockData)
assert.equal(preview.issues.length, 0)
assert.equal(preview.updated, 18)
assert.equal(decoded.rows[0][1], productMockData[0].name)
const template = await decodeProducts(await encodeProducts([]))
assert.equal(template.headers.length, 6)
assert.equal(template.rows.length, 0)
await assert.rejects(() => decodeProducts(new Uint8Array([1,2,3]).buffer))
const ExcelJS = nativeRequire('exceljs')
const formulaBook = new ExcelJS.Workbook()
const sheet = formulaBook.addWorksheet('Products')
sheet.addRow(decoded.headers)
sheet.addRow(decoded.rows[0])
sheet.getCell('B2').value = { formula: '1+1', result: 2 }
const formula = new Uint8Array(await formulaBook.xlsx.writeBuffer()).buffer
await assert.rejects(() => decodeProducts(formula), /2:/)
await mkdir('.tmp-excel', { recursive: true })
const imported = [{ ...productMockData[0], name: 'Updated from Excel' }, { ...productMockData[0], key: 'new', code: 'EXCEL-NEW-001', name: 'New from Excel' }]
await writeFile('.tmp-excel/import-valid.xlsx', new Uint8Array(await encodeProducts(imported)))
const invalid = new ExcelJS.Workbook(); const invalidSheet = invalid.addWorksheet('Products')
invalidSheet.addRow(decoded.headers); invalidSheet.addRow(['INVALID', '', 'bad', '', 'bad', ''])
await writeFile('.tmp-excel/import-invalid.xlsx', new Uint8Array(await invalid.xlsx.writeBuffer()))
console.log('PASS: XLSX ZIP signature, Vietnamese roundtrip, 18-row export, template, invalid files, formula rejection; browser fixtures prepared')
