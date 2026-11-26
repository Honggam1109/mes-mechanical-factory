import assert from "node:assert/strict"

import { readFileSync } from "node:fs"

import { createRequire } from "node:module"

import { runInNewContext } from "node:vm"

import ts from "typescript"

const nativeRequire = createRequire(import.meta.url)

const cache = new Map()

function load(url) {
  if (cache.has(url.href)) return cache.get(url.href)

  const module = { exports: {} }

  const code = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,

      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  const require = (name) =>
    name.startsWith(".")
      ? load(new URL(`${name}.ts`, url))
      : nativeRequire(name)

  runInNewContext(code, {
    module,

    exports: module.exports,

    require,

    crypto,

    Intl,

    Date,
  })

  cache.set(url.href, module.exports)

  return module.exports
}

const { definitions } = load(
  new URL("../src/features/master-data/config.ts", import.meta.url),
)

const { snapshot, validateRecord, isReferenced, updateRows } = load(
  new URL("../src/features/master-data/store.ts", import.meta.url),
)

assert.equal(Object.keys(definitions).length, 18)

for (const [entity, rows] of Object.entries(snapshot())) {
  if (entity === "products") continue

  for (const row of rows)
    assert.equal(
      validateRecord(entity, row).length,

      0,

      `${entity}: ${validateRecord(entity, row)}`,
    )
}

const duplicate = { ...snapshot().warehouses[0], id: "new" }

assert.ok(
  validateRecord("warehouses", duplicate).some((issue) =>
    issue.includes("tồn tại"),
  ),
)

assert.ok(
  validateRecord("categories", {
    ...snapshot().categories[0],

    parent: "cat1",
  }).some((issue) => issue.includes("vòng lặp")),
)

const night = { ...snapshot().shifts[1] }

assert.equal(validateRecord("shifts", night).length, 0)

assert.ok(validateRecord("shifts", { ...night, breakMinutes: 480 }).length)

assert.ok(validateRecord("shifts", { ...night, start: "25:00" }).length)

assert.ok(
  validateRecord("attributes", {
    ...snapshot().attributes[0],

    values: ["Đỏ", "đỏ"],
  }).length,
)

assert.ok(
  validateRecord("employees", {
    ...snapshot().employees[0],

    productionUnitId: "missing",
  }).length,
)

assert.ok(
  validateRecord("grades", { ...snapshot().grades[0], order: 1.5 }).length,
)

assert.ok(isReferenced("warehouses", "wh1"))

const product = snapshot().products[0].id

const bom = {
  id: "bom1",

  code: "BOM-001",

  product,

  version: "1",

  quantity: 1,

  status: "Hoạt động",

  details: [
    { material: snapshot().products[1].id, quantity: 2, unit: "Cái", waste: 0 },
  ],
}

assert.equal(validateRecord("boms", bom).length, 0)

assert.ok(validateRecord("boms", { ...bom, details: [] }).length)

assert.ok(
  validateRecord("boms", {
    ...bom,

    details: [{ material: product, quantity: 1 }],
  }).length,
)

updateRows("boms", [bom])

assert.ok(
  validateRecord("boms", {
    ...bom,

    id: "bom2",

    code: "BOM-002",

    product: snapshot().products[1].id,

    details: [{ material: product, quantity: 1, bom: "bom1" }],
  }).some((issue) => issue.includes("Bán thành phẩm")),
)

assert.ok(isReferenced("products", product))

const route = {
  id: "route1",

  code: "ROU-001",

  name: "Lắp ráp",

  product,

  version: "1",

  status: "Hoạt động",

  details: [
    { order: 1, operation: "op1" },

    { order: 1, operation: "op1" },
  ],
}

assert.ok(
  validateRecord("routes", route).some((issue) => issue.includes("trùng")),
)

const station = {
  id: "st1",

  code: "STATION-001",

  name: "Trạm một",

  productionUnit: "area1",

  machineIds: ["mch1"],

  status: "Hoạt động",
}

assert.deepEqual(Array.from(validateRecord("stations", station)), [])

updateRows("stations", [station])

const secondStation = {
  ...station,

  id: "st2",

  code: "STATION-002",

  name: "Trạm hai",
}

assert.ok(
  validateRecord("stations", secondStation).some((issue) =>
    issue.includes("đã thuộc"),
  ),
)

assert.throws(
  () => updateRows("stations", [station, secondStation]),

  /đã thuộc/,
)

assert.equal(
  snapshot().stations.length,

  1,

  "Conflicting batch must not partially save",
)

assert.equal(
  validateRecord("stations", { ...secondStation, status: "Không hoạt động" })
    .length,

  0,
)

updateRows("stations", [
  { ...station, status: "Không hoạt động" },

  secondStation,
])

assert.throws(
  () => updateRows("stations", [station, secondStation]),

  /đã thuộc/,

  "Reactivating an occupied station must fail",
)

assert.ok(isReferenced("machines", "mch1"))

assert.throws(() => updateRows("machines", []), /tham chiếu/)

assert.throws(
  () =>
    updateRows(
      "machines",

      snapshot().machines.map((machine) => ({
        ...machine,

        productionUnit: "dept1",
      })),
    ),

  /gỡ máy/,
)

assert.ok(
  validateRecord("stations", {
    ...secondStation,

    productionUnit: "dept1",
  }).some((issue) => issue.includes("cùng đơn vị")),
)

assert.ok(
  validateRecord("stations", { ...secondStation, machineIds: [] }).length,
)

assert.ok(
  validateRecord("stations", { ...secondStation, machineIds: ["mch1", "mch1"] })
    .length,
)

updateRows("stations", [])

console.log(
  "PASS: 18 definitions, valid seeds, duplicate codes, parent cycles, references, shifts, attribute choices, route order, BOM quantities and cycles",
)
