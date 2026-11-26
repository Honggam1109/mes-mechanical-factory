import { randomUUID } from "node:crypto"
import { createDomain } from "./domain-loader.mjs"
import { seedProductionHistory } from "./production-history.mjs"

const productionKeys = [
  "productionOrders",
  "workOrders",
  "assignments",
  "productionExecutions",
]
const resources = [
  "PRODUCTION_ORDER",
  "PRODUCTION_ASSIGNMENT",
  "PRODUCTION_EXECUTION",
  "PRODUCTION_MONITOR",
]
const reject = (message, status = 400) => {
  throw Object.assign(new Error(message), { status })
}
export const isAdministrator = (auth) =>
  ["SYSTEM_USER", "SYSTEM_ROLE"].every((resource) =>
    auth.permissions[resource]?.includes("UPDATE"),
  ) && auth.dataScopes["SYSTEM_USER:WRITE"] === "ALL"

export function createProduction(db, effective) {
  const domain = createDomain()
  const { store, service, execution, access } = domain
  db.exec(
    "CREATE TABLE IF NOT EXISTS production_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS production_receipts (user_id TEXT, request_id TEXT, result TEXT NOT NULL, PRIMARY KEY(user_id,request_id));",
  )
  if (!db.prepare("SELECT 1 FROM production_state WHERE id=1").get()) {
    db.prepare("INSERT INTO production_state VALUES (1,0,?)").run(
      JSON.stringify(store.snapshot()),
    )
  }
  function hydrate() {
    const saved = db.prepare("SELECT * FROM production_state WHERE id=1").get()
    const data = JSON.parse(saved.document)
    data.employees = db
      .prepare("SELECT document FROM employees")
      .all()
      .map(({ document }) => {
        const row = JSON.parse(document)
        return {
          ...row,
          name: row.fullName,
          productionUnitId:
            row.productionUnitId || row.productionTeamId || row.department,
          status: row.status === "ACTIVE" ? "Hoạt động" : "Không hoạt động",
        }
      })
    store.replaceSharedSnapshot(data)
    return saved.revision
  }
  function persist(revision) {
    const data = { ...store.snapshot() }
    delete data.employees
    db.prepare(
      "UPDATE production_state SET revision=?,document=? WHERE id=1",
    ).run(revision + 1, JSON.stringify(data))
  }
  function snapshot(auth) {
    const revision = hydrate()
    const all = store.snapshot()
    if (isAdministrator(auth)) return { revision, data: all }
    const permitted = resources.filter((resource) =>
      access.hasAction(auth, resource, "VIEW"),
    )
    if (!permitted.length) reject("Không có quyền truy cập sản xuất.", 403)
    const visible = (record) =>
      permitted.some((resource) =>
        access.inScope(auth, resource, "VIEW", record, all),
      )
    const orders = all.productionOrders.filter(visible)
    const work = all.workOrders.filter(visible)
    const workIds = new Set(work.map((row) => row.id))
    const employeeScope = auth.employee?.productionTeamId
    const global = permitted.some(
      (resource) => auth.dataScopes[`${resource}:VIEW`] === "ALL",
    )
    const self = permitted.every(
      (resource) => auth.dataScopes[`${resource}:VIEW`] === "SELF",
    )
    return {
      revision,
      data: {
        ...all,
        productionOrders: orders,
        workOrders: work,
        assignments: all.assignments.filter(
          (row) =>
            workIds.has(row.workOrderId) &&
            (!self || row.employeeId === auth.employee?.id),
        ),
        productionExecutions: all.productionExecutions.filter((row) =>
          workIds.has(row.workOrderId),
        ),
        employees: all.employees.filter(
          (row) =>
            global ||
            (self
              ? row.id === auth.employee?.id
              : row.productionUnitId === employeeScope),
        ),
        stations: all.stations.filter(
          (row) => global || row.productionUnit === employeeScope,
        ),
        machines: all.machines.filter(
          (row) => global || row.productionUnit === employeeScope,
        ),
        productionUnits: all.productionUnits.filter(
          (row) => global || row.id === employeeScope,
        ),
      },
    }
  }
  function mutate(auth, body) {
    if (typeof body.requestId !== "string" || body.requestId.length > 100)
      reject("Thiếu mã giao dịch.")
    const receipt = db
      .prepare(
        "SELECT result FROM production_receipts WHERE user_id=? AND request_id=?",
      )
      .get(auth.user.id, body.requestId)
    if (receipt) return JSON.parse(receipt.result)
    db.exec("BEGIN IMMEDIATE")
    try {
      const revision = hydrate()
      if (body.revision !== revision)
        reject(
          "Dữ liệu đã thay đổi. Đã tải lại; vui lòng kiểm tra và thử lại.",
          409,
        )
      const args = body.args || []
      let result
      switch (body.command) {
        case "saveOrder":
          result = service.saveOrder(args[0], auth, args[1])
          break
        case "releaseOrder":
          result = service.releaseOrder(args[0], auth)
          break
        case "cancelOrder":
          result = service.cancelOrder(args[0], auth)
          break
        case "deleteOrder":
          result = service.deleteOrder(args[0], auth)
          break
        case "assignStation":
          result = service.assignStation(args[0], args[1], auth, args[2])
          break
        case "saveAssignment":
          result = service.saveAssignment(args[0], auth, args[1])
          break
        case "deleteAssignment":
          result = service.deleteAssignment(args[0], auth)
          break
        case "executeWork":
          result = execution.executeWork(args[0], auth)
          break
        case "prepareDemo":
          if (!isAdministrator(auth))
            reject("Chỉ quản trị viên được chuẩn bị demo.", 403)
          result = prepareDemo(domain, auth, args[0] === true)
          break
        case "prepareHistory": {
          if (!isAdministrator(auth))
            reject("Chỉ quản trị viên được thêm lịch sử demo.", 403)
          const actor = (username) => {
            const row = db
              .prepare("SELECT id FROM users WHERE username=?")
              .get(username)
            return row && effective?.(row.id)
          }
          result = seedProductionHistory(domain, {
            planner: actor("kehoach"),
            leader: actor("totruong"),
            worker: actor("thucthi"),
          })
          break
        }
        case "updateCatalog": {
          if (!isAdministrator(auth))
            reject("Chỉ quản trị viên được sửa dữ liệu gốc.", 403)
          const [entity, rows] = args
          if (
            productionKeys.includes(entity) ||
            entity === "employees" ||
            !(entity in store.snapshot()) ||
            !Array.isArray(rows)
          )
            reject("Danh mục không hợp lệ.")
          store.updateRows(entity, rows)
          break
        }
        default:
          reject("Thao tác không hợp lệ.")
      }
      persist(revision)
      const response = { result: result ?? null, revision: revision + 1 }
      db.prepare("INSERT INTO production_receipts VALUES (?,?,?)").run(
        auth.user.id,
        body.requestId,
        JSON.stringify(response),
      )
      db.prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)").run(
        randomUUID(),
        auth.user.id,
        `PRODUCTION:${body.command}`,
        String(result?.id || args[0]?.workOrderId || args[0] || ""),
        new Date().toISOString(),
      )
      db.exec("COMMIT")
      return response
    } catch (error) {
      db.exec("ROLLBACK")
      hydrate()
      if (!error.status)
        error.status = /quyền|phạm vi/.test(error.message) ? 403 : 400
      throw error
    }
  }
  return { snapshot, mutate, domain }
}

