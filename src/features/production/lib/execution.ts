import type { Catalog } from "../../process-bom/lib/model"

import { active, text } from "../../process-bom/lib/model"

import { ids } from "../../master-data/rules"
import { assignmentInterval } from "./model"

import type { ExecutionReport, WorkOrder } from "../types"

import {
  canStartWork,
  employeeUnit,
  productionState,
  shiftInterval,
  stamp,
  workActuals,
  workContext,
  workStatus,
} from "./model"

export const executionLabels: Record<string, string> = {
  NOT_DUE: "Chưa đến thời gian",

  WAIT_PREVIOUS: "Chờ công đoạn trước",

  READY: "Sẵn sàng",

  IN_PROGRESS: "Đang thực hiện",

  PAUSED: "Tạm dừng",

  COMPLETED: "Hoàn thành",

  OVERDUE: "Quá hạn",

  NO_EMPLOYEE: "Chưa có nhân viên trong ca",

  CANCELLED: "Đã hủy",

  UNASSIGNED: "Chưa phân công",
}

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// The work date is the date on which an overnight shift starts, not the next calendar day.

export function stationContext(
  stationId: string,

  all: Catalog,

  now = new Date(),

  workId?: string,
) {
  const state = productionState(all),
    yesterday = new Date(now)

  yesterday.setDate(yesterday.getDate() - 1)

  const slots = all.shifts.filter(active).flatMap((shift) =>
    [localDate(now), localDate(yesterday)].flatMap((date) => {
      const interval = shiftInterval(date, {
        start: text(shift.start),

        end: text(shift.end),
      })

      return interval &&
        now.getTime() >= interval.start &&
        now.getTime() < interval.end
        ? [{ shift, date }]
        : []
    }),
  )

  const assignments = state.assignments.filter(
    (row) =>
      row.status === "ACTIVE" &&
      slots.some(
        (slot) => slot.shift.id === row.shiftId && slot.date === row.date,
      ) &&
      (() => {
        const shift = all.shifts.find((shift) => shift.id === row.shiftId)
        if (!row.plannedStart || !shift) return true
        const time = assignmentInterval(row, {
          start: text(shift.start),
          end: text(shift.end),
        })
        if (now.getTime() >= time.start && now.getTime() < time.end) return true
        const work = state.workOrders.find(
          (work) => work.id === row.workOrderId,
        )
        const context = work && workContext(work, all)
        const previous =
          context &&
          state.workOrders.filter(
            (other) =>
              other.orderId === work!.orderId &&
              (workContext(other, all).step?.order || 0) <
                (context.step?.order || 0),
          )
        return (
          row.workOrderId === workId &&
          now.getTime() < time.start &&
          !!previous?.length &&
          previous.every((other) => workActuals(other.id, all).completed)
        )
      })() &&
      state.workOrders.some(
        (work) =>
          work.id === row.workOrderId &&
          work.stationId === stationId &&
          workStatus(work, all) !== "CANCELLED",
      ),
  )

  const employees = [...new Set(assignments.map((row) => row.employeeId))]

  const assignment =
    employees.length === 1
      ? assignments.find((row) => row.workOrderId === workId) || assignments[0]
      : undefined

  const ambiguousShift =
    new Set(assignments.map((row) => `${row.date}:${row.shiftId}`)).size > 1

  const employee = all.employees.find(
    (row) => row.id === assignment?.employeeId,
  )

  const station = all.stations.find((row) => row.id === stationId)

  const validEmployee =
    assignment &&
    active(employee) &&
    employeeUnit(employee) === station?.productionUnit

  const slot =
    slots.find(
      (slot) =>
        slot.shift.id === assignment?.shiftId && slot.date === assignment?.date,
    ) ||
    (new Set(
      slots.map((slot) => `${slot.date}:${slot.shift.start}:${slot.shift.end}`),
    ).size === 1
      ? slots[0]
      : undefined)

  return {
    slots,

    assignment: validEmployee && !ambiguousShift ? assignment : undefined,

    employee,

    slot,

    error: ambiguousShift
      ? "Có nhiều ca được phân công giao nhau tại Trạm. Kiểm tra cấu hình Ca và Phân công."
      : employees.length > 1
        ? "Có nhiều nhân viên trùng thời gian tại Trạm. Kiểm tra lại phân công."
        : !validEmployee
          ? "Chưa có nhân viên được phân công cho Trạm trong Ca hiện tại."
          : "",
  }
}

export function executionBlockers(
  work: WorkOrder,

  stationId: string,

  all: Catalog,

  now = new Date(),
) {
  const { order, step, station } = workContext(work, all),
    current = stationContext(stationId, all, now, work.id),
    errors: string[] = []

  if (!stationId || work.stationId !== stationId)
    errors.push("WO không được phân công cho Trạm đang chọn.")

  if (
    !active(station) ||
    !active(
      all.productionUnits.find((unit) => unit.id === station?.productionUnit),
    )
  )
    errors.push("Trạm và Đơn vị sản xuất phải đang Hoạt động.")

  if (!order || !["RELEASED", "IN_PROGRESS"].includes(order.status))
    errors.push("MO chưa phát hành hoặc đã kết thúc/hủy.")

  const previous = productionState(all).workOrders.filter(
    (other) =>
      other.orderId === work.orderId &&
      (workContext(other, all).step?.order || 0) < (step?.order || 0),
  )
  const early =
    !!current.assignment?.plannedStart &&
    previous.length > 0 &&
    previous.every((other) => workActuals(other.id, all).completed)
  if (now.getTime() < stamp(step?.start || "") && !early)
    errors.push("Chưa đến thời gian bắt đầu kế hoạch.")

  if (current.error) errors.push(current.error)

  return errors
}

