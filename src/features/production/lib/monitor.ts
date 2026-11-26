import type { AuthUser } from "../../system/types"

import type { Catalog } from "../../process-bom/lib/model"

import { active, text } from "../../process-bom/lib/model"

import type { WorkOrder } from "../types"

import { hasAction, inScope } from "./access"

import {
  canStartWork,
  employeeUnit,
  productionState,
  stamp,
  workActuals,
  workContext,
  workStatus,
} from "./model"

import {
  executionBlockers,
  executionStatus,
  stationContext,
  stopSessions,
} from "./execution"

export const monitorResource = "PRODUCTION_MONITOR"

export const monitorLabels: Record<string, string> = {
  PAUSED: "Tạm dừng",

  OVERDUE: "Quá hạn",

  IN_PROGRESS: "Đang thực hiện",

  READY: "Sẵn sàng",

  WAIT_PREVIOUS: "Chờ công đoạn trước",

  NOT_DUE: "Chưa đến thời gian",

  IDLE: "Không có công việc",

  NO_EMPLOYEE: "Thiếu nhân viên trong ca",

  WAITING: "Chờ thực hiện",
}

export const monitorColors: Record<string, string> = {
  PAUSED: "orange",

  OVERDUE: "red",

  IN_PROGRESS: "processing",

  READY: "cyan",

  WAIT_PREVIOUS: "gold",

  NOT_DUE: "default",

  IDLE: "default",

  NO_EMPLOYEE: "red",
}

const rank: Record<string, number> = {
  PAUSED: 0,

  OVERDUE: 1,

  NO_EMPLOYEE: 1,

  IN_PROGRESS: 2,

  READY: 3,

  WAIT_PREVIOUS: 4,

  NOT_DUE: 5,

  IDLE: 6,
}

export function monitorWorkState(work: WorkOrder, all: Catalog, now: Date) {
  const status = workStatus(work, all),
    { step } = workContext(work, all)

  if (status === "COMPLETED" || status === "CANCELLED") return status

  if (status === "PAUSED") return "PAUSED"

  if (now.getTime() > stamp(step?.end || "")) return "OVERDUE"

  if (status === "IN_PROGRESS") return status

  if (
    productionState(all).assignments.some(
      (row) => row.workOrderId === work.id && row.plannedStart,
    )
  )
    return executionStatus(work, all, now)

  if (now.getTime() < stamp(step?.start || "")) return "NOT_DUE"

  if (
    canStartWork(work, all).some((error) => error.includes("Công đoạn trước"))
  )
    return "WAIT_PREVIOUS"

  return executionBlockers(work, work.stationId, all, now).length ||
    status !== "ASSIGNED"
    ? "NO_EMPLOYEE"
    : "READY"
}

export function stationVisible(
  stationId: string,

  all: Catalog,

  auth: AuthUser | null,
) {
  if (!hasAction(auth, monitorResource, "VIEW")) return false

  const scope = auth?.dataScopes[`${monitorResource}:VIEW`],
    station = all.stations.find((row) => row.id === stationId)

  if (scope === "ALL") return true

  if (scope === "PRODUCTION_TEAM") {
    const unit =
      employeeUnit(
        all.employees.find((row) => row.id === auth?.employee?.id),
      ) || auth?.employee?.productionTeamId

    return !!unit && station?.productionUnit === unit
  }

  return productionState(all).workOrders.some(
    (work) =>
      work.stationId === stationId &&
      inScope(auth, monitorResource, "VIEW", work, all),
  )
}

