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
  seed = load(resolve("src/features/production/lib/sampleData.ts")),
  model = load(resolve("src/features/production/lib/model.ts")),
  monitor = load(resolve("src/features/production/lib/monitor.ts")),
  commands = load(resolve("src/features/production/lib/executionService.ts"))

const auth = {
  user: { id: "production-manager" },

  employee: { id: "employee0", productionTeamId: "dept1" },

  roles: [],

  permissions: {
    PRODUCTION_ORDER: [
      "VIEW",

      "CREATE",

      "UPDATE",

      "DELETE",

      "EXPORT",

      "RELEASE",
    ],

    PRODUCTION_ASSIGNMENT: ["VIEW", "ASSIGN"],

    PRODUCTION_EXECUTION: [
      "VIEW",

      "START",

      "EXECUTE",

      "PAUSE",

      "RESUME",

      "COMPLETE",
    ],

    PRODUCTION_MONITOR: ["VIEW"],
  },

  dataScopes: {},
}

for (const resource of Object.keys(auth.permissions)) {
  auth.dataScopes[`${resource}:VIEW`] = "ALL"

  auth.dataScopes[`${resource}:WRITE`] = "ALL"
}

store.updateRows(
  "employees",

  seed.sampleEmployeeCodes.map((code, i) => ({
    id: `employee${i}`,

    code,

    name: `Nhân viên ${i}`,

    productionUnitId: "dept1",

    status: "Hoạt động",
  })),
)

const RealDate = Date,
  clock = "2026-11-01T09:00:00"

globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [clock]))
  }

  static now() {
    return new RealDate(clock).getTime()
  }
}

