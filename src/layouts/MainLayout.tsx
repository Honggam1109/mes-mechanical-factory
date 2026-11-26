import { requestNavigation } from "../app/navigation/navigationGuard"
import { canOpenScreen, landingPath, isAdmin } from "../app/navigation/access"

import { useEffect, useState } from "react"

import { Alert, Button, Drawer, Grid, Layout, Result } from "antd"

import { navigate, useAuth, usePathname } from "../features/auth/AuthContext"

import { keyKinds, pathKey } from "../features/system/navigation"

import { resources } from "../features/system/types"

import AppSidebar from "./AppSidebar"

import AppHeader from "./AppHeader"

import WorkspaceTabs from "./WorkspaceTabs"

import PageContainer from "./PageContainer"

import { isScreenKey } from "../app/navigation/menuUtils"

import useWorkspaceTabs from "../app/navigation/useWorkspaceTabs"

import { renderWorkspaceScreen } from "../app/navigation/screenRegistry"

export default function MainLayout({ onLogout }: { onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [syncError, setSyncError] = useState("")
  useEffect(() => {
    const listener = (event: Event) =>
      setSyncError((event as CustomEvent<string>).detail)
    window.addEventListener("mes:sync-state", listener)
    return () => window.removeEventListener("mes:sync-state", listener)
  }, [])

  const [screenVersions, setScreenVersions] = useState<Record<string, number>>(
    {},
  )

  const screens = Grid.useBreakpoint()

  const isMobile = screens.md === false

  const { activeKey, tabs, openScreen, closeTab } = useWorkspaceTabs()

  const { hasPermission, auth } = useAuth(),
    path = usePathname()

  useEffect(() => {
    if (path === "/dashboard" && !isAdmin(auth)) {
      navigate(landingPath(auth), true)
      return
    }
    const key = pathKey(path),
      kind = key ? keyKinds[key] : undefined

    if (
      key &&
      (!canOpenScreen(auth, key) ||
        (kind &&
          path.split("/")[3] === "new" &&
            !hasPermission(resources[kind], "CREATE")))
    )
      navigate("/403", true)
  }, [path, hasPermission])

  return (
    <Layout style={{ minHeight: "100dvh" }}>
      {isMobile ? (
        <Drawer
          open={mobileMenuOpen}
          placement="left"
          width={256}
          onClose={() => setMobileMenuOpen(false)}
          closable={false}
          styles={{ body: { padding: 0 } }}
        >
          <AppSidebar
            collapsed={false}
            activeKey={activeKey}
            onNavigate={(key) => {
              openScreen(key)

              setMobileMenuOpen(false)
            }}
          />
        </Drawer>
      ) : (
        <AppSidebar
          collapsed={collapsed}
          activeKey={activeKey}
          onNavigate={openScreen}
        />
      )}
      <Layout style={{ minWidth: 0 }}>
        <AppHeader
          collapsed={isMobile ? !mobileMenuOpen : collapsed}
          setCollapsed={
            isMobile ? (value) => setMobileMenuOpen(!value) : setCollapsed
          }
          onLogout={onLogout}
        />
        <Layout.Content
          style={{
            display: "flex",

            flexDirection: "column",

            height: "calc(100dvh - 64px)",

            overflow: "hidden",
          }}
        >
          <WorkspaceTabs
            activeKey={activeKey}
            items={tabs}
            onChange={openScreen}
            onClose={closeTab}
            onRefresh={() =>
              requestNavigation(() =>
                setScreenVersions((previous) => ({
                  ...previous,

                  [activeKey]: (previous[activeKey] || 0) + 1,
                })),
              )
            }
          />
          {syncError && <Alert type="warning" showIcon title={syncError} />}
          <PageContainer>
            {path === "/403" ? (
              <Result
                status="403"
                title="403"
                subTitle="Bạn không có quyền thực hiện thao tác này."
                extra={
                  <Button onClick={() => navigate("/dashboard")}>
                    Về Dashboard
                  </Button>
                }
              />
            ) : path !== "/dashboard" &&
              path !== "/" &&
              !path.startsWith("/workspace/") &&
              !/^\/system\/(users|roles|permissions|data-permissions)(\/[^/]+)?\/?$/.test(
                path,
              ) ? (
              <Result
                status="404"
                title="404"
                subTitle="Không tìm thấy trang."
              />
            ) : (
              <>
                {tabs.map((tab) =>
                  isScreenKey(tab.key) ? (
                    <div
                      key={`${tab.key}-${screenVersions[tab.key] || 0}`}
                      style={{
                        display: activeKey === tab.key ? "block" : "none",

                        height: "100%",
                      }}
                    >
                      {!canOpenScreen(auth, tab.key) ? (
                        <Result
                          status="403"
                          title="403"
                          subTitle="Bạn không có quyền thực hiện thao tác này."
                        />
                      ) : (
                        renderWorkspaceScreen(tab.key, openScreen)
                      )}
                    </div>
                  ) : null,
                )}
              </>
            )}
          </PageContainer>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
