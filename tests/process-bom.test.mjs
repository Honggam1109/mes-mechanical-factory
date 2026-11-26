import assert from "node:assert/strict"

import { readFileSync, existsSync } from "node:fs"

import { resolve, dirname } from "node:path"

import { createRequire } from "node:module"

import { runInThisContext } from "node:vm"

import ts from "typescript"

const nativeRequire = createRequire(import.meta.url),
  cache = new Map()

const browserCache = new Map()

const browserWindow = {
  localStorage: {
    getItem: (key) => browserCache.get(key) ?? null,

    setItem: (key, value) => browserCache.set(key, value),
  },
}

function load(file) {
  if (cache.has(file)) return cache.get(file)

  const module = { exports: {} }

  cache.set(file, module.exports)

  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,

      target: ts.ScriptTarget.ES2022,

      esModuleInterop: true,
    },
  }).outputText

  const require = (name) => {
    if (!name.startsWith(".")) return nativeRequire(name)

    const base = resolve(dirname(file), name)

    return load([".ts", ".tsx"].map((ext) => base + ext).find(existsSync))
  }

  runInThisContext("(function(require,module,exports,window){" + code + "\n})")(
    require,

    module,

    module.exports,

    browserWindow,
  )

  return module.exports
}

const store = load(resolve("src/features/master-data/store.ts")),
  model = load(resolve("src/features/process-bom/lib/model.ts")),
  service = load(resolve("src/features/process-bom/lib/service.ts"))

const all = store.snapshot(),
  product = all.products[0],
  sub = all.products[1],
  material = all.products[4],
  op = all.operations[0]

assert.equal(
  model.validateOperation({ ...op, productionUnitIds: ["dept1", "area1"] }, all)
    .length,
  0,
)

assert.ok(model.validateOperation({ ...op, productionUnitIds: [] }, all).length)

assert.ok(
  model.validateOperation({ ...op, productionUnitIds: ["area1", "area1"] }, all)
    .length,
)

const child = service.saveBom({
  id: "new",
  code: "unused",
  product: sub.id,
  quantity: 2,
  status: "Hoạt động",
  details: [{ material: material.id, quantity: 4, waste: 10, note: "Phôi" }],
})

const bom = service.saveBom({
  id: "new",
  code: "unused",
  product: product.id,
  quantity: 10,
  status: "Hoạt động",
  description: "BOM phương án A",
  details: [
    { material: sub.id, quantity: 3, waste: 2, bom: child.id, note: "BTP" },
    { material: material.id, quantity: 1, waste: 3, note: "Vật tư" },
  ],
})

const alternate = service.saveBom({
  ...bom,
  description: "BOM phương án B",
  details: [
    { material: material.id, quantity: 2, waste: 5, note: "Vật tư thay thế" },
  ],
})

assert.notEqual(bom.id, alternate.id)

assert.notEqual(bom.code, alternate.code)

assert.equal(
  store
    .snapshot()
    .boms.filter((row) => row.product === product.id && model.active(row))
    .length,
  2,
)

assert.ok(model.validateBom({ ...bom, details: [] }, store.snapshot()).length)

assert.ok(model.validateBom({ ...bom, quantity: 0 }, store.snapshot()).length)

assert.ok(
  model
    .validateBom(
      { ...bom, details: [bom.details[0], bom.details[0]] },
      store.snapshot(),
    )
    .some((error) => error.includes("trùng")),
)

assert.ok(
  model.validateBom(
    { ...bom, details: [{ material: product.id, quantity: 1, waste: 0 }] },
    store.snapshot(),
  ).length,
)

assert.ok(
  model
    .validateBom(
      { ...bom, details: [{ material: material.id, quantity: 1, waste: 101 }] },
      store.snapshot(),
    )
    .some((error) => error.includes("hao hụt")),
)

assert.ok(
  model.validateBom(
    { ...bom, details: [{ material: sub.id, quantity: 1, bom: alternate.id }] },
    store.snapshot(),
  ).length,
)

const tree = model.buildBomTree(bom, store.snapshot())

assert.equal(tree.children[0].quantity, 3.06)

assert.ok(Math.abs(tree.children[0].children[0].quantity - 6.732) < 0.000001)

const cycleA = {
  id: "cycleA",
  code: "CYCLE-A",
  product: sub.id,
  quantity: 1,
  status: "Hoạt động",
  details: [{ material: all.products[8].id, quantity: 1, bom: "cycleB" }],
}

const cycleB = {
  id: "cycleB",
  code: "CYCLE-B",
  product: all.products[8].id,
  quantity: 1,
  status: "Hoạt động",
  details: [{ material: sub.id, quantity: 1, bom: "cycleA" }],
}

assert.ok(
  model
    .validateBom(cycleA, { ...all, boms: [cycleA, cycleB] })
    .some((error) => error.includes("vòng lặp")),
)

