import type { Catalog } from "../../process-bom/lib/model"
import type { ManufacturingOrder, WorkOrder } from "../types"
import { orderSource, stamp, workContext, workStatus } from "./model"
export interface ProductionFilters {
  keyword?: string
  productId?: string
  routeId?: string
  operationId?: string
  stationId?: string
  status?: string
  from?: string
  to?: string
}
const normalized = (value: string) => value.trim().toLocaleLowerCase("vi")
export function sortWorkQueue(rows: WorkOrder[], all: Catalog) {
  const closed = (work: WorkOrder) =>
    Number(["COMPLETED", "CANCELLED"].includes(workStatus(work, all)))
  return [...rows].sort(
    (a, b) =>
      closed(a) - closed(b) ||
      stamp(workContext(b, all).order?.start || "") -
        stamp(workContext(a, all).order?.start || "") ||
      (workContext(a, all).step?.order || 0) -
        (workContext(b, all).step?.order || 0),
  )
}
export function dateBounds(filters: ProductionFilters) {
  const start = filters.from ? stamp(`${filters.from}T00:00`) : -Infinity
  if (!filters.to) return { start, end: Infinity }
  const date = new Date(`${filters.to}T12:00`)
  date.setDate(date.getDate() + 1)
  return {
    start,
    end: stamp(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T00:00`,
    ),
  }
}
export function filterOrders(
  rows: ManufacturingOrder[],
  filters: ProductionFilters,
  all: Catalog,
) {
  const { start, end } = dateBounds(filters)
  return rows.filter(
    (order) =>
      (!filters.keyword ||
        normalized(`${order.code} ${order.note}`).includes(
          normalized(filters.keyword),
        )) &&
      (!filters.productId || order.productId === filters.productId) &&
      (!filters.routeId || order.routeId === filters.routeId) &&
      (!filters.status || order.status === filters.status) &&
      stamp(order.start) >= start &&
      stamp(order.start) < end,
  )
}
export function filterWorks(
  rows: WorkOrder[],
  filters: ProductionFilters,
  all: Catalog,
) {
  const { start, end } = dateBounds(filters)
  return rows.filter((work) => {
    const { order, source, step } = workContext(work, all)
    return (
      (!filters.keyword ||
        normalized(
          `${work.code} ${order?.code || ""} ${source?.product.name || ""}`,
        ).includes(normalized(filters.keyword))) &&
      (!filters.operationId || step?.operationId === filters.operationId) &&
      (!filters.stationId || work.stationId === filters.stationId) &&
      (!filters.status || workStatus(work, all) === filters.status) &&
      stamp(step?.start || "") >= start &&
      stamp(step?.end || "") < end
    )
  })
}