try {
  assert.equal(seed.seedProductionData(auth), true)

  assert.equal(
    seed.seedProductionData(auth),

    false,

    "No duplicates on repeated refresh",
  )

  const all = store.snapshot(),
    state = model.productionState(all),
    rows = monitor.monitorStations("dept1", all, auth, new Date())

  assert.equal(state.productionOrders.length, 10)

  assert.equal(state.workOrders.length, 24)

  assert.equal(state.assignments.length, 24)

  assert.equal(rows.length, 9)

  assert.equal(rows[0].status, "PAUSED", "Pause precedes overdue and running")

  const paused = rows.find((row) => row.status === "PAUSED"),
    running = rows.find((row) => row.station.code === "ST-SX-01"),
    overdue = rows.find((row) => row.station.code === "ST-SX-04")

  assert.equal(running.status, "IN_PROGRESS")

  assert.equal(overdue.status, "OVERDUE")

  assert.equal(overdue.current.assignment.employeeId, "employee3")

  assert.ok(rows.some((row) => row.status === "WAIT_PREVIOUS"))

  assert.ok(rows.some((row) => row.status === "READY"))

  assert.ok(rows.some((row) => row.status === "NOT_DUE"))

  assert.ok(rows.some((row) => row.status === "IDLE"))

  assert.equal(model.workActuals(paused.primary.id, all).quantity, 200)

  assert.equal(model.workActuals(running.primary.id, all).quantity, 250)

  assert.equal(
    monitor.filterMonitoredStations(rows, { status: "PAUSED" }, all).length,

    1,
  )

  assert.equal(
    monitor.filterMonitoredStations(rows, { status: "OVERDUE" }, all).length,

    2,
  )

  assert.equal(
    monitor.filterMonitoredStations(rows, { status: "READY" }, all).length,

    2,
  )

  assert.equal(
    monitor.filterMonitoredStations(rows, { status: "IN_PROGRESS" }, all)
      .length,

    2,
  )

  assert.equal(
    monitor.filterMonitoredStations(rows, { keyword: "  ST-SX-04  " }, all)[0]
      .station.id,

    overdue.station.id,
  )

  assert.ok(
    monitor

      .filterMonitoredStations(
        rows,

        {
          operationId: model.workContext(paused.primary, all).step.operationId,
        },

        all,
      )

      .some((row) => row.station.id === paused.station.id),
  )

  assert.equal(
    monitor.filterMonitoredStations(
      rows,

      { status: "IDLE", problems: true },

      all,
    ).length,

    0,
  )

  assert.equal(
    monitor.filterMonitoredStations(rows, { problems: true }, all).length,

    3,
  )

  const finished = state.productionOrders.find(
    (order) => order.status === "COMPLETED",
  )

  assert.equal(model.orderActuals(finished, all).quantity, 240)

  assert.equal(
    state.productionExecutions.filter((event) => event.good || event.ng).length,

    0,
  )

  assert.ok(state.productionExecutions.some((event) => event.kind === "RESUME"))

  const readOnly = { ...auth, permissions: { PRODUCTION_MONITOR: ["VIEW"] } }

  assert.equal(
    monitor.monitorStations("dept1", all, readOnly, new Date()).length,

    9,
  )

  assert.throws(
    () =>
      commands.executeWork(
        {
          workOrderId: running.primary.id,

          stationId: running.station.id,

          kind: "REPORT",

          quantity: 10,
        },

        readOnly,
      ),

    /quyền/,
  )

  assert.equal(
    monitor.monitorStations(
      "dept1",

      all,

      { ...auth, permissions: {} },

      new Date(),
    ).length,

    0,
  )

  assert.equal(
    monitor.monitorStations(
      "dept1",

      all,

      { ...auth, dataScopes: {} },

      new Date(),
    ).length,

    0,
  )

  const self = {
    ...auth,

    user: { id: "other" },

    employee: { id: "employee7" },

    dataScopes: { "PRODUCTION_MONITOR:VIEW": "SELF" },
  }

  assert.equal(
    monitor.monitorStations("dept1", all, self, new Date()).length,

    1,
  )

  const prior = JSON.stringify(all)

  monitor.filterMonitoredStations(rows, { problems: true }, all)

  assert.equal(
    JSON.stringify(store.snapshot()),

    prior,

    "Monitoring is read-only",
  )

  // Complete one live production path using the existing sample personnel/station.

  commands.executeWork(
    {
      workOrderId: paused.primary.id,

      stationId: paused.station.id,

      kind: "RESUME",
    },

    auth,
  )

  commands.executeWork(
    {
      workOrderId: paused.primary.id,

      stationId: paused.station.id,

      kind: "REPORT",

      quantity: 200,
    },

    auth,
  )

  commands.executeWork(
    {
      workOrderId: paused.primary.id,

      stationId: paused.station.id,

      kind: "COMPLETE",
    },

    auth,
  )

  assert.equal(model.workStatus(paused.primary, store.snapshot()), "COMPLETED")

  assert.equal(
    model

      .productionState(store.snapshot())

      .productionOrders.find((order) => order.id === paused.primary.orderId)
      .status,

    "IN_PROGRESS",

    "Final operation is still pending",
  )

  const ready = rows.find((row) => row.station.code === "ST-SX-05")

  commands.executeWork(
    {
      workOrderId: ready.primary.id,

      stationId: ready.station.id,

      kind: "START",
    },

    auth,
  )

  commands.executeWork(
    {
      workOrderId: ready.primary.id,

      stationId: ready.station.id,

      kind: "REPORT",

      quantity: 100,
    },

    auth,
  )

  assert.equal(
    monitor

      .monitorStations("dept1", store.snapshot(), auth, new Date())

      .find((row) => row.station.id === ready.station.id).status,

    "IN_PROGRESS",
  )

  const completedWork = model
    .productionState(store.snapshot())
    .workOrders.find(
      (work) => model.workStatus(work, store.snapshot()) === "COMPLETED",
    )

  assert.equal(
    monitor.monitorWorkState(
      completedWork,
      store.snapshot(),
      new Date("2027-01-01T09:00:00"),
    ),
    "COMPLETED",
    "Completed historical work is never overdue",
  )

  const external = JSON.parse(saved.get("mes-linked-master-data-v1"))

  external.data.stations[0].name = "Trạm cập nhật từ tab khác"

  saved.set("mes-linked-master-data-v1", JSON.stringify(external))

  const oldSnapshot = store.snapshot()

  store.refreshMasterData()

  assert.notEqual(store.snapshot(), oldSnapshot)

  assert.equal(store.snapshot().stations[0].name, "Trạm cập nhật từ tab khác")

  assert.equal(store.snapshot().employees.length, 8)

  const refreshed = store.snapshot()

  store.refreshMasterData()

  assert.equal(
    store.snapshot(),
    refreshed,
    "No spurious update without an external commit",
  )

  const beforeReload = JSON.stringify(model.productionState(store.snapshot()))

  cache.clear()

  const reloaded = load(
      resolve("src/features/master-data/store.ts"),
    ).snapshot(),
    reloadedModel = load(resolve("src/features/production/lib/model.ts"))

  assert.equal(
    JSON.stringify(reloadedModel.productionState(reloaded)),

    beforeReload,
  )
} finally {
  globalThis.Date = RealDate
}

console.log(
  "PASS: linked sample data, 10 MO / 24 WO / 9 stations, current-shift staff, pause/overdue priority, all filters and summary counts, read-only scopes, resume/report/complete and start/report flow, persisted state",
)
