import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { runInNewContext } from "node:vm"
import ts from "typescript"
function load(file) {
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  const require = (name) => {
    const base = resolve(dirname(file), name)
    return load([".ts", ".tsx"].map((ext) => base + ext).find(existsSync))
  }
  runInNewContext(code, { module, exports: module.exports, require, crypto })
  return module.exports
}
const { mockUnits } = load(resolve("src/features/units/mocks/units.ts"))
const { filterUnits, saveUnit, importUnits } = load(
  resolve("src/features/units/lib/unitData.ts"),
)
const { parseUnits, unitHeaders } = load(
  resolve("src/features/units/services/unitExcel.ts"),
)
const before = JSON.stringify(mockUnits)
assert.equal(mockUnits.length, 12)
assert.equal(
  filterUnits(mockUnits, { name: " lit ", label: "lít", kind: "VOLUME" })
    .length,
  1,
)
assert.equal(filterUnits(mockUnits, { kind: "TIME" }).length, 2)
assert.equal(filterUnits(mockUnits, { name: "missing" }).length, 0)
const values = {
  name: " New unit ",
  label: " n ",
  kind: "COUNT",
  description: " Note ",
  status: "ACTIVE",
}
const added = saveUnit(mockUnits, values)
assert.equal(added.length, 13)
assert.equal(added[0].name, "New unit")
assert.equal(added[0].description, "Note")
const updated = saveUnit(
  added,
  { ...values, name: "Changed", status: "INACTIVE" },
  added[0].id,
)
assert.equal(updated[0].id, added[0].id)
assert.equal(updated[0].status, "INACTIVE")
assert.throws(() => saveUnit(added, { ...values, name: "NEW UNIT" }))
for (const bad of [{ name: " " }, { kind: "BAD" }, { status: "BAD" }])
  assert.throws(() => saveUnit(mockUnits, { ...values, ...bad }))
assert.throws(() => saveUnit(mockUnits, values, "missing"))
assert.throws(() =>
  importUnits(mockUnits, [values, { ...values, name: "LIT" }]),
)
assert.equal(JSON.stringify(mockUnits), before)
const parsed = parseUnits(unitHeaders, [
  ["New", "n", "Số lượng", "Desc", "Sử dụng"],
  ["Other", "", "TIME", "", "INACTIVE"],
])
assert.equal(parsed.length, 2)
assert.equal(parsed[1].kind, "TIME")
assert.equal(parsed[1].status, "INACTIVE")
assert.throws(() =>
  parseUnits(unitHeaders, [["New", "", "BAD", "", "Sử dụng"]]),
)
assert.throws(() => parseUnits(unitHeaders, [["New", "", "COUNT", "", "bad"]]))
assert.throws(() =>
  parseUnits(unitHeaders, [
    ["New", "", "COUNT", "", "ACTIVE"],
    ["NEW", "", "COUNT", "", "ACTIVE"],
  ]),
)
assert.throws(() => parseUnits(["Tên đơn vị"], []))
console.log(
  "PASS: Units filters, create/edit, validation, immutable seeds, duplicate protection and atomic Excel import",
)
