import assert from "node:assert/strict"

import { readFileSync, existsSync } from "node:fs"

import { resolve, dirname } from "node:path"

import { createRequire } from "node:module"

import { runInThisContext } from "node:vm"

import ts from "typescript"

const nativeRequire = createRequire(import.meta.url),
  cache = new Map(),
  saved = new Map()

let failStorage = false

const browser = {
  localStorage: {
    getItem: (key) => saved.get(key) || null,

    setItem: (key, value) => {
      if (failStorage) throw new Error("Storage full")

      saved.set(key, value)
    },
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

  const require = (name) =>
    name.startsWith(".")
      ? load(
          [".ts", ".tsx"]

            .map((ext) => resolve(dirname(file), name) + ext)

            .find(existsSync),
        )
      : nativeRequire(name)

  runInThisContext("(function(require,module,exports,window){" + code + "\n})")(
    require,

    module,

    module.exports,

    browser,
  )

  return module.exports
}

const store = load(resolve("src/features/master-data/store.ts")),
  bom = load(resolve("src/features/process-bom/lib/service.ts")),
  service = load(resolve("src/features/production/lib/service.ts")),
  model = load(resolve("src/features/production/lib/model.ts")),
  access = load(resolve("src/features/production/lib/access.ts")),
  filters = load(resolve("src/features/production/lib/filters.ts"))

const resource = "PRODUCTION_ORDER",
  assignment = "PRODUCTION_ASSIGNMENT"

const actor = {
  user: { id: "planner" },

  employee: { id: "empA", productionTeamId: "area1" },

  permissions: {
    [resource]: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "RELEASE"],

    [assignment]: ["VIEW", "ASSIGN"],
  },

  dataScopes: {
    [resource + ":VIEW"]: "ALL",

    [resource + ":WRITE"]: "ALL",

    [assignment + ":VIEW"]: "ALL",

    [assignment + ":WRITE"]: "ALL",
  },

  roles: [],
}

// Reuse the same historical scheduling scenarios through the new guarded command.

const executionCommands = load(
  resolve("src/features/production/lib/executionService.ts"),
)

actor.permissions.PRODUCTION_EXECUTION = [
  "VIEW",
  "START",
  "EXECUTE",
  "PAUSE",
  "RESUME",
  "COMPLETE",
]

actor.dataScopes["PRODUCTION_EXECUTION:VIEW"] = "ALL"

actor.dataScopes["PRODUCTION_EXECUTION:WRITE"] = "ALL"

function recordExecution(input) {
  const RealDate = Date

  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [input.at]))
    }
  }

  try {
    const work = model
      .productionState(store.snapshot())
      .workOrders.find((row) => row.id === input.workOrderId)

    return executionCommands.executeWork(
      {
        workOrderId: work.id,
        stationId: work.stationId,
        kind: input.kind,
        quantity: input.good + input.ng,
      },
      actor,
    )
  } finally {
    globalThis.Date = RealDate
  }
}

const initial = store.snapshot(),
  product = initial.products[0],
  material = initial.products[4]

store.updateRows("employees", [
  {
    id: "empA",

    code: "EMP-A",

    name: "Nhân viên A",

    productionUnitId: "area1",

    status: "Hoạt động",
  },

  {
    id: "empB",

    code: "EMP-B",

    name: "Nhân viên B",

    productionUnitId: "area1",

    status: "Hoạt động",
  },

  {
    id: "empC",

    code: "EMP-C",

    name: "Nhân viên C",

    productionUnitId: "dept1",

    status: "Hoạt động",
  },

  {
    id: "empOff",

    code: "EMP-OFF",

    name: "Đã nghỉ",

    productionUnitId: "area1",

    status: "Không hoạt động",
  },
])

store.updateRows("machines", [
  ...initial.machines,

  { ...initial.machines[0], id: "mch2", code: "MCH-002", name: "Máy hai" },
])

store.updateRows("stations", [
  {
    id: "stationA",

    code: "ST-A",

    name: "Trạm A",

    status: "Hoạt động",

    productionUnit: "area1",

    machineIds: ["mch1"],
  },

  {
    id: "stationB",

    code: "ST-B",

    name: "Trạm B",

    status: "Hoạt động",

    productionUnit: "area1",

    machineIds: ["mch2"],
  },
])

