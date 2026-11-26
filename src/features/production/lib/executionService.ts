import { snapshot, commitProduction } from "../../master-data/store"
import { text } from "../../process-bom/lib/model"
import type { AuthUser, PermissionAction } from "../../system/types"
import type { ExecutionReport } from "../types"
import { guard } from "./access"
import { productionState, workActuals, canStartWork } from "./model"
import { stationContext, validateExecutionEvent } from "./execution"
export interface ExecutionInput {
  workOrderId: string
  stationId: string
  kind: ExecutionReport["kind"]
  quantity?: number
  note?: string
  reasonId?: string
  machineId?: string
}
export const executionAction: Record<ExecutionReport["kind"], PermissionAction> =
  {
    START: "START",
    REPORT: "EXECUTE",
    PAUSE: "PAUSE",
    RESUME: "RESUME",
    COMPLETE: "COMPLETE",
  }
export function executeWork(input: ExecutionInput, auth: AuthUser | null) {
  const all = snapshot(),
    state = productionState(all),
    work = state.workOrders.find((row) => row.id === input.workOrderId)
  if (!work) throw new Error("Không tìm thấy WO.")
  guard(auth, "PRODUCTION_EXECUTION", executionAction[input.kind], work, all)
  const at = new Date().toISOString(),
    current = stationContext(input.stationId, all, new Date(at), work.id),
    assignment = current.assignment
  if (!assignment)
    throw new Error(current.error || "Không có phân công hiện tại.")
  if (input.kind === "START") {
    const errors = canStartWork(work, all)
    if (errors.length) throw new Error(errors.join("\n"))
  }
  if (
    auth?.dataScopes["PRODUCTION_EXECUTION:WRITE"] !== "ALL" &&
    assignment.employeeId !== auth?.employee?.id
  )
    throw new Error(
      "Bạn chỉ được thực thi công việc được phân công cho chính mình trong ca hiện tại.",
    )
  if (
    state.workOrders.some(
      (other) =>
        other.id !== work.id &&
        !workActuals(other.id, all).completed &&
        workActuals(other.id, all).started &&
        new Date(workActuals(other.id, all).start!).getTime() <=
          new Date(at).getTime() &&
        state.assignments.some(
          (row) =>
            row.workOrderId === other.id &&
            row.status === "ACTIVE" &&
            row.employeeId === assignment.employeeId,
        ),
    )
  )
    throw new Error(
      "Nhân viên đang thực hiện công việc khác. Hoàn thành công việc đó trước.",
    )
  if (
    state.workOrders.some(
      (other) =>
        other.id !== work.id &&
        other.stationId === input.stationId &&
        workActuals(other.id, all).started &&
        new Date(workActuals(other.id, all).start!).getTime() <=
          new Date(at).getTime() &&
        !workActuals(other.id, all).completed,
    )
  )
    throw new Error("Trạm đang thực hiện công việc khác.")
  if (
    assignment.plannedStart &&
    new Date(assignment.plannedStart).getTime() > new Date(at).getTime()
  ) {
    const start = new Date(at).getTime()
    const end = new Date(assignment.plannedEnd!).getTime()
    const conflict = state.assignments.some((row) => {
      if (row.id === assignment.id || row.status !== "ACTIVE") return false
      const other = state.workOrders.find((work) => work.id === row.workOrderId)
      if (
        !other ||
        workActuals(other.id, all).completed ||
        other.id === work.id
      )
        return false
      if (
        row.employeeId !== assignment.employeeId &&
        other.stationId !== work.stationId
      )
        return false
      const from = new Date(
        row.plannedStart || `${row.date}T${row.shiftSnapshot.start}`,
      ).getTime()
      let to = new Date(
        row.plannedEnd || `${row.date}T${row.shiftSnapshot.end}`,
      ).getTime()
      if (!row.plannedEnd && to <= from) to += 86400000
      return start < to && end > from
    })
    if (conflict)
      throw new Error(
        "Bắt đầu sớm gây xung đột giờ phân công của nhân viên hoặc trạm.",
      )
  }
  const reason = all.stops.find((row) => row.id === input.reasonId),
    machine = all.machines.find((row) => row.id === input.machineId)
  const event: ExecutionReport = {
    id: crypto.randomUUID(),
    workOrderId: work.id,
    assignmentId: assignment.id,
    kind: input.kind,
    at,
    quantity: input.kind === "REPORT" ? Number(input.quantity) : 0,
    good: 0,
    ng: 0,
    stationId: input.stationId,
    employeeId: assignment.employeeId,
    shiftId: assignment.shiftId,
    date: assignment.date,
    employeeName: text(current.employee?.name),
    shiftName: text(current.slot?.shift.name),
    createdBy: auth!.user.id,
    note: String(input.note || "").trim(),
    ...(input.kind === "PAUSE"
      ? {
          reasonId: input.reasonId,
          reasonName: text(reason?.name),
          reasonGroup: text(reason?.group),
          machineId: input.machineId,
          machineName: text(machine?.name),
        }
      : {}),
  }
  const errors = validateExecutionEvent(event, all)
  if (errors.length) throw new Error(errors.join("\n"))
  commitProduction((state, source) => {
    const productionExecutions = [...state.productionExecutions, event],
      staged = {
        ...source,
        productionExecutions:
          productionExecutions as unknown as typeof source.productionExecutions,
      }
    return {
      ...state,
      productionExecutions,
      productionOrders: state.productionOrders.map((order) =>
        order.id === work.orderId
          ? {
              ...order,
              status: state.workOrders
                .filter((row) => row.orderId === order.id)
                .every((row) => workActuals(row.id, staged).completed)
                ? "COMPLETED"
                : "IN_PROGRESS",
              updatedAt: at,
            }
          : order,
      ),
    }
  })
  return event
}