export function executionStatus(
  work: WorkOrder,

  all: Catalog,

  now = new Date(),
) {
  const status = workStatus(work, all),
    { step } = workContext(work, all)

  if (["COMPLETED", "CANCELLED"].includes(status)) return status

  if (now.getTime() > stamp(step?.end || "")) return "OVERDUE"

  if (["IN_PROGRESS", "PAUSED"].includes(status)) return status

  if (
    productionState(all).assignments.some(
      (row) => row.workOrderId === work.id && row.plannedStart,
    ) &&
    canStartWork(work, all).some((error) => error.includes("Công đoạn trước"))
  )
    return "WAIT_PREVIOUS"

  if (
    now.getTime() < stamp(step?.start || "") &&
    !stationContext(work.stationId, all, now, work.id).assignment?.plannedStart
  )
    return "NOT_DUE"

  if (
    canStartWork(work, all).some((error) => error.includes("Công đoạn trước"))
  )
    return "WAIT_PREVIOUS"

  if (status === "UNASSIGNED") return status

  return executionBlockers(work, work.stationId, all, now).length
    ? "NO_EMPLOYEE"
    : "READY"
}

export function stopSessions(workId: string, all: Catalog) {
  const events = productionState(all).productionExecutions.filter(
    (row) => row.workOrderId === workId,
  )

  return events

    .filter((row) => row.kind === "PAUSE")

    .map((row) => ({
      ...row,

      end: events.find(
        (event) =>
          event.kind === "RESUME" &&
          stamp(event.at) >= stamp(row.at) &&
          events.indexOf(event) > events.indexOf(row),
      )?.at,
    }))
}

// Used at both the command boundary and the atomic store boundary.

export function validateExecutionEvent(event: ExecutionReport, all: Catalog) {
  const state = productionState(all),
    work = state.workOrders.find((row) => row.id === event.workOrderId)

  if (!work) return ["Không tìm thấy WO."]

  const errors = executionBlockers(
      work,

      event.stationId || "",

      all,

      new Date(event.at),
    ),
    actual = workActuals(work.id, all),
    status = workStatus(work, all)

  if (!Number.isFinite(stamp(event.at)))
    errors.push("Thời gian thực thi không hợp lệ.")

  if (
    state.productionExecutions.some(
      (row) => row.workOrderId === work.id && stamp(row.at) > stamp(event.at),
    )
  )
    errors.push("Thời gian không được lùi trước nhật ký đã có.")

  const current = stationContext(
    work.stationId,

    all,

    new Date(event.at),

    work.id,
  )

  if (
    !current.assignment ||
    event.assignmentId !== current.assignment.id ||
    event.employeeId !== current.assignment.employeeId ||
    event.shiftId !== current.assignment.shiftId ||
    event.date !== current.assignment.date
  )
    errors.push("Nhân viên/Ca phải khớp phân công hiện tại của Trạm.")

  if (event.good !== 0 || event.ng !== 0)
    errors.push("Thực thi không ghi nhận Đạt/NG.")

  if (event.kind === "START") {
    errors.push(...canStartWork(work, all))

    const step = workContext(work, all).step

    if (
      state.workOrders.some(
        (row) =>
          row.orderId === work.orderId &&
          (workContext(row, all).step?.order || 0) < (step?.order || 0) &&
          stamp(workActuals(row.id, all).end || "") > stamp(event.at),
      )
    )
      errors.push("Công đoạn trước chưa hoàn thành tại thời điểm bắt đầu.")
  } else if (event.kind === "RESUME") {
    if (status !== "PAUSED") errors.push("Chỉ Tiếp tục khi WO đang Tạm dừng.")
  } else if (["REPORT", "PAUSE", "COMPLETE"].includes(event.kind)) {
    if (!actual.started || status !== "IN_PROGRESS")
      errors.push(
        "WO phải Đang thực hiện; không ghi khi tạm dừng/đã hoàn thành.",
      )
  } else errors.push("Thao tác không hợp lệ.")

  if (event.kind === "REPORT") {
    if (!Number.isFinite(event.quantity) || Number(event.quantity) <= 0)
      errors.push("Sản lượng phải lớn hơn 0.")
  } else if (event.quantity !== 0)
    errors.push("Chỉ Ghi sản lượng được tăng sản lượng thực hiện.")

  if (event.kind === "PAUSE") {
    const reason = all.stops.find((row) => row.id === event.reasonId),
      station = workContext(work, all).station

    if (!active(reason)) errors.push("Chọn nguyên nhân dừng đang Hoạt động.")

    if (event.machineId && !ids(station?.machineIds).includes(event.machineId))
      errors.push("Máy liên quan phải thuộc Trạm.")

    if (
      event.reasonName !== text(reason?.name) ||
      event.reasonGroup !== text(reason?.group)
    )
      errors.push("Nguyên nhân dừng không khớp dữ liệu gốc.")
  }

  if (
    event.kind === "COMPLETE" &&
    actual.quantity < (workContext(work, all).order?.quantity || 0) &&
    !event.note?.trim()
  )
    errors.push("Nhập lý do hoàn thành thiếu sản lượng.")

  return [...new Set(errors)]
}