const input = {
  id: "unused",
  name: "Quy trình A",
  bom: bom.id,
  product: "tampered",
  quantity: 20,
  status: "Hoạt động",
  operation: op.id,
  productionUnit: "area1",
  materials: [sub.id],
  details: [
    { stepId: "s2", order: 20, operation: op.id, note: "Lần 2" },
    { stepId: "s1", order: 10, operation: op.id, note: "Lần 1" },
  ],
}

const route = service.saveRoute(input)

assert.equal(route.product, product.id)

assert.equal(route.version, "1.0")

assert.equal(route.lifecycle, "DRAFT")

assert.deepEqual(
  route.details.map((step) => step.order),
  [10, 20],
)

assert.equal(model.consumption(route, store.snapshot())[0].quantity, 6)

assert.equal(model.consumption(route, store.snapshot())[0].total, 6.12)

const routeB = service.saveRoute({
  ...input,
  bom: alternate.id,
  materials: [material.id],
  name: "Quy trình B",
})

const routeC = service.saveRoute({ ...input, name: "Quy trình C" })

assert.notEqual(route.code, routeB.code)

assert.notEqual(route.code, routeC.code)

assert.equal(
  store.snapshot().routes.filter((row) => row.product === product.id).length,
  3,
)

assert.ok(
  model.validateRoute({ ...route, bom: "missing" }, store.snapshot()).length,
)

assert.ok(
  model
    .validateRoute({ ...route, product: sub.id }, store.snapshot())
    .some((error) => error.includes("khớp BOM")),
)

assert.ok(
  model.validateRoute(
    { ...route, materials: [material.id, material.id] },
    store.snapshot(),
  ).length,
)

assert.ok(
  model.validateRoute({ ...route, materials: ["unknown"] }, store.snapshot())
    .length,
)

assert.ok(
  model
    .validateRoute({ ...route, productionUnit: "dept1" }, store.snapshot())
    .some((error) => error.includes("khả năng")),
)

assert.ok(
  model
    .validateRoute(
      {
        ...route,
        details: [
          { order: 10, operation: op.id },
          { order: 10, operation: op.id },
        ],
      },
      store.snapshot(),
    )
    .some((error) => error.includes("trùng")),
)

assert.ok(
  model.validateRoute({ ...route, details: [] }, store.snapshot()).length,
)

assert.ok(
  model.validateRoute(
    { ...route, details: [{ order: 1.5, operation: op.id }] },
    store.snapshot(),
  ).length,
)

service.transitionRoute(route.id, "APPLY")

let applied = store.snapshot().routes.find((row) => row.id === route.id)

assert.equal(applied.lifecycle, "ACTIVE")

assert.ok(applied.referenceSnapshot)

assert.ok(applied.appliedAt)

assert.throws(
  () => service.saveRoute({ ...route, name: "bad" }, route.id),
  /khóa sửa/,
)

assert.throws(
  () =>
    store.updateRows(
      "routes",
      store
        .snapshot()
        .routes.map((row) =>
          row.id === route.id ? { ...row, name: "tampered" } : row,
        ),
    ),
  /khóa sửa/,
)

assert.throws(
  () =>
    store.updateRows(
      "routes",
      store.snapshot().routes.filter((row) => row.id !== route.id),
    ),
  /Không xóa/,
)

assert.ok(store.isReferenced("boms", bom.id))

assert.ok(store.isReferenced("boms", child.id))

assert.throws(
  () =>
    store.updateRows(
      "boms",
      store.snapshot().boms.filter((row) => row.id !== bom.id),
    ),
  /tham chiếu/,
)

assert.throws(
  () => service.saveBom({ ...bom, product: all.products[6].id }, bom.id),
  /sản phẩm đầu ra/,
)

service.saveBom({ ...bom, quantity: 30 }, bom.id)

assert.equal(
  model.consumption(applied, store.snapshot())[0].total,
  6.12,
  "Applied consumption must retain original BOM quantity",
)

assert.equal(
  model
    .routeCatalog(applied, store.snapshot())
    .boms.find((row) => row.id === bom.id).quantity,
  10,
)

const version2 = service.newRouteVersion(route.id)

assert.equal(version2.code, route.code)

assert.equal(version2.version, "2.0")

assert.equal(version2.lifecycle, "DRAFT")

assert.equal(version2.parentVersionId, route.id)

assert.equal("referenceSnapshot" in version2, false)

assert.throws(() => service.newRouteVersion(route.id), /bản nháp/)

const revised = service.saveRoute(
  {
    ...version2,
    bom: alternate.id,
    materials: [material.id],
    changeNote: "Đổi BOM phương án B",
  },
  version2.id,
)

assert.equal(revised.code, route.code)

assert.equal(revised.version, "2.0")

service.transitionRoute(revised.id, "APPLY")

applied = store.snapshot().routes.find((row) => row.id === revised.id)

assert.equal(
  store.snapshot().routes.find((row) => row.id === route.id).lifecycle,
  "ARCHIVED",
)

assert.equal(
  store
    .snapshot()
    .routes.filter(
      (row) => row.code === route.code && row.lifecycle === "ACTIVE",
    ).length,
  1,
)

service.transitionRoute(routeB.id, "APPLY")

