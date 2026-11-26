import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
function load(file) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const require = name => {
    const base = resolve(dirname(file), name)
    return load(['.ts', '.tsx'].map(ext => base + ext).find(existsSync))
  }
  runInNewContext(code, { module, exports: module.exports, require, crypto })
  return module.exports
}
const { productExcelColumns, validateProductImport, mergeImportedProducts, productExportRows } = load(resolve('src/features/products/lib/productImport.ts'))
const { productMockData } = load(resolve('src/features/products/mocks/products.ts'))
const headers = productExcelColumns.map(column => column.header)
const source = structuredClone(productMockData)
source[0].pqc = true
source[0].attributes = [{ attributeName: 'Color', attributeValue: 'Red' }]
const snapshot = JSON.stringify(source)
const exported = productExportRows(source)
const original = validateProductImport(exported[0], exported.slice(1), source)
assert.equal(original.issues.length, 0)
assert.equal(original.updated, 18)
assert.equal(original.added, 0)
const update = [...exported[1]]; update[0] = update[0].toLowerCase(); update[1] = 'Updated'
const create = [...exported[1]]; create[0] = 'NEW-001'; create[1] = 'New'
const preview = validateProductImport(headers, [update, [], create], source)
assert.equal(preview.issues.length, 0)
assert.equal(preview.updated, 1)
assert.equal(preview.added, 1)
const merged = mergeImportedProducts(source, preview, '2026-10-08')
assert.equal(merged.length, 19)
assert.equal(merged[0].key, source[0].key)
assert.equal(merged[0].code, source[0].code)
assert.equal(merged[0].name, 'Updated')
assert.equal(merged[0].pqc, true)
assert.equal(merged[0].attributes[0].attributeValue, 'Red')
assert.equal(merged[18].updatedAt, '2026-10-08')
const duplicate = validateProductImport(headers, [create, create], source)
assert.ok(duplicate.issues.some(issue => issue.row === 3))
assert.throws(() => mergeImportedProducts(source, duplicate, '2026-10-08'))
assert.ok(validateProductImport(headers.slice(1), [create], source).issues.length)
assert.ok(validateProductImport([...headers, headers[0]], [create], source).issues.length)
assert.ok(validateProductImport(headers, [], source).issues.length)
const invalid = [...create]; invalid[1] = ' '; invalid[2] = 'invalid'; invalid[4] = 'invalid'
assert.equal(validateProductImport(headers, [invalid], source).issues.length, 3)
const reversed = validateProductImport([...headers].reverse(), [[...create].reverse()], source)
assert.equal(reversed.issues.length, 0)
assert.equal(JSON.stringify(source), snapshot)
console.log('PASS: column mapping, roundtrip rows, preview counts, duplicates, required fields, invalid options, atomic merge, stable IDs and preserved attributes')
