export type Status = "ACTIVE" | "INACTIVE"
export type PermissionAction = "VIEW" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "RELEASE" | "ASSIGN" | "EXECUTE" | "START" | "PAUSE" | "RESUME" | "COMPLETE" | "RESET_PASSWORD" | "LOCK"
export const actions: PermissionAction[] = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE",
  "EXPORT",
  "RELEASE",
  "ASSIGN",
  "EXECUTE",
  "START",
  "PAUSE",
  "RESUME",
  "COMPLETE",
  "RESET_PASSWORD",
  "LOCK",
]
export interface EmployeeSummary {
  id: string
  code: string
  fullName: string
  email: string
  phone: string
  productionTeamId: string | null
  productionTeamName: string
}
export interface Audit {
  id: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  status: Status
}
export interface User extends Audit {
  username: string
  fullName: string
  email: string
  avatar?: string
  employeeId?: string
  employee: EmployeeSummary | null
  roleIds: string[]
}
export interface Role extends Audit {
  code: string
  name: string
  description: string
  userIds: string[]
  userCount: number
  permissions: Record<string, PermissionAction[]>
  dataPermissionIds: string[]
}
export interface Permission extends Audit {
  code: string
  name: string
  module: string
  route: string
  actions: PermissionAction[]
}
export interface DataPermission extends Audit {
  code: string
  name: string
  resource: string
  accessType: "VIEW" | "WRITE"
  scope: "ALL" | "PRODUCTION_TEAM" | "SELF"
}
export interface AuthUser {
  user: User
  employee: EmployeeSummary | null
  roles: Role[]
  permissions: Record<string, PermissionAction[]>
  dataScopes: Record<string, DataPermission["scope"]>
}
export interface LoginRequest {
  username: string
  password: string
  remember?: boolean
}
export type LoginResponse = AuthUser
export interface Pagination<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export type EntityKind = "users" | "roles" | "permissions" | "data-permissions"
export type SystemRecord = User | Role | Permission | DataPermission
export interface Filter {
  username?: string
  fullName?: string
  email?: string
  status?: Status
  roleId?: string
  keyword?: string
  page?: number
  pageSize?: number
}
export const resources: Record<EntityKind, string> = {
  users: "SYSTEM_USER",
  roles: "SYSTEM_ROLE",
  permissions: "SYSTEM_PERMISSION",
  "data-permissions": "SYSTEM_DATA_PERMISSION",
}
export const labels: Record<EntityKind, string> = {
  users: "Người dùng",
  roles: "Vai trò",
  permissions: "Quyền chức năng",
  "data-permissions": "Quyền dữ liệu",
}