assert.equal(
  store
    .snapshot()
    .routes.filter(
      (row) => row.product === product.id && row.lifecycle === "ACTIVE",
    ).length,
  2,
  "Multiple route codes for one product may be applied simultaneously",
)

service.transitionRoute(revised.id, "ARCHIVE")

assert.equal(
  store.snapshot().routes.find((row) => row.id === revised.id).lifecycle,
  "ARCHIVED",
)

assert.throws(() => service.transitionRoute(revised.id, "APPLY"), /bản nháp/)

const before = store.snapshot()

assert.throws(
  () =>
    service.importConfigurations("boms", [
      { ...bom, code: "IMPORT-A" },
      { ...bom, code: "IMPORT-A" },
    ]),
  /tồn tại/,
)

assert.equal(store.snapshot(), before)

assert.throws(() => store.updateRows("operations", []), /tham chiếu/)

const excel = load(resolve("src/features/process-bom/lib/excel.ts")),
  excelAll = {
    ...store.snapshot(),
    routes: [],
    boms: store.snapshot().boms.filter((row) => row.id !== bom.id),
  }

const encodedBom = await excel.encodeConfigurations(
    "boms",
    [bom],
    store.snapshot(),
  ),
  decodedBom = await excel.decodeConfigurations(encodedBom, "boms", excelAll)

assert.equal(decodedBom[0].details[0].waste, 2)

assert.equal(decodedBom[0].details[0].bom, child.id)

const encodedRoute = await excel.encodeConfigurations(
    "routes",
    [applied],
    store.snapshot(),
  ),
  decodedRoute = await excel.decodeConfigurations(encodedRoute, "routes", {
    ...store.snapshot(),
    routes: [],
  })

assert.equal(decodedRoute[0].bom, alternate.id)

assert.equal(decodedRoute[0].quantity, 20)

assert.equal(decodedRoute[0].version, "2.0")

assert.equal(
  decodedRoute[0].lifecycle,
  "DRAFT",
  "Imports never apply versions automatically",
)

assert.deepEqual(decodedRoute[0].materials, [material.id])

await assert.rejects(
  () => excel.decodeConfigurations(encodedBom, "boms", store.snapshot()),
  /tồn tại/,
)

const ExcelJS = nativeRequire("exceljs"),
  formulaBook = new ExcelJS.Workbook()
await formulaBook.xlsx.load(encodedBom)
formulaBook.getWorksheet("Data").getCell("C2").value = {
  formula: "1+1",
  result: 2,
}
await assert.rejects(() =>
  excel.decodeConfigurations(awaitFormula(), "boms", excelAll),
)

function awaitFormula() {
  return new Uint8Array([1, 2, 3]).buffer
}

const formulaBuffer = await formulaBook.xlsx.writeBuffer()
await assert.rejects(
  () => excel.decodeConfigurations(formulaBuffer, "boms", excelAll),
  /công thức/,
)

const migration = load(resolve("src/features/process-bom/lib/migration.ts"))

const stripped = {
  ...all,
  boms: [
    { ...bom, details: bom.details.map(({ waste, bom, ...line }) => line) },
    alternate,
    child,
  ],
  routes: [
    {
      id: route.id,
      code: route.code,
      name: route.name,
      status: "Hoạt động",
      product: product.id,
      details: route.details,
    },
  ],
}

const restored = migration.migrateProcessBom(stripped, {
  ...all,
  boms: [bom, alternate, child],
  routes: [route],
})

assert.equal(restored.routes[0].id, route.id)

assert.equal(restored.routes[0].bom, bom.id)

assert.equal(restored.routes[0].lifecycle, "DRAFT")

assert.equal(restored.boms.find((row) => row.id === bom.id).details[0].waste, 2)

assert.equal(
  restored.boms.find((row) => row.id === bom.id).details[0].bom,
  child.id,
)

const ambiguous = migration.migrateProcessBom(stripped)

assert.equal(
  ambiguous.routes[0].bom,
  "",
  "Do not silently guess among multiple BOMs",
)

cache.clear()

const reloaded = load(resolve("src/features/master-data/store.ts")).snapshot()

assert.equal(
  JSON.parse(browserCache.get("mes-linked-master-data-v1")).version,
  3,
)

assert.equal(
  reloaded.routes.find((row) => row.id === route.id).lifecycle,
  "ARCHIVED",
)

assert.equal(
  model.consumption(
    reloaded.routes.find((row) => row.id === route.id),
    reloaded,
  )[0].total,
  6.12,
)

const { writeFileSync, mkdirSync } = nativeRequire("node:fs")
mkdirSync(".tmp-excel", { recursive: true })
writeFileSync(".tmp-excel/bom-linked-valid.xlsx", encodedBom)
writeFileSync(".tmp-excel/route-linked-valid.xlsx", encodedRoute)

console.log(
  "PASS: Multiple BOMs/routes per product, explicit child BOMs and loss scaling, linked material consumption, draft/apply/archive lifecycle, immutable version snapshots, replacement history, atomic Excel import, legacy recovery and persistence",
)
