import type { ShiftTime } from "../types"

import type { RecordData } from "../../master-data/config"

import {
  active,
  bomLines,
  orderedSteps,
  operationUnitIds,
  routeCatalog,
  text,
  validateBom,
  bomClosure,
  type Catalog,
} from "../../process-bom/lib/model"

import type {
  ManufacturingOrder,
  WorkOrder,
  ShiftAssignment,
  StepPlan,
  ProductionState,
  OrderSnapshot,
  ExecutionReport,
} from "../types"

export const orderLabels = {
  DRAFT: "Nháp",

  RELEASED: "Đã phát hành",

  IN_PROGRESS: "Đang thực hiện",

  COMPLETED: "Hoàn thành",

  CANCELLED: "Đã hủy",
}

export const workLabels = {
  UNASSIGNED: "Chưa phân công",

  ASSIGNED: "Đã phân công",

  PAUSED: "Tạm dừng",

  IN_PROGRESS: "Đang thực hiện",

  COMPLETED: "Hoàn thành",

  CANCELLED: "Đã hủy",
}

export const priorities = ["Thấp", "Bình thường", "Cao", "Khẩn cấp"]

export const productionState = (all: Catalog): ProductionState => ({
  productionOrders: (all.productionOrders ||
    []) as unknown as ManufacturingOrder[],

  workOrders: (all.workOrders || []) as unknown as WorkOrder[],

  assignments: (all.assignments || []) as unknown as ShiftAssignment[],

  productionExecutions: (all.productionExecutions ||
    []) as unknown as ExecutionReport[],
})

export const stamp = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(
    value,
  )
    ? new Date(value).getTime()
    : NaN

export const formatTime = (value?: string) =>
  value && Number.isFinite(stamp(value))
    ? new Date(value).toLocaleString("vi-VN")
    : "—"

export const duration = (start: string, end: string) =>
  Number.isFinite(stamp(start)) && Number.isFinite(stamp(end))
    ? Math.round((stamp(end) - stamp(start)) / 60000)
    : 0

export const percent = (good: number, planned: number) =>
  Math.min(100, Math.max(0, planned > 0 ? (good / planned) * 100 : 0))

export const employeeUnit = (employee?: RecordData) =>
  text(employee?.productionUnitId || employee?.department)

export function orderSource(
  order: Pick<ManufacturingOrder, "productId" | "routeId" | "quantity" | "plans" | "sourceSnapshot">,

  all: Catalog,
): OrderSnapshot | undefined {
  if (order.sourceSnapshot) return order.sourceSnapshot

  const route = all.routes.find((row) => row.id === order.routeId)

  if (!route) return undefined

  const source = routeCatalog(route, all),
    product = source.products.find((row) => row.id === order.productId),
    bom = source.boms.find((row) => row.id === route.bom)

  if (!product || !bom) return undefined

  return {
    product: {
      id: product.id,

      code: text(product.code),

      name: text(product.name),

      unit: text(product.unit),
    },

    route: {
      id: route.id,

      code: text(route.code),

      name: text(route.name),

      version: text(route.version),
    },

    bom: { id: bom.id, code: text(bom.code), quantity: Number(bom.quantity) },

    steps: orderedSteps(route).map((step) => {
      const operation = source.operations.find(
          (row) => row.id === step.operation,
        ),
        plan = order.plans.find((plan) => plan.stepId === step.stepId)

      const allowedUnitIds = operationUnitIds(operation)

      return {
        stepId: step.stepId,

        order: Number(step.order),

        operationId: step.operation,

        code: text(operation?.code),

        name: text(operation?.name),

        allowedUnitIds,

        unitNames: allowedUnitIds.map(
          (id) =>
            text(source.productionUnits.find((unit) => unit.id === id)?.name) ||
            id,
        ),

        start: plan?.start || "",

        end: plan?.end || "",

        note: plan?.note || "",
      }
    }),

    materials: bomLines(bom).map((line) => {
      const material = source.products.find((row) => row.id === line.material),
        required =
          (order.quantity * Number(line.quantity)) / Number(bom.quantity)

      return {
        material: line.material,

        code: text(material?.code),

        name: text(material?.name),

        category: text(material?.category),

        unit: text(material?.unit),

        norm: Number(line.quantity),

        required,

        waste: Number(line.waste || 0),

        total: required * (1 + Number(line.waste || 0) / 100),

        note: line.note || "",
      }
    }),
  }
}

