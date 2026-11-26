import type { AuthUser } from "../../system/types"

import type { ExecutionReport, ManufacturingOrder } from "../types"

import type { RecordData } from "../../master-data/config"

import { snapshot, updateRows, commitProduction } from "../../master-data/store"

import { active, text } from "../../process-bom/lib/model"

import {
  saveBom,
  saveRoute,
  transitionRoute,
} from "../../process-bom/lib/service"

import {
  saveOrder,
  releaseOrder,
  assignStation,
  saveAssignment,
  cancelOrder,
} from "./service"

import { productionState, workActuals, workContext } from "./model"

import { hasAction, guard } from "./access"

import { localDate, validateExecutionEvent } from "./execution"

// Stable sample identities allow retries and never replace user-created records.

const prefix = "production-sample-v1",
  marker = "Lô dự phòng động cơ – tháng sản xuất",
  unitId = "dept1"

export const sampleEmployeeCodes = Array.from(
  { length: 8 },

  (_, i) => `EMP-SX-${String(i + 1).padStart(3, "0")}`,
)

export function seedProductionData(auth: AuthUser | null, now = new Date()) {
  let all = snapshot()
  const cycle = localDate(now)
  const batchNote = (name: string) => `${name} · ${cycle}`

  if (
    !auth ||
    !hasAction(auth, "PRODUCTION_ORDER", "CREATE") ||
    auth.dataScopes["PRODUCTION_ORDER:WRITE"] !== "ALL" ||
    !hasAction(auth, "PRODUCTION_ASSIGNMENT", "ASSIGN") ||
    !hasAction(auth, "PRODUCTION_EXECUTION", "EXECUTE") ||
    !hasAction(auth, "PRODUCTION_ORDER", "RELEASE") ||
    !hasAction(auth, "PRODUCTION_ORDER", "UPDATE") ||
    !(["START", "PAUSE", "RESUME", "COMPLETE"] as const).every((action) =>
      auth.permissions.PRODUCTION_EXECUTION?.includes(action),
    ) ||
    auth.dataScopes["PRODUCTION_ASSIGNMENT:WRITE"] !== "ALL" ||
    auth.dataScopes["PRODUCTION_EXECUTION:WRITE"] !== "ALL"
  )
    return false

  if (
    productionState(all).productionOrders.some((order) => order.note === batchNote(marker))
  )
    return false

  const employees = sampleEmployeeCodes.map((code) =>
    all.employees.find(
      (row) =>
        row.code === code && row.productionUnitId === unitId && active(row),
    ),
  )

  const product =
    all.products.find((row) => row.code === "FA-SHF-001" && active(row)) ||
    all.products.find((row) => row.category === "Thành phẩm" && active(row))

  const materials = all.products

    .filter(
      (row) =>
        row.id !== product?.id &&
        String(row.category).includes("Vật tư") &&
        active(row),
    )

    .slice(0, 3)

  if (
    employees.some((employee) => !employee) ||
    !product ||
    !materials.length ||
    !active(all.productionUnits.find((row) => row.id === unitId))
  )
    return false

  const add = (entity: string, records: RecordData[]) => {
    const current = snapshot()[entity] || []

    const missing = records.filter(
      (row) => !current.some((old) => old.id === row.id),
    )

    if (missing.length) updateRows(entity, [...current, ...missing])
  }

  const record = (
    id: string,

    code: string,

    name: string,

    extra: Record<string, unknown> = {},
  ): RecordData => ({
    id: `${prefix}-${id}`,

    code,

    name,

    status: "Hoạt động",

    description: "",

    ...extra,
  })

  const shiftRows = [
    record("shift-day", "SHIFT-SX-01", "Ca 1", {
      start: "06:00",

      end: "14:00",

      breakMinutes: 30,
    }),

    record("shift-evening", "SHIFT-SX-02", "Ca 2", {
      start: "14:00",

      end: "22:00",

      breakMinutes: 30,
    }),

    record("shift-night", "SHIFT-SX-03", "Ca 3", {
      start: "22:00",

      end: "06:00",

      breakMinutes: 30,

      overnight: true,
    }),
  ]

  add("shifts", shiftRows)

  const hour = now.getHours(),
    shift =
      hour >= 6 && hour < 14
        ? shiftRows[0]
        : hour >= 14 && hour < 22
          ? shiftRows[1]
          : shiftRows[2]

  const baseDate = new Date(now)

  if (hour < 6) baseDate.setDate(baseDate.getDate() - 1)

  const interval = (offset: number) => {
    const date = new Date(baseDate)

    date.setDate(date.getDate() + offset)

    const start = new Date(`${localDate(date)}T${shift.start}:00`)

    const end = new Date(start)

    end.setHours(end.getHours() + 8)

    return {
      date: localDate(date),

      start: start.toISOString(),

      end: end.toISOString(),
    }
  }

  const names = [
    "Lắp ráp động cơ A",

    "Chạy thử động cơ A",

    "Hoàn thiện động cơ A",

    "Lắp ráp động cơ B",

    "Lắp ráp động cơ C",

    "Lắp ráp động cơ D",

    "Chạy thử động cơ B",

    "Lắp ráp động cơ E",

    "Trạm dự phòng",
  ]

  add(
    "machines",

    names.map((name, i) =>
      record(
        `machine-${i}`,

        `MCH-SX-${i + 1}`,

        `${i === 1 || i === 6 ? "Băng thử" : "Thiết bị"} ${name}`,

        {
          productionUnit: unitId,

          area: unitId,

          group: i === 1 || i === 6 ? "Kiểm thử" : "Lắp ráp",
        },
      ),
    ),
  )

  add(
    "stations",

    names.map((name, i) =>
      record(`station-${i}`, `ST-SX-${String(i + 1).padStart(2, "0")}`, name, {
        productionUnit: unitId,

        machineIds: [`${prefix}-machine-${i}`],
      }),
    ),
  )

  const operations = [
    record("op-assembly", "OP-SX-01", "Lắp ráp cụm động cơ", {
      productionUnitIds: [unitId],
    }),

    record("op-test", "OP-SX-02", "Chạy thử động cơ", {
      productionUnitIds: [unitId],
    }),

    record("op-pack", "OP-SX-03", "Hoàn thiện và đóng gói", {
      productionUnitIds: [unitId],
    }),
  ]

  add("operations", operations)

  add("stops", [
    record("stop-maintenance", "STOP-SX-01", "Bảo trì thiết bị", {
      group: "Kế hoạch",

      countDowntime: true,
    }),

    record("stop-machine", "STOP-SX-02", "Sự cố thiết bị thử", {
      group: "Ngoài kế hoạch",

      countDowntime: true,
    }),

    record("stop-material", "STOP-SX-03", "Chờ cấp vật tư", {
      group: "Ngoài kế hoạch",

      countDowntime: true,
    }),
  ])

  let bom = snapshot().boms.find((row) => row.id === `${prefix}-bom`)

  if (!bom)
    bom = saveBom(
      record("bom", "BOM-SX-001", "Định mức cụm động cơ", {
        product: product.id,

        quantity: 1,

        details: materials.map((material, index) => ({
          material: material.id,

          quantity: index === 0 ? 2 : 1,

          waste: index === 0 ? 2 : 0,

          note: "",
        })),
      }),
    )

  let route = snapshot().routes.find((row) => row.id === `${prefix}-route`)

  if (!route)
    route = saveRoute(
      record("route", "PROCESS-SX-001", "Lắp ráp và kiểm thử cụm động cơ", {
        bom: bom.id,

        quantity: 1,

        operation: operations[0].id,

        productionUnit: unitId,

        materials: materials.map((row) => row.id),

        details: operations.map((op, i) => ({
          stepId: `${prefix}-step-${i}`,

          order: (i + 1) * 10,

          operation: op.id,

          note: "",
        })),
      }),
    )

  if (route.lifecycle === "DRAFT") {
    transitionRoute(route.id, "APPLY")

    route = snapshot().routes.find((row) => row.id === route!.id)!
  }

  const ensureOrder = (name: string, offset: number, quantity = 500) => {
    name = batchNote(name)
    let order = productionState(snapshot()).productionOrders.find(
      (order) => order.note === name,
    )

    if (!order) {
      const slots = operations.map((_, i) => interval(offset + i))

      order = saveOrder(
        {
          productId: product.id,

          routeId: route!.id,

          quantity,

          priority: "Bình thường",

          start: slots[0].start,

          end: slots[2].end,

          note: name,

          plans: slots.map((slot, i) => ({
            stepId: `${prefix}-step-${i}`,

            start: slot.start,

            end: slot.end,

            note: "",
          })),
        },

        auth,
      )
    }

    return order
  }

  const runs: {
    order: ManufacturingOrder

    kind: string

    stations: number[]

    offset: number
  }[] = []

  for (const [name, kind, offset, stations, quantity] of [
    ["Lô động cơ A – đang lắp ráp", "running", 0, [0, 1, 2], 500],

    ["Lô động cơ B – đang chạy thử", "paused", -1, [0, 1, 2], 400],

    ["Lô động cơ C – chậm tiến độ", "overdue", -1, [3, 1, 2], 300],

    ["Lô động cơ D – chờ vào trạm", "ready", 0, [4, 1, 2], 600],

    ["Lô động cơ E – chờ công đoạn trước", "waiting", -1, [5, 6, 2], 450],

    ["Lô động cơ F – kế hoạch ca sau", "future", 1, [7, 1, 2], 350],

    ["Lô động cơ G – đã hoàn thành", "completed", -4, [0, 1, 2], 240],

    ["Lô động cơ H – chờ trạm lắp ráp B", "ready", 0, [3, 1, 2], 200],
  ] as [string, string, number, number[], number][]) {
    let order = ensureOrder(name, offset, quantity)

    if (order.status === "DRAFT") releaseOrder(order.id, auth)

    order = productionState(snapshot()).productionOrders.find(
      (row) => row.id === order!.id,
    )!

    const works = productionState(snapshot())

      .workOrders.filter((work) => work.orderId === order.id)

      .sort(
        (a, b) =>
          (workContext(a, snapshot()).step?.order || 0) -
          (workContext(b, snapshot()).step?.order || 0),
      )

    works.forEach((work, index) => {
      if (!work.stationId)
        assignStation(work.id, `${prefix}-station-${stations[index]}`, auth)

      const date = interval(offset + index).date

      if (
        !productionState(snapshot()).assignments.some(
          (row) =>
            row.workOrderId === work.id &&
            row.date === date &&
            row.shiftId === shift.id,
        )
      )
        saveAssignment(
          {
            workOrderId: work.id,

            employeeId: employees[stations[index]]!.id,

            shiftId: shift.id,

            date,

            quantity,

            note: "",
          },

          auth,
        )
    })

    runs.push({ order, kind, stations, offset })
  }

  const events: ExecutionReport[] = []

  all = snapshot()

  for (const run of runs) {
    const works = productionState(all)

      .workOrders.filter((work) => work.orderId === run.order.id)

      .sort(
        (a, b) =>
          (workContext(a, all).step?.order || 0) -
          (workContext(b, all).step?.order || 0),
      )

    works.forEach((work, index) => {
      const completed =
        run.kind === "completed" || (run.kind === "paused" && index === 0)

      const running =
        (run.kind === "running" && index === 0) ||
        (run.kind === "overdue" && index === 0) ||
        (run.kind === "paused" && index === 1)

      if (!completed && !running) return

      const slot = interval(run.offset + index),
        start = new Date(slot.start).getTime(),
        elapsed = Math.max(0, Math.min(now.getTime() - start, 8 * 3600000 - 1)),
        assignment = productionState(all).assignments.find(
          (row) =>
            row.workOrderId === work.id &&
            row.date === slot.date &&
            row.shiftId === shift.id,
        )!,
        employee = all.employees.find(
          (row) => row.id === assignment.employeeId,
        )!

      const event = (
        kind: ExecutionReport["kind"],

        fraction: number,

        quantity = 0,
      ): ExecutionReport => ({
        id: `${prefix}-${run.kind}-${run.order.id}-${index}-${kind}-${fraction}`,

        workOrderId: work.id,

        assignmentId: assignment.id,

        kind,

        at: new Date(start + Math.floor(elapsed * fraction)).toISOString(),

        stationId: `${prefix}-station-${run.stations[index]}`,

        employeeId: employee.id,

        employeeName: text(employee.name),

        shiftId: shift.id,

        shiftName: text(shift.name),

        date: slot.date,

        quantity,

        good: 0,

        ng: 0,

        note: "",

        createdBy: auth.user.id,
      })

      events.push(
        event("START", 0.05),

        event(
          "REPORT",

          0.35,

          completed
            ? run.order.quantity * 0.4
            : Math.floor(run.order.quantity * 0.2),
        ),

        event(
          "REPORT",

          0.6,

          completed
            ? run.order.quantity * 0.6
            : Math.floor(run.order.quantity * 0.3),
        ),
      )

      if (completed && index === 1)
        events.push(
          {
            ...event("PAUSE", 0.4),

            reasonId: `${prefix}-stop-maintenance`,

            reasonName: "Bảo trì thiết bị",

            reasonGroup: "Kế hoạch",

            machineId: `${prefix}-machine-1`,

            machineName: "Băng thử Chạy thử động cơ A",
          },

          event("RESUME", 0.5),
        )

      if (completed) events.push(event("COMPLETE", 0.8))

      if (run.kind === "paused" && index === 1)
        events.push({
          ...event("PAUSE", 0.8),

          reasonId: `${prefix}-stop-machine`,

          reasonName: "Sự cố thiết bị thử",

          reasonGroup: "Ngoài kế hoạch",

          machineId: `${prefix}-machine-1`,

          machineName: "Băng thử Chạy thử động cơ A",
        })
    })
  }

  // Historical sample records go through the same validation as live execution.

  const existing = productionState(all).productionExecutions

  const additions = events

    .filter((event) => !existing.some((old) => old.id === event.id))

    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  if (additions.length) {
    let staged = all

    for (const event of additions) {
      const work = productionState(staged).workOrders.find(
        (row) => row.id === event.workOrderId,
      )!

      guard(
        auth,

        "PRODUCTION_EXECUTION",

        event.kind === "REPORT" ? "EXECUTE" : event.kind,

        work,

        staged,
      )

      const errors = validateExecutionEvent(event, staged)

      if (errors.length) throw new Error(errors.join("\n"))

      staged = {
        ...staged,

        productionExecutions: [
          ...staged.productionExecutions,

          event,
        ] as unknown as RecordData[],
      }
    }

    commitProduction((state) => {
      const productionExecutions = [
          ...state.productionExecutions,

          ...additions,
        ],
        source = {
          ...snapshot(),

          productionExecutions: productionExecutions as unknown as RecordData[],
        }

      return {
        ...state,

        productionExecutions,

        productionOrders: state.productionOrders.map((order) => {
          const works = state.workOrders.filter(
              (work) => work.orderId === order.id,
            ),
            results = works.map((work) => workActuals(work.id, source))

          return results.some((result) => result.started)
            ? {
                ...order,

                status: results.every((result) => result.completed)
                  ? "COMPLETED"
                  : "IN_PROGRESS",

                updatedAt: now.toISOString(),
              }
            : order
        }),
      }
    })
  }

  const cancelled = ensureOrder("Lô động cơ I – hủy kế hoạch", 2, 100)

  if (cancelled.status === "DRAFT") cancelOrder(cancelled.id, auth)

  ensureOrder(marker, 2, 800)

  return true
}
