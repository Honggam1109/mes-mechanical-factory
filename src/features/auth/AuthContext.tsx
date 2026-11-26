import {
  loadSharedProduction,
  clearSharedProduction,
} from "../production/lib/remoteService"
import { landingPath, isAdmin } from "../../app/navigation/access"

import { requestNavigation } from "../../app/navigation/navigationGuard"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { Alert, Button, Spin } from "antd"

import { ApiError, authService } from "../system/service"

import type { AuthUser, LoginRequest, PermissionAction } from "../system/types"

import { employeeService } from "../master-data/employeeService"

import { updateRows } from "../master-data/store"

async function hydrateEmployees(auth: AuthUser) {
  return auth.permissions.PRODUCTION_MONITOR?.includes("VIEW") ||
    auth.permissions.PRODUCTION_EXECUTION?.includes("VIEW") ||
    auth.permissions.PRODUCTION_ASSIGNMENT?.includes("VIEW") ||
    ["VIEW", "CREATE", "UPDATE"].some((action) =>
      auth.permissions.SYSTEM_USER?.some((value) => value === action),
    )
    ? await employeeService.list()
    : []
}

interface AuthState {
  auth: AuthUser | null

  login: (values: LoginRequest) => Promise<void>

  logout: () => Promise<void>

  refresh: () => Promise<void>

  hasPermission: (resource: string, action: PermissionAction) => boolean
}

const Context = createContext<AuthState | null>(null)

export const navigate = (path: string, replace = false, force = false) => {
  const perform = () => {
    window.history[replace ? "replaceState" : "pushState"]({}, "", path)

    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  if (force || path === "/login" || path === "/403") perform()
  else requestNavigation(perform)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const version = useRef(0)

  const [auth, setAuth] = useState<AuthUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("")

  const refresh = async () => {
    const currentVersion = ++version.current

    try {
      const current = await authService.me()

      const employees = await hydrateEmployees(current)

      if (currentVersion !== version.current) return

      updateRows("employees", employees)

      if (
        isAdmin(current) ||
        Object.keys(current.permissions).some((key) =>
          key.startsWith("PRODUCTION_"),
        )
      )
        await loadSharedProduction()
      if (currentVersion !== version.current) return

      setAuth(current)

      setError("")
    } catch (e) {
      if (currentVersion !== version.current) return

      setAuth(null)

      if (!(e instanceof ApiError && e.status === 401))
        setError(
          e instanceof Error ? e.message : "Không thể tải phiên đăng nhập.",
        )
    }
  }

  useEffect(() => {
    void refresh().finally(() => setLoading(false))

    const unauthorized = () => {
      version.current++

      setError("")

      updateRows("employees", [])

      setAuth(null)

      navigate("/login", true)
    }

    const forbidden = () => navigate("/403", true)

    window.addEventListener("mes:unauthorized", unauthorized)

    window.addEventListener("mes:forbidden", forbidden)

    return () => {
      window.removeEventListener("mes:unauthorized", unauthorized)

      window.removeEventListener("mes:forbidden", forbidden)
    }
  }, [])

  useEffect(() => {
    if (!auth) return

    const focus = () => {
      void refresh()
    }

    window.addEventListener("focus", focus)

    const timer = window.setInterval(focus, 60000)

    return () => {
      window.removeEventListener("focus", focus)

      clearInterval(timer)
    }
  }, [!!auth])

  if (loading) return <Spin fullscreen tip="Đang tải phiên đăng nhập..." />

  if (error)
    return (
      <Alert
        type="error"
        title={error}
        action={
          <Button
            onClick={() => {
              setLoading(true)

              void refresh().finally(() => setLoading(false))
            }}
          >
            Thử lại
          </Button>
        }
      />
    )

  return (
    <Context.Provider
      value={{
        auth,

        refresh,

        hasPermission: (resource, action) =>
          !!auth?.permissions[resource]?.includes(action),

        login: async (values) => {
          const currentVersion = ++version.current

          const current = await authService.login(values)

          const employees = await hydrateEmployees(current)

          if (currentVersion !== version.current) return

          updateRows("employees", employees)

          if (
            isAdmin(current) ||
            Object.keys(current.permissions).some((key) =>
              key.startsWith("PRODUCTION_"),
            )
          )
            await loadSharedProduction()
          if (currentVersion !== version.current) return

          setAuth(current)

          setError("")

          navigate(landingPath(current), true)
        },

        logout: async () => {
          version.current++

          await authService.logout()

          clearSharedProduction()

          updateRows("employees", [])

          setAuth(null)

          navigate("/login", true)
        },
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useAuth() {
  const value = useContext(Context)

  if (!value) throw new Error("AuthProvider is required")

  return value
}

export function usePathname() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const listener = () => setPath(window.location.pathname)

    window.addEventListener("popstate", listener)

    return () => window.removeEventListener("popstate", listener)
  }, [])

  return path
}
