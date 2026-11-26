import { snapshot, commitProduction } from "../../master-data/store"

import { nextCode, text, orderedSteps } from "../../process-bom/lib/model"

import type { AuthUser } from "../../system/types"

import type { ManufacturingOrder, StepPlan, ShiftAssignment } from "../types"

import {
  orderSource,
  productionState,
  validateOrder,
  eligibleStations,
  workActuals,
  workContext,
  validateAssignment,
  workStatus,
  employeeUnit,
} from "./model"

import { guard, inScope } from "./access"

const check = (errors: string[]) => {
  if (errors.length) throw new Error([...new Set(errors)].join("\n"))
}

const orderResource = "PRODUCTION_ORDER",
  assignmentResource = "PRODUCTION_ASSIGNMENT"

export interface OrderInput {
  productId: string

  routeId: string

  quantity: number

  priority: string

  start: string

  end: string

  note: string

  plans: StepPlan[]
}

export function saveOrder(
  values: OrderInput,

  auth: AuthUser | null,

  id?: string,
) {
  const all = snapshot(),
    state = productionState(all),
    old = state.productionOrders.find((order) => order.id === id)

  guard(auth, orderResource, id ? "UPDATE" : "CREATE", old, all)

  if (id && !old) throw new Error("Không tìm thấy lệnh sản xuất.")

  if (old && old.status !== "DRAFT")
    throw new Error("Chỉ được sửa Lệnh sản xuất Nháp.")

  const now = new Date().toISOString(),
    record: ManufacturingOrder = {
      id: old?.id || crypto.randomUUID(),

      code: old?.code || nextCode(all.productionOrders || [], "MO"),

      productId: values.productId,

      routeId: values.routeId,

      quantity: Number(values.quantity),

      priority: values.priority || "Bình thường",

      start: values.start,

      end: values.end,

      note: String(values.note || "").trim(),

      plans: values.plans.map((plan) => ({
        stepId: plan.stepId,

        start: plan.start || "",

        end: plan.end || "",

        note: String(plan.note || "").trim(),
      })),

      status: "DRAFT",

      createdBy: old?.createdBy || auth!.user.id,

      createdAt: old?.createdAt || now,

      updatedAt: now,
    }

  check(validateOrder(record, all))

  const sequence = new Map(
    orderedSteps(all.routes.find((route) => route.id === record.routeId)).map(
      (step, index) => [step.stepId, index],
    ),
  )

  record.plans.sort(
    (a, b) => (sequence.get(a.stepId) || 0) - (sequence.get(b.stepId) || 0),
  )

  if (
    !inScope(auth, orderResource, "WRITE", record, all) ||
    !inScope(auth, orderResource, "VIEW", record, all)
  )
    throw new Error("Lệnh nằm ngoài phạm vi dữ liệu được phép tạo/sửa.")

  commitProduction((state) => ({
    ...state,

    productionOrders: old
      ? state.productionOrders.map((order) =>
          order.id === id ? record : order,
        )
      : [record, ...state.productionOrders],
  }))

  return record
}

export function releaseOrder(id: string, auth: AuthUser | null) {
  const all = snapshot(),
    state = productionState(all),
    order = state.productionOrders.find((order) => order.id === id)

  if (!order) throw new Error("Không tìm thấy Lệnh sản xuất.")

  guard(auth, orderResource, "RELEASE", order, all)

  if (order.status !== "DRAFT")
    throw new Error(
      "Chỉ phát hành Lệnh sản xuất Nháp; lệnh này đã phát hành hoặc đã hủy.",
    )

  check(validateOrder(order, all))

  const sourceSnapshot = structuredClone(orderSource(order, all)!),
    now = new Date().toISOString()

  let count = Math.max(
    0,

    ...state.workOrders.map(
      (work) => Number(work.code.match(/^WO-(\d+)$/)?.[1]) || 0,
    ),
  )

  const works = sourceSnapshot.steps.map((step) => ({
    id: crypto.randomUUID(),

    code: `WO-${String(++count).padStart(4, "0")}`,

    orderId: id,

    stepId: step.stepId,

    stationId: "",
  }))

  commitProduction((state) => ({
    ...state,

    productionOrders: state.productionOrders.map((row) =>
      row.id === id
        ? {
            ...row,

            status: "RELEASED",

            releasedAt: now,

            updatedAt: now,

            sourceSnapshot,
          }
        : row,
    ),

    workOrders: [...state.workOrders, ...works],
  }))

  return works
}

export function deleteOrder(id: string, auth: AuthUser | null) {
  const all = snapshot(),
    order = productionState(all).productionOrders.find(
      (order) => order.id === id,
    )

  if (!order) throw new Error("Không tìm thấy Lệnh sản xuất.")

  guard(auth, orderResource, "DELETE", order, all)

  if (order.status !== "DRAFT") throw new Error("Chỉ được xóa lệnh Nháp.")

  commitProduction((state) => ({
    ...state,

    productionOrders: state.productionOrders.filter((row) => row.id !== id),
  }))
}

