import { request } from "../../system/service"
import { snapshot, replaceSharedSnapshot } from "../../master-data/store"
import type { RecordData } from "../../master-data/config"
import type { AuthUser } from "../../system/types"
import type { AssignmentInput, OrderInput } from "./service"
import type { ExecutionInput } from "./executionService"
import type {
  ManufacturingOrder,
  ShiftAssignment,
  WorkOrder,
  ExecutionReport,
} from "../types"
export { executionAction } from "./executionService"

let revision = -1
let generation = 0
let enabled = false
let pending = 0
let readSequence = 0
let connected = true
let queue: Promise<unknown> = Promise.resolve()
interface SharedSnapshot {
  revision: number
  data: Record<string, RecordData[]>
}
interface CommandResponse<T> {
  result: T
  revision: number
}

export async function loadSharedProduction() {
  const token = generation
  const sequence = ++readSequence
  let response: SharedSnapshot
  try {
    response = await request<SharedSnapshot>("/production/snapshot")
    if (!connected)
      window.dispatchEvent(new CustomEvent("mes:sync-state", { detail: "" }))
    connected = true
  } catch (error) {
    connected = false
    window.dispatchEvent(
      new CustomEvent("mes:sync-state", {
        detail:
          "Mất kết nối dữ liệu sản xuất. Hệ thống đang thử kết nối lại; chưa thể xác nhận thay đổi mới.",
      }),
    )
    throw error
  }
  if (token !== generation || sequence !== readSequence || pending) return
  revision = response.revision
  replaceSharedSnapshot(response.data)
  enabled = true
}

export function clearSharedProduction() {
  generation++
  readSequence++
  pending = 0
  queue = Promise.resolve()
  enabled = false
  revision = -1
  replaceSharedSnapshot(
    Object.fromEntries(Object.keys(snapshot()).map((key) => [key, []])),
  )
}

export async function productionCommand<T>(
  command: string,
  args: unknown[] = [],
): Promise<T> {
  const token = generation
  pending++
  const run = async () => {
    try {
      if (token !== generation) throw new Error("Phiên đăng nhập đã thay đổi.")
      const response = await request<CommandResponse<T>>(
        "/production/command",
        "POST",
        {
          command,
          args,
          revision,
          requestId: crypto.randomUUID(),
        },
      )
      if (token !== generation) throw new Error("Phiên đăng nhập đã thay đổi.")
      revision = response.revision
      return response.result
    } finally {
      if (token === generation) {
        pending--
        await loadSharedProduction()
      }
    }
  }
  const result = queue.then(run, run)
  queue = result.catch(() => {})
  return result
}

export const saveOrder = (
  values: OrderInput,
  _auth: AuthUser | null,
  id?: string,
) => productionCommand<ManufacturingOrder>("saveOrder", [values, id])
export const releaseOrder = (id: string, _auth: AuthUser | null) =>
  productionCommand<WorkOrder[]>("releaseOrder", [id])
export const cancelOrder = (id: string, _auth: AuthUser | null) =>
  productionCommand<void>("cancelOrder", [id])
export const deleteOrder = (id: string, _auth: AuthUser | null) =>
  productionCommand<void>("deleteOrder", [id])
export const assignStation = (
  id: string,
  station: string,
  _auth: AuthUser | null,
  reset = false,
) => productionCommand<void>("assignStation", [id, station, reset])
export const saveAssignment = (
  values: AssignmentInput,
  _auth: AuthUser | null,
  id?: string,
) => productionCommand<ShiftAssignment>("saveAssignment", [values, id])
export const deleteAssignment = (id: string, _auth: AuthUser | null) =>
  productionCommand<void>("deleteAssignment", [id])
export const executeWork = (values: ExecutionInput, _auth: AuthUser | null) =>
  productionCommand<ExecutionReport>("executeWork", [values])

// Existing catalogue forms retain their synchronous domain validation. The shared
// commit is confirmed by the server; failures reload authoritative data and surface an error.
if (typeof window !== "undefined")
  window.addEventListener("mes:catalog-change", ((event: CustomEvent) => {
    if (!enabled) return
    const { entity, rows } = event.detail
    void productionCommand("updateCatalog", [entity, rows]).catch((error) =>
      window.dispatchEvent(
        new CustomEvent("mes:sync-error", { detail: error.message }),
      ),
    )
  }) as EventListener)