export function monitorStations(
  unitId: string,

  all: Catalog,

  auth: AuthUser | null,

  now: Date,
) {
  const state = productionState(all)

  if (!active(all.productionUnits.find((unit) => unit.id === unitId))) return []

  return all.stations

    .filter(
      (station) =>
        active(station) &&
        station.productionUnit === unitId &&
        stationVisible(station.id, all, auth),
    )

    .map((station) => {
      const works = state.workOrders.filter(
        (work) =>
          work.stationId === station.id &&
          inScope(auth, monitorResource, "VIEW", work, all),
      )

      const pending = works.filter(
        (work) => !["COMPLETED", "CANCELLED"].includes(workStatus(work, all)),
      )

      const flags = [
        ...new Set(
          pending.flatMap((work) => {
            const status = workStatus(work, all),
              end = workContext(work, all).step?.end

            return [
              monitorWorkState(work, all, now),

              ...(status === "IN_PROGRESS" ? [status] : []),

              ...(now.getTime() > stamp(end || "") ? ["OVERDUE"] : []),
            ]
          }),
        ),
      ]

      const primaryRank = (work: WorkOrder) => {
        const status = workStatus(work, all),
          calculated = monitorWorkState(work, all, now)

        return status === "PAUSED"
          ? 0
          : status === "IN_PROGRESS"
            ? 1
            : calculated === "READY"
              ? 2
              : calculated === "WAIT_PREVIOUS"
                ? 3
                : calculated === "NOT_DUE"
                  ? 4
                  : 5
      }

      const byTime = (a: WorkOrder, b: WorkOrder) =>
        stamp(workContext(a, all).step?.start || "") -
          stamp(workContext(b, all).step?.start || "") ||
        a.code.localeCompare(b.code)

      const primary = [...pending].sort(
        (a, b) => primaryRank(a) - primaryRank(b) || byTime(a, b),
      )[0]

      const status = [...flags].sort((a, b) => rank[a] - rank[b])[0] || "IDLE"

      if (!flags.length) flags.push("IDLE")

      const current = stationContext(station.id, all, now, primary?.id)

      const problems =
        flags.some((flag) =>
          ["PAUSED", "OVERDUE", "NO_EMPLOYEE"].includes(flag),
        ) ||
        (!!pending.length &&
          !!current.error &&
          pending.some(
            (work) =>
              now.getTime() >= stamp(workContext(work, all).step?.start || ""),
          ))

      return {
        station,

        works,

        pending,

        primary,

        status,

        flags,

        current,

        problems,

        upcoming: pending

          .filter((work) => work.id !== primary?.id)

          .sort(byTime)

          .slice(0, 5),

        pause: primary
          ? stopSessions(primary.id, all).find((row) => !row.end)
          : undefined,
      }
    })

    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        a.station.code.toString().localeCompare(text(b.station.code)),
    )
}

export type MonitoredStation = ReturnType<typeof monitorStations>[number]

export interface MonitorFilters {
  status?: string

  operationId?: string

  keyword?: string

  problems?: boolean
}

export function filterMonitoredStations(
  rows: MonitoredStation[],

  filters: MonitorFilters,

  all: Catalog,
) {
  const keyword = filters.keyword?.trim().toLocaleLowerCase("vi") || ""

  return rows.filter(
    (row) =>
      (!filters.status ||
        (filters.status === "WAITING"
          ? row.flags.some((flag) =>
              ["WAIT_PREVIOUS", "NOT_DUE"].includes(flag),
            )
          : row.flags.includes(filters.status))) &&
      (!filters.problems || row.problems) &&
      (!filters.operationId ||
        row.pending.some(
          (work) =>
            workContext(work, all).step?.operationId === filters.operationId,
        )) &&
      (!keyword ||
        [
          row.station.code,

          row.station.name,

          ...row.works.flatMap((work) => {
            const context = workContext(work, all)

            return [
              work.code,

              context.order?.code,

              context.source?.product.name,
            ]
          }),
        ]

          .join(" ")

          .toLocaleLowerCase("vi")

          .includes(keyword)),
  )
}

export function deadlineLabel(end: string | undefined, now: Date) {
  const diff = stamp(end || "") - now.getTime()

  if (!Number.isFinite(diff)) return "—"

  const minutes = Math.ceil(Math.abs(diff) / 60000),
    hours = Math.floor(minutes / 60),
    tail = minutes % 60

  return `${diff < 0 ? "Quá hạn" : "Còn"} ${
    hours ? `${hours} giờ ` : ""
  }${tail} phút`
}
