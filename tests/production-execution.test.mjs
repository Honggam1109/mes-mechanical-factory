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

  quantity: 100,

  priority: "Bình thường",

  start: "2026-11-02T06:00",

  end: "2026-11-04T06:00",

  note: "",

  plans: [
    {
      stepId: "step10",

      start: "2026-11-02T06:00",

      end: "2026-11-03T06:00",

      note: "",
    },

    {
      stepId: "step20",

      start: "2026-11-03T06:00",

      end: "2026-11-04T06:00",

      note: "",
    },
  ],
}

const execution = load(resolve("src/features/production/lib/execution.ts")),
  commands = load(resolve("src/features/production/lib/executionService.ts"))

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

const order = service.saveOrder(input, actor),
  works = service.releaseOrder(order.id, actor),
  [first, second] = works

service.assignStation(first.id, "stationA", actor)

service.assignStation(second.id, "stationB", actor)

const a = service.saveAssignment(
  {
    workOrderId: first.id,

    employeeId: "empA",

    shiftId: "shift1",

    date: "2026-11-02",

    note: "",
  },

  actor,
)

service.saveAssignment(
  {
    workOrderId: first.id,

    employeeId: "empB",

    shiftId: "shift2",

    date: "2026-11-02",

    note: "",
  },

  actor,
)

service.saveAssignment(
  {
    workOrderId: second.id,

    employeeId: "empA",

    shiftId: "shift1",

    date: "2026-11-03",

    note: "",
  },

  actor,
)

const RealDate = Date

let clock = "2026-11-02T05:59:00"

globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [clock]))
  }

  static now() {
    return new RealDate(clock).getTime()
  }
}

const send = (work, kind, values = {}, user = actor) =>
  commands.executeWork(
    {
      workOrderId: work.id,

      stationId:
        work.stationId || (work.id === first.id ? "stationA" : "stationB"),

      kind,

      ...values,
    },

    user,
  )

const currentFirst = () =>
  model

    .productionState(store.snapshot())

    .workOrders.find((row) => row.id === first.id)

const currentSecond = () =>
  model

    .productionState(store.snapshot())

    .workOrders.find((row) => row.id === second.id)

