import { request } from "../system/service"

import type { AuthUser, EmployeeSummary } from "../system/types"

import type { RecordData } from "./config"

interface EmployeeRecord extends EmployeeSummary {
  status?: "ACTIVE" | "INACTIVE"

  productionUnitId?: string

  department?: string

  grade?: string

  jobTitle?: string

  joinedDate?: string

  contact?: string

  description?: string
}

function fromServer(employee: EmployeeRecord): RecordData {
  return {
    id: employee.id,

    code: employee.code,

    name: employee.fullName,

    department: employee.department || "",

    productionUnitId: employee.productionUnitId || employee.department || "",

    grade: employee.grade || "",

    jobTitle: employee.jobTitle || "",

    joinedDate: employee.joinedDate || "",

    contact: employee.contact || "",

    description: employee.description || "",

    email: employee.email || "",

    phone: employee.phone || "",

    productionTeamId: employee.productionTeamId || "",

    productionTeamName: employee.productionTeamName || "",

    status: employee.status === "INACTIVE" ? "Không hoạt động" : "Hoạt động",
  }
}

function toServer(row: RecordData) {
  return {
    ...row,

    fullName: row.name,

    productionUnitId: row.productionUnitId,

    department: row.productionUnitId,

    status: row.status === "Hoạt động" ? "ACTIVE" : "INACTIVE",
  }
}

export function canManageEmployees(auth: AuthUser | null) {
  return (
    !!auth?.permissions.SYSTEM_USER?.includes("UPDATE") &&
    !!auth.permissions.SYSTEM_ROLE?.includes("UPDATE") &&
    auth.dataScopes["SYSTEM_USER:WRITE"] === "ALL"
  )
}

async function changed<T>(result: Promise<T>): Promise<T> {
  const value = await result

  window.dispatchEvent(new Event("mes:employees-changed"))

  return value
}

export const employeeService = {
  list: async () =>
    (await request<{ items: EmployeeRecord[] }>("/employees")).items.map(
      fromServer,
    ),

  save: async (row: RecordData, existing: boolean) =>
    fromServer(
      await changed(
        request<EmployeeRecord>(
          `/employees${existing ? `/${encodeURIComponent(row.id)}` : ""}`,

          existing ? "PUT" : "POST",

          toServer(row),
        ),
      ),
    ),

  import: async (rows: RecordData[]) =>
    (
      await changed(
        request<{ items: EmployeeRecord[] }>("/employees/import", "POST", {
          items: rows.map(toServer),
        }),
      )
    ).items.map(fromServer),

  remove: (id: string) =>
    changed(request(`/employees/${encodeURIComponent(id)}`, "DELETE", {})),
}
