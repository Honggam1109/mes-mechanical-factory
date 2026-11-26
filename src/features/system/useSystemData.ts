import { useCallback, useEffect, useRef, useState } from "react"
import { request, systemService } from "./service"
import type {
  DataPermission,
  EmployeeSummary,
  EntityKind,
  Filter,
  Pagination,
  Permission,
  Role,
  SystemRecord,
  User,
} from "./types"
interface EmployeeOption extends EmployeeSummary {
  linkedUserId?: string
}
export interface Options {
  roles: Role[]
  permissions: Permission[]
  dataPermissions: DataPermission[]
  employees: EmployeeOption[]
  users: User[]
}
export default function useSystemData(kind: EntityKind, id?: string) {
  const [filters, setFilters] = useState<Filter>({ page: 1, pageSize: 10 }),
    [data, setData] = useState<Pagination<SystemRecord>>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    }),
    [record, setRecord] = useState<SystemRecord>(),
    [options, setOptions] = useState<Options>({
      roles: [],
      permissions: [],
      dataPermissions: [],
      employees: [],
      users: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("")
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const current = ++sequence.current
    setLoading(true)
    setError("")
    try {
      const [result, choices] = await Promise.all([
        id && id !== "new"
          ? systemService.detail(kind, id)
          : id === "new"
            ? Promise.resolve(undefined)
            : systemService.list(kind, filters),
        request<Options>("/system/options"),
      ])
      if (current !== sequence.current) return
      if (id) setRecord(result as SystemRecord | undefined)
      else setData(result as Pagination<SystemRecord>)
      setOptions(choices)
    } catch (e) {
      if (current === sequence.current)
        setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.")
    } finally {
      if (current === sequence.current) setLoading(false)
    }
  }, [kind, id, filters])
  useEffect(() => {
    void reload()
    return () => {
      sequence.current++
    }
  }, [reload])
  useEffect(() => {
    const listener = () => {
      void reload()
    }
    window.addEventListener("mes:employees-changed", listener)
    return () => window.removeEventListener("mes:employees-changed", listener)
  }, [reload])
  return { filters, setFilters, data, record, options, loading, error, reload }
}
