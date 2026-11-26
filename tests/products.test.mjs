import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
function load(file) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  runInNewContext(code, { module, exports: module.exports, require, crypto, Intl, Date })
  return module.exports
}
const { filterProducts, nextProductCode, saveProduct, clampPage } = load("../src/features/products/lib/productData.ts")
const { productMockData } = load("../src/features/products/mocks/products.ts")
const products = structuredClone(productMockData)
const snapshot = JSON.stringify(products)
assert.equal(products.length, 18)
assert.equal(filterProducts(products, { keyword: "  fa-shf-001 " }).length, 1)
const match = products[0]
assert.equal(filterProducts(products, { keyword: match.name.toUpperCase(), category: match.category, status: match.status, dateRange: [match.updatedAt, match.updatedAt] }).length, 1)
assert.equal(filterProducts(products, { dateRange: ["2027-01-01", "2027-12-31"] }).length, 0)
assert.equal(filterProducts(products, { keyword: "no-such-product" }).length, 0)
assert.equal(filterProducts(products, {}).length, 18)
const values = { ...match, code: nextProductCode(products), name: "  New product  ", pqc: true, iqc: true, attributes: [{ attributeName: "Color", attributeValue: "Red" }] }
const added = saveProduct(products, values)
assert.equal(added.length, 19)
assert.equal(added[0].name, "New product")
assert.notEqual(added[0].key, match.key)
assert.equal(added[0].attributes[0].attributeValue, "Red")
assert.match(added[0].updatedAt, /^\d{4}-\d{2}-\d{2}$/)
assert.equal(nextProductCode(added), "PRODUCT-0002")
const edited = saveProduct(added, { ...added[0], name: "Edited product", pqc: false }, added[0].key)
assert.equal(edited.length, 19)
assert.equal(edited[0].key, added[0].key)
assert.equal(edited[0].name, "Edited product")
assert.equal(edited[0].pqc, false)
const deleted = edited.filter(product => product.key !== edited[0].key)
assert.equal(deleted.length, 18)
assert.equal(clampPage(2, 10, 10), 1)
assert.equal(clampPage(2, 18, 10), 2)
assert.equal(clampPage(4, 0, 10), 1)
assert.equal(JSON.stringify(products), snapshot)
console.log("PASS: combined filters, date boundaries, reset, create, edit, attributes, generated codes, delete, pagination and immutable seed data")
