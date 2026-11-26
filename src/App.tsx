import { useEffect } from "react"
import { message } from "antd"

import {
  AuthProvider,
  navigate,
  useAuth,
  usePathname,
} from "./features/auth/AuthContext"

import AppProviders from "./app/providers/AppProviders"

import Login from "./features/auth/pages/LoginPage"

import MainLayout from "./layouts/MainLayout"
import { landingPath } from "./app/navigation/access"
import {
  loadSharedProduction,
  clearSharedProduction,
} from "./features/production/lib/remoteService"

export default function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </AppProviders>
  )
}

function AuthenticatedApp() {
  const { auth, logout } = useAuth()
  const path = usePathname()

  useEffect(() => {
    if (!auth && path !== "/login") navigate("/login", true)
    else if (auth && (path === "/login" || path === "/"))
      navigate(landingPath(auth), true)
  }, [auth, path])

  useEffect(() => {
    if (!auth) {
      clearSharedProduction()
      return
    }
    const onError = (event: Event) =>
      message.error((event as CustomEvent<string>).detail)
    window.addEventListener("mes:sync-error", onError)
    const timer = window.setInterval(() => {
      if (
        Object.keys(auth.permissions).some((key) =>
          key.startsWith("PRODUCTION_"),
        )
      )
        void loadSharedProduction().catch(() => {})
    }, 3000)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("mes:sync-error", onError)
    }
  }, [auth?.user.id])

  return auth ? (
    <MainLayout
      onLogout={() => {
        void logout().catch((error) =>
          message.error(
            error instanceof Error
              ? error.message
              : "Không thể đăng xuất. Vui lòng thử lại.",
          ),
        )
      }}
    />
  ) : (
    <Login />
  )
}
