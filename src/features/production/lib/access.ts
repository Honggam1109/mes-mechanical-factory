import type { AuthUser, PermissionAction } from "../../system/types"

import type { Catalog } from "../../process-bom/lib/model"

import type { ManufacturingOrder, WorkOrder } from "../types"

import {
  employeeUnit,
  orderSource,
  productionState,
  workContext,
} from "./model"

export const productionResources: Record<string, string> = {
  "production-progress": "PRODUCTION_MONITOR",

  production: "PRODUCTION_EXECUTION",

  "production-orders": "PRODUCTION_ORDER",

  "production-assignments": "PRODUCTION_ASSIGNMENT",
}

export function hasAction(
  auth: AuthUser | null,

  resource: string,

  action: PermissionAction,
) {
  return !!auth?.permissions[resource]?.includes(action)
}

export function inScope(
  auth: AuthUser | null,

  resource: string,

  access: "VIEW" | "WRITE",

  record: ManufacturingOrder | WorkOrder,

  all: Catalog,
) {
  if (!auth) return false

  const scope = auth.dataScopes[`${resource}:${access}`]

  if (scope === "ALL") return true

  const state = productionState(all),
    isWork = "orderId" in record,
    order = isWork
      ? state.productionOrders.find((order) => order.id === record.orderId)
      : record

  if (!order) return false

  const ownEmployee = auth.employee?.id,
    employee = all.employees.find((employee) => employee.id === ownEmployee),
    unit = employeeUnit(employee) || auth.employee?.productionTeamId

  const works = isWork
    ? [record]
    : state.workOrders.filter((work) => work.orderId === record.id)

  if (scope === "SELF")
    return (
      order.createdBy === auth.user.id ||
      (!!ownEmployee &&
        state.assignments.some(
          (row) =>
            row.employeeId === ownEmployee &&
            row.status === "ACTIVE" &&
            works.some((work) => work.id === row.workOrderId),
        ))
    )

  if (scope !== "PRODUCTION_TEAM" || !unit) return false

  if (isWork) {
    const context = workContext(record, all)

    return context.station
      ? context.station.productionUnit === unit
      : !!context.step?.allowedUnitIds.includes(unit)
  }

  return !!orderSource(order, all)?.steps.some((step) =>
    step.allowedUnitIds.includes(unit),
  )
}

export function guard(
  auth: AuthUser | null,

  resource: string,

  action: PermissionAction,

  record?: ManufacturingOrder | WorkOrder,

  all?: Catalog,
) {
  if (
    !auth ||
    !hasAction(auth, resource, "VIEW") ||
    !hasAction(auth, resource, action) ||
    (record &&
      all &&
      (!inScope(auth, resource, "VIEW", record, all) ||
        !inScope(
          auth,

          resource,

          action === "VIEW" || action === "EXPORT" ? "VIEW" : "WRITE",

          record,

          all,
        )))
  )
    throw new Error(
      "Bạn không có quyền thực hiện thao tác này hoặc bản ghi nằm ngoài phạm vi dữ liệu.",
    )
}