export function validateOrder(
  order: ManufacturingOrder,

  all: Catalog,
): string[] {
  const errors: string[] = [],
    route = all.routes.find((row) => row.id === order.routeId),
    product = all.products.find((row) => row.id === order.productId)

  if (!active(product)) errors.push("Vui lòng chọn sản phẩm đang Hoạt động.")

  if (
    !route ||
    route.lifecycle !== "ACTIVE" ||
    !active(route) ||
    route.product !== order.productId
  )
    errors.push(
      "Chọn phiên bản quy trình Đang áp dụng, đang sử dụng và thuộc đúng sản phẩm.",
    )

  if (!Number.isFinite(order.quantity) || order.quantity <= 0)
    errors.push("Số lượng kế hoạch phải lớn hơn 0.")

  if (!priorities.includes(order.priority))
    errors.push("Mức độ ưu tiên không hợp lệ.")

  const start = stamp(order.start),
    end = stamp(order.end)

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    errors.push(
      "Thời gian kết thúc lệnh phải lớn hơn thời gian bắt đầu hợp lệ.",
    )

  if (!route) return errors

  const source = routeCatalog(route, all),
    bom = source.boms.find((row) => row.id === route.bom)

  if (!bom) errors.push("Quy trình chưa có BOM hợp lệ.")
  else
    for (const item of bomClosure(bom.id, source))
      errors.push(...validateBom(item, source))

  const steps = orderedSteps(route)

  if (!steps.length) errors.push("Quy trình phải có ít nhất một công đoạn.")

  if (
    new Set(order.plans.map((plan) => plan.stepId)).size !==
      order.plans.length ||
    order.plans.length !== steps.length ||
    order.plans.some(
      (plan) => !steps.some((step) => step.stepId === plan.stepId),
    )
  )
    errors.push(
      "Kế hoạch công đoạn phải khớp toàn bộ các bước của phiên bản quy trình; không thêm/xóa/đổi bước.",
    )

  let previousEnd = start

  for (const step of steps) {
    const operation = source.operations.find(
        (row) => row.id === step.operation,
      ),
      live = all.operations.find((row) => row.id === step.operation),
      plan = order.plans.find((plan) => plan.stepId === step.stepId)

    if (!active(live))
      errors.push(
        `Công đoạn ${text(operation?.name) || step.operation} không còn Hoạt động.`,
      )

    if (
      !operationUnitIds(operation).some((id) =>
        active(all.productionUnits.find((unit) => unit.id === id)),
      )
    )
      errors.push(
        `Công đoạn thứ tự ${step.order} chưa có Đơn vị sản xuất Hoạt động có thể thực hiện.`,
      )

    const from = stamp(plan?.start || ""),
      to = stamp(plan?.end || "")

    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
      errors.push(
        `Công đoạn ${step.order}: nhập đầy đủ thời gian và kết thúc phải sau bắt đầu.`,
      )
    else {
      if (from < start || to > end)
        errors.push(
          `Công đoạn ${step.order}: thời gian phải nằm trong khoảng kế hoạch của lệnh.`,
        )

      if (from < previousEnd)
        errors.push(
          `Công đoạn ${step.order}: bắt đầu phải từ lúc công đoạn trước hoàn thành trở đi.`,
        )

      previousEnd = to
    }
  }

  return [...new Set(errors)]
}

export function workContext(work: WorkOrder, all: Catalog) {
  const state = productionState(all),
    order = state.productionOrders.find((order) => order.id === work.orderId),
    source = order ? orderSource(order, all) : undefined

  return {
    order,

    source,

    step: source?.steps.find((step) => step.stepId === work.stepId),

    station: all.stations.find((row) => row.id === work.stationId),
  }
}