const definition = bom.saveBom({
  id: "new",

  product: product.id,

  quantity: 1,

  status: "Hoạt động",

  description: "BOM kiểm thử",

  details: [{ material: material.id, quantity: 2, waste: 5, note: "Vật tư" }],
})

const route = bom.saveRoute({
  id: "new",

  name: "Gia công hai bước",

  bom: definition.id,

  quantity: 1,

  status: "Hoạt động",

  operation: "op1",

  productionUnit: "area1",

  materials: [material.id],

  details: [
    { stepId: "step10", order: 10, operation: "op1", note: "" },

    { stepId: "step20", order: 20, operation: "op1", note: "" },
  ],
})

bom.transitionRoute(route.id, "APPLY")

const input = {
  productId: product.id,

  routeId: route.id,

  quantity: 500,

  priority: "Bình thường",

  start: "2026-11-02T06:00",

  end: "2026-11-04T06:00",

  note: "Kế hoạch",

  plans: [
    {
      stepId: "step10",

      start: "2026-11-02T06:00",

      end: "2026-11-03T06:00",

      note: "Bước đầu",
    },

    {
      stepId: "step20",

      start: "2026-11-03T06:00",

      end: "2026-11-04T06:00",

      note: "Bước cuối",
    },
  ],
}

const before = store.snapshot()

assert.throws(
  () => service.saveOrder({ ...input, quantity: 0 }, actor),

  /lớn hơn 0/,
)

assert.throws(
  () => service.saveOrder({ ...input, productId: material.id }, actor),

  /đúng sản phẩm/,
)

assert.throws(
  () => service.saveOrder({ ...input, plans: [input.plans[0]] }, actor),

  /toàn bộ/,
)

assert.throws(
  () =>
    service.saveOrder(
      {
        ...input,

        plans: [
          input.plans[0],

          { ...input.plans[1], start: "2026-11-03T05:00" },
        ],
      },

      actor,
    ),

  /công đoạn trước/,
)

assert.throws(
  () =>
    service.saveOrder(
      {
        ...input,

        plans: [
          { ...input.plans[0], start: "2026-11-02T05:00" },

          input.plans[1],
        ],
      },

      actor,
    ),

  /nằm trong/,
)

assert.throws(
  () => service.saveOrder({ ...input, end: input.start }, actor),

  /kết thúc/,
)

assert.equal(store.snapshot(), before)

const order = service.saveOrder(
  { ...input, code: "TAMPER", status: "COMPLETED" },

  actor,
)

assert.equal(order.code, "MO-0001")

assert.equal(order.status, "DRAFT")

assert.equal(
  model.orderSource(order, store.snapshot()).materials[0].required,

  1000,
)

assert.equal(
  model.orderSource(order, store.snapshot()).materials[0].total,

  1050,
)

assert.equal(model.orderSource(order, store.snapshot()).steps[0].order, 10)

const works = service.releaseOrder(order.id, actor)

assert.equal(works.length, 2)

assert.equal(new Set(works.map((work) => work.id)).size, 2)

assert.deepEqual(
  works.map((work) => work.code),

  ["WO-0001", "WO-0002"],
)

assert.equal(
  model.productionState(store.snapshot()).productionOrders[0].status,

  "RELEASED",
)

assert.equal(model.workStatus(works[0], store.snapshot()), "UNASSIGNED")

const releasedState = store.snapshot()

assert.throws(() => service.releaseOrder(order.id, actor), /đã phát hành/)

assert.equal(store.snapshot(), releasedState)

assert.throws(
  () => service.saveOrder({ ...input, quantity: 100 }, actor, order.id),

  /Nháp/,
)

assert.throws(() => service.deleteOrder(order.id, actor), /Nháp/)

assert.throws(
  () =>
    store.commitProduction((state) => ({
      ...state,

      productionOrders: state.productionOrders.map((row) =>
        row.id === order.id ? { ...row, quantity: 9 } : row,
      ),
    })),

  /không được sửa/,
)

assert.ok(store.isReferenced("routes", route.id))