try {
  assert.equal(
    execution.executionStatus(currentFirst(), store.snapshot()),

    "NOT_DUE",
  )

  assert.throws(() => send(currentFirst(), "START"), /nhân viên|thời gian/)

  clock = "2026-11-02T06:00:00"

  assert.equal(
    execution.executionStatus(currentFirst(), store.snapshot()),

    "READY",
  )

  assert.throws(
    () =>
      send(currentFirst(), "START", {}, {
        ...actor,

        permissions: { PRODUCTION_EXECUTION: ["VIEW"] },
      }),

    /quyền/,
  )

  assert.throws(
    () => send(currentFirst(), "START", { stationId: "stationB" }),

    /Trạm|nhân viên/,
  )

  assert.throws(
    () =>
      send(currentFirst(), "START", {}, {
        ...actor,
        dataScopes: {
          ...actor.dataScopes,
          "PRODUCTION_EXECUTION:WRITE": undefined,
        },
      }),
    /quyền/,
  )

  const beforeStart = store.snapshot()

  failStorage = true

  assert.throws(() => send(currentFirst(), "START"), /Storage full/)

  assert.equal(store.snapshot(), beforeStart)

  failStorage = false

  send(currentFirst(), "START")

  assert.equal(
    model

      .productionState(store.snapshot())

      .productionOrders.find((row) => row.id === order.id).status,

    "IN_PROGRESS",
  )

  assert.throws(() => send(currentFirst(), "START"), /phân|bắt đầu/)

  for (const quantity of [0, -1, NaN, Infinity])
    assert.throws(() => send(currentFirst(), "REPORT", { quantity }), /lớn hơn/)

  send(currentFirst(), "REPORT", { quantity: 20, note: "Lần 1" })

  send(currentFirst(), "REPORT", { quantity: 30 })

  assert.equal(model.workActuals(first.id, store.snapshot()).quantity, 50)

  assert.equal(model.workActuals(first.id, store.snapshot()).good, 0)

  assert.equal(model.workActuals(first.id, store.snapshot()).ng, 0)

  assert.throws(
    () => send(currentFirst(), "PAUSE", { reasonId: "missing" }),

    /nguyên nhân/,
  )

  assert.throws(
    () =>
      send(currentFirst(), "PAUSE", {
        reasonId: "stop1",

        machineId: "outside",
      }),

    /thuộc Trạm/,
  )

  clock = "2026-11-03T06:00:00"

  assert.equal(
    execution.executionStatus(currentSecond(), store.snapshot()),
    "WAIT_PREVIOUS",
  )

  assert.throws(() => send(currentSecond(), "START"), /Công đoạn trước/)

  clock = "2026-11-02T07:00:00"

  send(currentFirst(), "PAUSE", { reasonId: "stop1", note: "Bảo trì" })

  assert.equal(model.workStatus(currentFirst(), store.snapshot()), "PAUSED")

  assert.throws(
    () => send(currentFirst(), "REPORT", { quantity: 1 }),

    /Đang thực hiện/,
  )

  assert.throws(
    () => send(currentFirst(), "COMPLETE", { note: "Thiếu" }),

    /Đang thực hiện/,
  )

  clock = "2026-11-02T07:15:00"

  send(currentFirst(), "RESUME")

  const stop = execution.stopSessions(first.id, store.snapshot())[0]

  assert.equal((model.stamp(stop.end) - model.stamp(stop.at)) / 60000, 15)

  assert.equal(stop.reasonName, "Bảo trì định kỳ")

  assert.throws(() => send(currentFirst(), "RESUME"), /Tạm dừng/)

  clock = "2026-11-02T14:00:00"

  assert.equal(
    execution.stationContext("stationA", store.snapshot()).assignment,

    undefined,
  )

  assert.throws(
    () => send(currentFirst(), "REPORT", { quantity: 1 }),

    /nhân viên/,
  )

  clock = "2026-11-03T01:00:00"

  const overnight = execution.stationContext("stationA", store.snapshot())

  assert.equal(overnight.assignment.date, "2026-11-02")

  assert.equal(overnight.assignment.employeeId, "empB")

  const nightEvent = send(currentFirst(), "REPORT", { quantity: 25 })

  assert.equal(nightEvent.employeeId, "empB")

  assert.equal(nightEvent.date, "2026-11-02")

  assert.equal(model.workActuals(first.id, store.snapshot()).quantity, 75)

  assert.throws(() => send(currentFirst(), "COMPLETE"), /lý do/)

  send(currentFirst(), "COMPLETE", {
    note: "Kết thúc thiếu 25, vật tư chưa đủ",
  })

  assert.throws(
    () => send(currentFirst(), "REPORT", { quantity: 1 }),

    /kết thúc|Đang thực hiện/,
  )

  assert.equal(model.workStatus(currentFirst(), store.snapshot()), "COMPLETED")

  clock = "2026-11-03T06:00:00"

  assert.equal(
    execution.executionStatus(currentSecond(), store.snapshot()),

    "READY",
  )

  send(currentSecond(), "START")

  send(currentSecond(), "REPORT", { quantity: 110 })

  send(currentSecond(), "COMPLETE")

  const final = model

    .productionState(store.snapshot())

    .productionOrders.find((row) => row.id === order.id)

  assert.equal(final.status, "COMPLETED")

  assert.equal(
    model.orderActuals(final, store.snapshot()).quantity,

    110,

    "MO takes last step only",
  )

  assert.throws(
    () => service.assignStation(second.id, "stationA", actor, true),

    /thực thi/,
  )

  const before = store.snapshot()

  assert.throws(
    () =>
      store.commitProduction((state) => ({
        ...state,

        productionExecutions: state.productionExecutions.slice(1),
      })),

    /sửa.xóa/,
  )

  assert.equal(store.snapshot(), before)
} finally {
  globalThis.Date = RealDate
}

console.log(
  "PASS: execution permissions, planned start, assigned station/current shift, midnight attribution, positive repeated quantity without quality, pause/resume and stop duration, shortage reason, immutable logs, automatic MO completion",
)