export function workActuals(workId: string, all: Catalog) {
  const events = productionState(all).productionExecutions.filter(
    (event) => event.workOrderId === workId,
  )

  return {
    quantity: events.reduce(
      (sum, event) => sum + (event.quantity ?? event.good + event.ng),
      0,
    ),

    paused: events.at(-1)?.kind === "PAUSE",

    good: events.reduce((sum, event) => sum + event.good, 0),

    ng: events.reduce((sum, event) => sum + event.ng, 0),

    start: [...events].sort((a, b) => stamp(a.at) - stamp(b.at))[0]?.at,

    end: events.find((event) => event.kind === "COMPLETE")?.at,

    started: events.length > 0,

    completed: events.some((event) => event.kind === "COMPLETE"),
  }
}

export function workStatus(
  work: WorkOrder,

  all: Catalog,
): keyof typeof workLabels {
  const { order } = workContext(work, all),
    actual = workActuals(work.id, all)

  if (order?.status === "CANCELLED") return "CANCELLED"

  if (actual.completed) return "COMPLETED"

  if (actual.paused) return "PAUSED"

  if (actual.started) return "IN_PROGRESS"

  return work.stationId &&
    productionState(all).assignments.some(
      (row) => row.workOrderId === work.id && row.status === "ACTIVE",
    )
    ? "ASSIGNED"
    : "UNASSIGNED"
}

export function orderActuals(order: ManufacturingOrder, all: Catalog) {
  const works = productionState(all)

      .workOrders.filter((work) => work.orderId === order.id)

      .sort(
        (a, b) =>
          (workContext(a, all).step?.order || 0) -
          (workContext(b, all).step?.order || 0),
      ),
    last = works.at(-1),
    results = works.map((work) => workActuals(work.id, all))

  const final = last
    ? workActuals(last.id, all)
    : { good: 0, ng: 0, quantity: 0 }

  return {
    quantity: final.quantity,

    good: final.good,

    ng: final.ng,

    start: results

      .map((row) => row.start)

      .filter(Boolean)

      .sort((a, b) => stamp(a!) - stamp(b!))[0],

    end:
      results.length && results.every((row) => row.completed)
        ? results.map((row) => row.end!).sort((a, b) => stamp(b) - stamp(a))[0]
        : undefined,
  }
}

export function eligibleStations(work: WorkOrder, all: Catalog) {
  const step = workContext(work, all).step

  return all.stations.filter(
    (station) =>
      active(station) &&
      step?.allowedUnitIds.includes(text(station.productionUnit)) &&
      active(
        all.productionUnits.find((unit) => unit.id === station.productionUnit),
      ),
  )
}