assert.ok(store.isReferenced("boms", definition.id))

bom.saveBom(
  {
    ...definition,

    details: [
      { material: material.id, quantity: 99, waste: 0, note: "Changed" },
    ],
  },

  definition.id,
)

assert.equal(
  model.orderSource(
    model.productionState(store.snapshot()).productionOrders[0],

    store.snapshot(),
  ).materials[0].required,

  1000,
)

assert.equal(
  model.orderSource(
    model.productionState(store.snapshot()).productionOrders[0],

    store.snapshot(),
  ).steps[1].start,

  "2026-11-03T06:00",
)

assert.throws(
  () =>
    service.saveAssignment(
      {
        workOrderId: works[0].id,

        employeeId: "empA",

        shiftId: "shift1",

        date: "2026-11-02",

        note: "",
      },

      actor,
    ),

  /Trạm/,
)

service.assignStation(works[0].id, "stationA", actor)

let first = model

  .productionState(store.snapshot())

  .workOrders.find((work) => work.id === works[0].id)

assert.equal(
  model.workContext(first, store.snapshot()).station.productionUnit,

  "area1",
)

assert.equal(model.workStatus(first, store.snapshot()), "UNASSIGNED")

const day = {
  workOrderId: first.id,

  employeeId: "empA",

  shiftId: "shift1",

  date: "2026-11-02",

  quantity: 250,

  note: "Ca ngày",
}

const a1 = service.saveAssignment(day, actor)

const a2 = service.saveAssignment(
  { ...day, employeeId: "empB", shiftId: "shift2", note: "Ca đêm" },

  actor,
)

assert.equal(model.workStatus(first, store.snapshot()), "ASSIGNED")

assert.equal(
  model.shiftInterval("2026-11-02", { start: "22:00", end: "06:00" }).end,

  new Date("2026-11-03T06:00").getTime(),
)

assert.throws(
  () => service.saveAssignment({ ...day, employeeId: "empB" }, actor),

  /đã có phân công|nhân viên khác/,
)

assert.throws(
  () =>
    service.saveAssignment(
      { ...day, date: "2026-11-03", shiftId: "shift2" },

      actor,
    ),

  /Toàn bộ ca/,
)

assert.throws(
  () => service.saveAssignment({ ...day, date: "2026-02-30" }, actor),

  /Toàn bộ ca/,
)

assert.throws(
  () => service.saveAssignment({ ...day, employeeId: "empC" }, actor),

  /cùng đơn vị/,
)

assert.throws(
  () => service.saveAssignment({ ...day, employeeId: "empOff" }, actor),

  /đang làm việc/,
)

assert.throws(
  () => service.saveAssignment({ ...day, quantity: -1 }, actor),

  /Sản lượng giao/,
)

const other = service.saveOrder(input, actor),
  otherWorks = service.releaseOrder(other.id, actor)

service.assignStation(otherWorks[0].id, "stationA", actor)

assert.throws(
  () =>
    service.saveAssignment(
      { ...day, workOrderId: otherWorks[0].id, employeeId: "empB" },

      actor,
    ),

  /nhân viên khác/,
)

const samePerson = service.saveAssignment(
  { ...day, workOrderId: otherWorks[0].id },

  actor,
)

assert.equal(
  samePerson.employeeId,

  "empA",

  "Same person may cover another WO at the same station/day/shift; the combination still has one employee",
)

service.deleteAssignment(samePerson.id, actor)

service.assignStation(otherWorks[0].id, "stationB", actor)

assert.throws(
  () =>
    service.saveAssignment({ ...day, workOrderId: otherWorks[0].id }, actor),

  /trạm khác/,
)

const stateBeforeSwitch = store.snapshot()

assert.throws(
  () => service.assignStation(first.id, "stationB", actor),

  /xóa các phân công/,
)

assert.equal(store.snapshot(), stateBeforeSwitch)

service.assignStation(first.id, "stationB", actor, true)

assert.equal(
  model

    .productionState(store.snapshot())

    .assignments.filter((row) => row.workOrderId === first.id).length,

  0,
)

first = model

  .productionState(store.snapshot())

  .workOrders.find((work) => work.id === first.id)