export function cancelOrder(id: string, auth: AuthUser | null) {
  const all = snapshot(),
    state = productionState(all),
    order = state.productionOrders.find((order) => order.id === id)

  if (!order) throw new Error("Không tìm thấy lệnh.")

  guard(auth, orderResource, "UPDATE", order, all)

  const works = state.workOrders.filter((work) => work.orderId === id)

  if (
    !["DRAFT", "RELEASED"].includes(order.status) ||
    works.some((work) => workActuals(work.id, all).started)
  )
    throw new Error(
      "Chỉ hủy lệnh chưa bắt đầu thực thi. Lệnh đang thực hiện/đã kết thúc không được hủy ở đây.",
    )

  const now = new Date().toISOString()

  commitProduction((state) => ({
    ...state,

    productionOrders: state.productionOrders.map((row) =>
      row.id === id
        ? { ...row, status: "CANCELLED", cancelledAt: now, updatedAt: now }
        : row,
    ),

    assignments: state.assignments.map((row) =>
      works.some((work) => work.id === row.workOrderId)
        ? { ...row, status: "CANCELLED" }
        : row,
    ),
  }))
}

export function assignStation(
  workId: string,

  stationId: string,

  auth: AuthUser | null,

  resetPersonnel = false,
) {
  const all = snapshot(),
    state = productionState(all),
    work = state.workOrders.find((work) => work.id === workId)

  if (!work) throw new Error("Không tìm thấy WO.")

  guard(auth, assignmentResource, "ASSIGN", work, all)

  if (!["UNASSIGNED", "ASSIGNED"].includes(workStatus(work, all)))
    throw new Error("Không đổi trạm khi WO đã thực thi/kết thúc.")

  if (!eligibleStations(work, all).some((station) => station.id === stationId))
    throw new Error(
      "Trạm phải Hoạt động, thuộc đơn vị có khả năng thực hiện công đoạn.",
    )

  guard(auth, assignmentResource, "ASSIGN", { ...work, stationId }, all)

  if (work.stationId === stationId) return

  if (
    state.assignments.some(
      (row) => row.workOrderId === workId && row.status === "ACTIVE",
    ) &&
    !resetPersonnel
  )
    throw new Error(
      "Đổi trạm sẽ xóa các phân công nhân sự hiện tại. Cần xác nhận trước.",
    )

  commitProduction((state) => ({
    ...state,

    workOrders: state.workOrders.map((row) =>
      row.id === workId ? { ...row, stationId } : row,
    ),

    assignments: state.assignments.filter((row) => row.workOrderId !== workId),
  }))
}

export interface AssignmentInput {
  plannedStart?: string
  plannedEnd?: string
  workOrderId: string

  employeeId: string

  shiftId: string

  date: string

  quantity?: number

  note: string
}

export function saveAssignment(
  values: AssignmentInput,

  auth: AuthUser | null,

  id?: string,
) {
  const all = snapshot(),
    state = productionState(all),
    work = state.workOrders.find((row) => row.id === values.workOrderId),
    old = state.assignments.find((row) => row.id === id)

  if (!work || (id && (!old || old.workOrderId !== work.id)))
    throw new Error("Không tìm thấy phân công/WO.")

  guard(auth, assignmentResource, "ASSIGN", work, all)

  const record = {
    ...values,

    id: old?.id || crypto.randomUUID(),

    quantity: values.quantity == null ? undefined : Number(values.quantity),
  }

  check(validateAssignment(record, all))

  const shift = all.shifts.find((row) => row.id === values.shiftId)!,
    employee = all.employees.find((row) => row.id === values.employeeId)!

  const assignment: ShiftAssignment = {
    ...record,

    note: String(values.note || "").trim(),

    status: "ACTIVE",

    createdAt: old?.createdAt || new Date().toISOString(),

    createdBy: old?.createdBy || auth!.user.id,

    shiftSnapshot: {
      code: text(shift.code),

      name: text(shift.name),

      start: text(shift.start),

      end: text(shift.end),

      breakMinutes: Number(shift.breakMinutes || 0),
    },

    employeeSnapshot: {
      code: text(employee.code),

      name: text(employee.name),

      productionUnitId: employeeUnit(employee),
    },
  }

  commitProduction((state) => ({
    ...state,

    assignments: old
      ? state.assignments.map((row) => (row.id === id ? assignment : row))
      : [...state.assignments, assignment],
  }))

  return assignment
}

export function deleteAssignment(id: string, auth: AuthUser | null) {
  const all = snapshot(),
    state = productionState(all),
    row = state.assignments.find((row) => row.id === id),
    work = state.workOrders.find((work) => work.id === row?.workOrderId)

  if (!row || !work) throw new Error("Không tìm thấy phân công.")

  guard(auth, assignmentResource, "ASSIGN", work, all)

  if (
    ["COMPLETED", "CANCELLED"].includes(workStatus(work, all)) ||
    state.productionExecutions.some((event) => event.assignmentId === id)
  )
    throw new Error("Không xóa phân công đã thực thi hoặc WO đã kết thúc.")

  commitProduction((state) => ({
    ...state,

    assignments: state.assignments.filter((row) => row.id !== id),
  }))
}