// Shaft machining demo: operation, machine and station share one index (1-6).
const demoSteps = [
  ["demo-cut", "Cắt phôi", "Máy cưa vòng"],
  ["demo-turn", "Tiện", "Máy tiện CNC"],
  ["demo-mill", "Phay rãnh then", "Máy phay đứng"],
  ["demo-heat", "Nhiệt luyện", "Lò nhiệt luyện"],
  ["demo-grind", "Mài", "Máy mài tròn ngoài"],
  ["demo-qc", "KCS", "Bàn đo kiểm"],
]

function prepareDemo({ store, bom, service, model }, auth, createDraft) {
  const all = store.snapshot()
  const row = (id, code, name, extra = {}) => ({
    id,
    code,
    name,
    status: "Hoạt động",
    description: "",
    ...extra,
  })
  const ensure = (entity, rows) => {
    const current = store.snapshot()[entity] || []
    const missing = rows.filter(
      (row) => !current.some((old) => old.id === row.id),
    )
    if (missing.length) store.updateRows(entity, [...current, ...missing])
  }
  ensure("productionUnits", [
    row("demo-team-a", "TO-DEMO-A", "Tổ gia công cơ khí A"),
    row("demo-team-b", "TO-DEMO-B", "Tổ sản xuất B"),
  ])
  const unitOf = (name) => {
    const unit =
      all.units.find(
        (row) => row.status === "Hoạt động" && row.name === name,
      ) || all.units.find((row) => row.status === "Hoạt động")
    return unit?.label || unit?.name || "Cái"
  }
  ensure("products", [
    row("demo-product", "TP-DEMO-01", "Trục truyền động", {
      unit: unitOf("CAI"),
      category: "Thành phẩm",
    }),
    row("demo-body", "VT-DEMO-01", "Thép tròn C45", {
      unit: unitOf("KG"),
      category: "Linh kiện / Vật tư",
    }),
    row("demo-oil", "VT-DEMO-02", "Dầu cắt gọt", {
      unit: unitOf("LIT"),
      category: "Linh kiện / Vật tư",
    }),
  ])
  ensure("operations", [
    ...demoSteps.map(([id, name], index) =>
      row(id, `CD-DEMO-0${index + 1}`, name, {
        productionUnitIds: ["demo-team-a"],
      }),
    ),
    row("demo-other", "CD-DEMO-B", "Hàn kết cấu", {
      productionUnitIds: ["demo-team-b"],
    }),
  ])
  ensure(
    "machines",
    demoSteps.map(([, , machine], index) =>
      row(`demo-machine-${index + 1}`, `MAY-DEMO-0${index + 1}`, machine, {
        productionUnit: "demo-team-a",
      }),
    ),
  )
  ensure(
    "stations",
    demoSteps.map(([, name], index) =>
      row(
        `demo-station-${index + 1}`,
        `TR-DEMO-0${index + 1}`,
        `Trạm ${name === "KCS" ? name : name.toLowerCase()}`,
        {
          productionUnit: "demo-team-a",
          machineIds: [`demo-machine-${index + 1}`],
        },
      ),
    ),
  )
  ensure("shifts", [
    row("demo-shift-day", "CA-DEMO-01", "Ca demo ban ngày", {
      start: "06:00",
      end: "18:00",
      breakMinutes: 0,
    }),
    row("demo-shift-night", "CA-DEMO-02", "Ca demo ban đêm", {
      start: "18:00",
      end: "06:00",
      breakMinutes: 0,
    }),
  ])
  ensure(
    "stops",
    [
      ["demo-stop", "Chờ phôi", "Ngoài kế hoạch"],
      ["demo-stop-tool", "Thay dao", "Kế hoạch"],
      ["demo-stop-fixture", "Chỉnh gá", "Kế hoạch"],
      ["demo-stop-breakdown", "Hỏng máy", "Ngoài kế hoạch"],
    ].map(([id, name, group], index) =>
      row(id, `DUNG-DEMO-0${index + 1}`, name, {
        group,
        countDowntime: true,
      }),
    ),
  )
  let material = store
    .snapshot()
    .boms.find((row) => row.description === "demo-mo-bom")
  if (!material)
    material = bom.saveBom(
      row("", "", "BOM demo", {
        product: "demo-product",
        quantity: 1,
        description: "demo-mo-bom",
        details: [
          { material: "demo-body", quantity: 2.5, waste: 0 },
          { material: "demo-oil", quantity: 0.05, waste: 0 },
        ],
      }),
    )
  let route = store
    .snapshot()
    .routes.find((row) => row.description === "demo-mo-route")
  if (!route) {
    route = bom.saveRoute(
      row("", "", "Gia công trục truyền động", {
        bom: material.id,
        quantity: 1,
        description: "demo-mo-route",
        productionUnit: "demo-team-a",
        details: demoSteps.map(([operation], index) => ({
          stepId: `demo-step-${index + 1}`,
          order: (index + 1) * 10,
          operation,
        })),
      }),
    )
    bom.transitionRoute(route.id, "APPLY")
  }
  const now = new Date()
  const shift = store
    .snapshot()
    .shifts.find(
      (row) =>
        row.id ===
        (now.getHours() >= 6 && now.getHours() < 18
          ? "demo-shift-day"
          : "demo-shift-night"),
    )
  const day = new Date(now)
  if (now.getHours() < 6) day.setDate(day.getDate() - 1)
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
  const interval = model.shiftInterval(date, shift)
  const start = Math.max(
    interval.start,
    Math.floor((now.getTime() - 10 * 60000) / 60000) * 60000,
  )
  const end = interval.end
  const boundary = (index) =>
    new Date(
      index === demoSteps.length
        ? end
        : Math.floor(
            (start + ((end - start) * index) / demoSteps.length) / 60000,
          ) * 60000,
    ).toISOString()
  const plans = demoSteps.map((_, index) => ({
    stepId: `demo-step-${index + 1}`,
    start: boundary(index),
    end: boundary(index + 1),
    note: "",
  }))
  if (
    !store
      .snapshot()
      .productionOrders.some((row) => row.note === "demo-out-of-scope")
  ) {
    let otherRoute = store
      .snapshot()
      .routes.find((row) => row.description === "demo-mo-route-b")
    if (!otherRoute) {
      otherRoute = bom.saveRoute(
        row("", "", "Quy trình tổ B", {
          bom: material.id,
          description: "demo-mo-route-b",
          productionUnit: "demo-team-b",
          details: [
            { stepId: "demo-step-b", order: 10, operation: "demo-other" },
          ],
        }),
      )
      bom.transitionRoute(otherRoute.id, "APPLY")
    }
    const other = service.saveOrder(
      {
        productId: "demo-product",
        routeId: otherRoute.id,
        quantity: 50,
        priority: "Bình thường",
        start: plans[0].start,
        end: plans.at(-1).end,
        plans: [
          {
            stepId: "demo-step-b",
            start: plans[0].start,
            end: plans.at(-1).end,
            note: "",
          },
        ],
        note: "demo-out-of-scope",
      },
      auth,
    )
    service.releaseOrder(other.id, auth)
  }
  if (!createDraft)
    return {
      productId: "demo-product",
      routeId: route.id,
      date,
      shiftId: shift.id,
      plans,
    }
  // A fresh draft only; the planner still demonstrates saving/releasing and the leader assigns it.
  return service.saveOrder(
    {
      productId: "demo-product",
      routeId: route.id,
      quantity: 100,
      priority: "Bình thường",
      start: plans[0].start,
      end: plans.at(-1).end,
      plans,
      note: `Demo 100 trục · ${now.toLocaleString("vi-VN")}`,
    },
    auth,
  )
}