assert.equal(first.stationId, "stationB")

assert.equal(model.workStatus(first, store.snapshot()), "UNASSIGNED")

const firstAssigned = service.saveAssignment(
  { ...day, employeeId: "empB" },

  actor,
)

assert.ok(store.isReferenced("stations", "stationB"))

assert.ok(store.isReferenced("employees", "empB"))

assert.ok(store.isReferenced("shifts", "shift1"))

service.assignStation(works[1].id, "stationA", actor)

const lastAssigned = service.saveAssignment(
  { ...day, workOrderId: works[1].id, date: "2026-11-03" },

  actor,
)

let second = model

  .productionState(store.snapshot())

  .workOrders.find((work) => work.id === works[1].id)

assert.equal(
  model.workStatus(second, store.snapshot()),

  "ASSIGNED",

  "Later stages can be assigned before earlier stages finish",
)

assert.ok(
  model

    .canStartWork(second, store.snapshot())

    .some((error) => error.includes("Công đoạn trước")),
)

assert.throws(
  () =>
    recordExecution({
      workOrderId: second.id,

      assignmentId: lastAssigned.id,

      kind: "START",

      at: "2026-11-03T06:00",

      good: 0,

      ng: 0,
    }),

  /Công đoạn trước/,
)

service.cancelOrder(other.id, actor)

assert.equal(
  model

    .productionState(store.snapshot())

    .productionOrders.find((row) => row.id === other.id).status,

  "CANCELLED",
)

assert.equal(
  model.workStatus(
    model

      .productionState(store.snapshot())

      .workOrders.find((row) => row.id === otherWorks[0].id),

    store.snapshot(),
  ),

  "CANCELLED",
)

assert.throws(
  () => service.assignStation(otherWorks[0].id, "stationA", actor),

  /kết thúc/,
)

recordExecution({
  workOrderId: first.id,

  assignmentId: firstAssigned.id,

  kind: "START",

  at: "2026-11-02T06:00",

  good: 0,

  ng: 0,
})

assert.equal(model.workStatus(first, store.snapshot()), "IN_PROGRESS")

assert.throws(
  () => service.assignStation(first.id, "stationA", actor, true),

  /thực thi/,
)

assert.throws(
  () => service.deleteAssignment(firstAssigned.id, actor),

  /thực thi/,
)

assert.throws(
  () =>
    service.saveAssignment(
      { ...day, employeeId: "empB" },

      actor,

      firstAssigned.id,
    ),

  /thực thi/,
)

assert.throws(() => service.cancelOrder(order.id, actor), /chưa bắt đầu/)

recordExecution({
  workOrderId: first.id,

  assignmentId: firstAssigned.id,

  kind: "REPORT",

  at: "2026-11-02T07:00",

  good: 500,

  ng: 4,
})

let liveOrder = model

  .productionState(store.snapshot())

  .productionOrders.find((row) => row.id === order.id)

assert.equal(liveOrder.status, "IN_PROGRESS")

assert.equal(
  model.orderActuals(liveOrder, store.snapshot()).good,

  0,

  "Do not count intermediate-stage outputs as finished products",
)

recordExecution({
  workOrderId: first.id,

  assignmentId: firstAssigned.id,

  kind: "COMPLETE",

  at: "2026-11-02T13:59",

  good: 0,

  ng: 0,
})

assert.throws(
  () =>
    recordExecution({
      workOrderId: second.id,

      assignmentId: lastAssigned.id,

      kind: "START",

      at: "2026-11-03T05:00",

      good: 0,

      ng: 0,
    }),

  /thời gian|nhân viên|hoàn thành thực tế/,
)

recordExecution({
  workOrderId: second.id,

  assignmentId: lastAssigned.id,

  kind: "START",

  at: "2026-11-03T06:00",

  good: 0,

  ng: 0,
})

recordExecution({
  workOrderId: second.id,

  assignmentId: lastAssigned.id,

  kind: "REPORT",

  at: "2026-11-03T07:00",

  good: 495,

  ng: 5,
})

recordExecution({
  workOrderId: second.id,

  assignmentId: lastAssigned.id,

  kind: "COMPLETE",

  at: "2026-11-03T13:59",

  good: 0,

  ng: 0,
})