export function shiftInterval(
  date: string,

  shift: ShiftTime,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.end) ||
    shift.start === shift.end
  )
    return { start: NaN, end: NaN }

  const start = stamp(`${date}T${shift.start}`),
    base = new Date(`${date}T12:00`)

  if (
    Number.isNaN(base.getTime()) ||
    `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}` !==
      date
  )
    return { start: NaN, end: NaN }

  if (shift.end <= shift.start) base.setDate(base.getDate() + 1)

  const endDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`

  return { start, end: stamp(`${endDate}T${shift.end}`) }
}

export function assignmentInterval(
  row: Pick<ShiftAssignment, "date" | "plannedStart" | "plannedEnd">,
  shift: ShiftTime,
) {
  return row.plannedStart || row.plannedEnd
    ? { start: stamp(row.plannedStart || ""), end: stamp(row.plannedEnd || "") }
    : shiftInterval(row.date, shift)
}

export function validateAssignment(
  row: Pick<ShiftAssignment, "id" | "workOrderId" | "employeeId" | "shiftId" | "date" | "quantity" | "plannedStart" | "plannedEnd">,

  all: Catalog,
): string[] {
  const errors: string[] = [],
    state = productionState(all),
    work = state.workOrders.find((work) => work.id === row.workOrderId)

  if (!work) return ["Không tìm thấy Lệnh làm việc."]

  const { order, step, station } = workContext(work, all),
    actual = workActuals(work.id, all),
    shift = all.shifts.find((shift) => shift.id === row.shiftId),
    employee = all.employees.find((employee) => employee.id === row.employeeId)

  if (
    !order ||
    !["RELEASED", "IN_PROGRESS"].includes(order.status) ||
    actual.completed ||
    productionState(all).productionExecutions.some(
      (event) => event.assignmentId === row.id,
    )
  )
    errors.push(
      "Phân công đã dùng để thực thi hoặc WO đã kết thúc; không được sửa.",
    )

  if (
    !station ||
    !eligibleStations(work, all).some((item) => item.id === station.id)
  )
    errors.push(
      "Chọn và lưu Trạm sản xuất phù hợp trước khi phân công nhân sự.",
    )

  if (!active(shift)) errors.push("Chọn ca làm việc đang Hoạt động.")

  if (
    !active(employee) ||
    employeeUnit(employee) !== text(station?.productionUnit)
  )
    errors.push("Nhân viên phải đang làm việc và thuộc cùng đơn vị với trạm.")

  if (
    row.quantity !== undefined &&
    (!Number.isFinite(row.quantity) || row.quantity <= 0)
  )
    errors.push("Sản lượng giao phải lớn hơn 0 nếu nhập.")

  const shiftTime = {
    start: text(shift?.start),

    end: text(shift?.end),
  }
  const interval = assignmentInterval(row, shiftTime)
  const wholeShift = shiftInterval(row.date, shiftTime)

  if (
    !step ||
    !Number.isFinite(stamp(step.start)) ||
    !Number.isFinite(stamp(step.end)) ||
    !Number.isFinite(interval.start) ||
    !Number.isFinite(wholeShift.start) ||
    !Number.isFinite(wholeShift.end) ||
    !Number.isFinite(interval.end) ||
    interval.end <= interval.start ||
    interval.start < wholeShift.start ||
    interval.end > wholeShift.end ||
    interval.start < stamp(step?.start || "") ||
    interval.end > stamp(step?.end || "")
  )
    errors.push(
      row.plannedStart || row.plannedEnd
        ? "Giờ phân công phải nằm trong ca và kế hoạch công đoạn; kết thúc sau bắt đầu."
        : "Toàn bộ ca (kể cả ca qua đêm) phải nằm trong thời gian kế hoạch công đoạn.",
    )

  for (const other of state.assignments.filter(
    (item) => item.id !== row.id && item.status === "ACTIVE",
  )) {
    const otherWork = state.workOrders.find(
      (work) => work.id === other.workOrderId,
    )

    if (!otherWork || workStatus(otherWork, all) === "CANCELLED") continue

    const sameSlot = other.date === row.date && other.shiftId === row.shiftId

    if (other.workOrderId === work.id && sameSlot)
      errors.push("WO đã có phân công cho ngày và ca này.")

    const time = assignmentInterval(other, other.shiftSnapshot),
      overlap = interval.start < time.end && interval.end > time.start

    if (overlap || (sameSlot && !row.plannedStart && !other.plannedStart)) {
      if (
        otherWork.stationId === work.stationId &&
        other.employeeId !== row.employeeId
      )
        errors.push(
          "Trạm trong ngày/ca hoặc thời gian này đã có nhân viên khác.",
        )

      if (
        other.employeeId === row.employeeId &&
        otherWork.stationId !== work.stationId
      )
        errors.push(
          "Nhân viên đã được phân tại trạm khác trong ngày/ca hoặc thời gian giao nhau.",
        )
    }
  }

  return [...new Set(errors)]
}

export function canStartWork(work: WorkOrder, all: Catalog): string[] {
  const { order, step } = workContext(work, all),
    state = productionState(all)

  if (!order || !["RELEASED", "IN_PROGRESS"].includes(order.status))
    return ["Lệnh sản xuất chưa phát hành hoặc đã kết thúc."]

  if (workStatus(work, all) !== "ASSIGNED")
    return ["Lệnh làm việc phải được phân Trạm và nhân sự trước khi bắt đầu."]

  const previous = state.workOrders.filter(
    (item) =>
      item.orderId === work.orderId &&
      (workContext(item, all).step?.order || 0) < (step?.order || 0),
  )

  return previous.every((item) => workActuals(item.id, all).completed)
    ? []
    : ["Công đoạn trước phải Hoàn thành trước khi bắt đầu công đoạn này."]
}
