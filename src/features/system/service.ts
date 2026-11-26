import type {
  AuthUser,
  EntityKind,
  Filter,
  LoginRequest,
  Pagination,
  SystemRecord,
} from "./types"
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("mes:unauthorized"))
    if (response.status === 403 && path !== "/auth/login")
      window.dispatchEvent(new Event("mes:forbidden"))
    throw new ApiError(
      result.message || "Không thể kết nối hệ thống.",
      response.status,
    )
  }
  return result as T
}
export const authService = {
  login: (values: LoginRequest) =>
    request<AuthUser>("/auth/login", "POST", values),
  me: () => request<AuthUser>("/auth/me"),
  logout: () => request("/auth/logout", "POST", {}),
}
export const systemService = {
  list: <T extends SystemRecord>(kind: EntityKind, filters: Filter = {}) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== "") query.set(key, String(value))
    return request<Pagination<T>>(`/${kind}?${query}`)
  },
  detail: <T extends SystemRecord>(kind: EntityKind, id: string) =>
    request<T>(`/${kind}/${encodeURIComponent(id)}`),
  save: (kind: EntityKind, values: unknown, id?: string) =>
    request<SystemRecord>(
      `/${kind}${id ? `/${encodeURIComponent(id)}` : ""}`,
      id ? "PUT" : "POST",
      values,
    ),
  assign: (
    kind: EntityKind,
    id: string,
    operation: string,
    values: unknown,
    method = "PUT",
  ) =>
    request<SystemRecord>(
      `/${kind}/${encodeURIComponent(id)}/${operation}`,
      method,
      values,
    ),
}