liveOrder = model

  .productionState(store.snapshot())

  .productionOrders.find((row) => row.id === order.id)

assert.equal(liveOrder.status, "COMPLETED")

const actual = model.orderActuals(liveOrder, store.snapshot())

assert.equal(actual.quantity, 500)

assert.equal(actual.ng, 0)

assert.equal(model.percent(actual.quantity, liveOrder.quantity), 100)

assert.equal(actual.start, new Date("2026-11-02T06:00").toISOString())

assert.equal(actual.end, new Date("2026-11-03T13:59").toISOString())

assert.throws(
  () =>
    recordExecution({
      workOrderId: second.id,

      assignmentId: lastAssigned.id,

      kind: "REPORT",

      at: "2026-11-03T13:59",

      good: 1,

      ng: 0,
    }),

  /hoàn thành/,
)

assert.equal(
  filters.filterOrders(
    model.productionState(store.snapshot()).productionOrders,

    { keyword: "mo-0001", from: "2026-11-02", to: "2026-11-02" },

    store.snapshot(),
  ).length,

  1,
)

assert.equal(
  filters.filterOrders(
    model.productionState(store.snapshot()).productionOrders,

    { from: "2026-11-03" },

    store.snapshot(),
  ).length,

  0,
)

assert.equal(
  filters.filterWorks(
    model.productionState(store.snapshot()).workOrders,

    { keyword: product.name, status: "COMPLETED" },

    store.snapshot(),
  ).length,

  2,
)

const viewer = {
  ...actor,

  user: { id: "viewer" },

  permissions: { [resource]: ["VIEW"], [assignment]: ["VIEW"] },
}

assert.throws(() => service.saveOrder(input, viewer), /quyền/)

assert.throws(
  () => service.assignStation(second.id, "stationA", viewer),

  /quyền/,
)

const self = {
  ...actor,

  user: { id: "other" },

  employee: { id: "empA" },

  dataScopes: {
    ...actor.dataScopes,

    [assignment + ":VIEW"]: "SELF",

    [assignment + ":WRITE"]: "SELF",
  },
}

assert.equal(
  access.inScope(self, assignment, "VIEW", first, store.snapshot()),

  false,
)

assert.equal(
  access.inScope(self, assignment, "VIEW", second, store.snapshot()),

  true,
)

assert.equal(
  access.inScope(
    { ...self, dataScopes: {} },

    assignment,

    "VIEW",

    second,

    store.snapshot(),
  ),

  false,
)

const draft = service.saveOrder(input, actor),
  beforeStorageFailure = store.snapshot()

failStorage = true

assert.throws(() => service.releaseOrder(draft.id, actor), /Storage full/)

assert.equal(
  store.snapshot(),

  beforeStorageFailure,

  "Storage failure must not publish order or partially create WOs",
)

failStorage = false

service.deleteOrder(draft.id, actor)

const excel = load(resolve("src/features/production/lib/excel.ts")),
  buffer = await excel.encodeOrders([liveOrder], store.snapshot()),
  ExcelJS = nativeRequire("exceljs"),
  book = new ExcelJS.Workbook()

await book.xlsx.load(buffer)

assert.equal(book.worksheets[0].getCell("L2").value, 500)

assert.equal(book.worksheets[0].getCell("M2").value, 100)

cache.clear()

const reloaded = load(resolve("src/features/master-data/store.ts")).snapshot(),
  newModel = load(resolve("src/features/production/lib/model.ts"))

const persisted = newModel

  .productionState(reloaded)

  .productionOrders.find((row) => row.id === order.id)

assert.equal(persisted.status, "COMPLETED")

assert.equal(newModel.orderActuals(persisted, reloaded).quantity, 500)

assert.equal(persisted.sourceSnapshot.materials[0].required, 1000)

assert.equal(newModel.productionState(reloaded).workOrders.length, 4)

console.log(
  "PASS: MO validation and atomic release, frozen BOM/stage plans, one WO per step, station/personnel constraints, overnight shifts, reassignment rollback, cancellation, execution boundary and final-stage totals, scopes, exports and persistence",
)

