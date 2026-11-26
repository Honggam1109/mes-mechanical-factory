import { requestNavigation } from "./navigationGuard"

import { useEffect, useState } from "react"

import { navigate, usePathname, useAuth } from "../../features/auth/AuthContext"
import { canOpenScreen, landingPath } from "./access"

import { keyKinds, pathKey } from "../../features/system/navigation"

import { initialTabs } from "./menuConfig"

import { MENU_KEYS } from "./menuKeys"

import { getMenuLabel, isScreenKey } from "./menuUtils"

import type { ScreenKey, WorkspaceTab } from "./types"

interface WorkspaceState {
  activeKey: ScreenKey

  tabs: WorkspaceTab[]
}

export default function useWorkspaceTabs() {
  const path = usePathname()
  const { auth } = useAuth()

  const [workspace, setWorkspace] = useState<WorkspaceState>({
    activeKey: (pathKey(landingPath(auth)) ||
      MENU_KEYS.PRODUCT_OVERVIEW) as ScreenKey,

    tabs: initialTabs.some((tab) => canOpenScreen(auth, tab.key))
      ? initialTabs.filter((tab) => canOpenScreen(auth, tab.key))
      : [
          {
            key: (pathKey(landingPath(auth)) ||
              MENU_KEYS.PRODUCT_OVERVIEW) as ScreenKey,
            label: getMenuLabel(
              pathKey(landingPath(auth)) || MENU_KEYS.PRODUCT_OVERVIEW,
            ),
            closable: false,
          },
        ],
  })

  const activate = (key: string) => {
    if (!isScreenKey(key)) return

    setWorkspace((previous) => ({
      activeKey: key,

      tabs: previous.tabs.some((tab) => tab.key === key)
        ? previous.tabs
        : [...previous.tabs, { key, label: getMenuLabel(key) || "Tab mới" }],
    }))
  }

  const openScreen = (key: string) => {
    if (!isScreenKey(key)) return

    navigate(
      keyKinds[key]
        ? `/system/${keyKinds[key]}`
        : key === MENU_KEYS.PRODUCT_OVERVIEW
          ? "/dashboard"
          : `/workspace/${key}`,
    )
  }

  useEffect(() => {
    const key = pathKey(path)

    if (key) activate(key)
    else if (path === "/dashboard") activate(MENU_KEYS.PRODUCT_OVERVIEW)
  }, [path])

  const closeTab = (key: string) =>
    requestNavigation(() => {
      if (workspace.activeKey === key) {
        const index = workspace.tabs.findIndex((t) => t.key === key)

        const next = workspace.tabs[index - 1] || workspace.tabs[index + 1]

        if (next)
          navigate(
            keyKinds[next.key]
              ? `/system/${keyKinds[next.key]}`
              : next.key === MENU_KEYS.PRODUCT_OVERVIEW
                ? "/dashboard"
                : `/workspace/${next.key}`,
            false,
            true,
          )
      }

      setWorkspace((previous) => {
        const index = previous.tabs.findIndex((tab) => tab.key === key)

        if (index < 0 || previous.tabs[index].closable === false)
          return previous

        const tabs = previous.tabs.filter((tab) => tab.key !== key)

        const nextKey = tabs[Math.min(index, tabs.length - 1)]?.key

        return {
          tabs,

          activeKey:
            previous.activeKey === key && nextKey && isScreenKey(nextKey)
              ? nextKey
              : previous.activeKey,
        }
      })
    })

  return {
    activeKey: workspace.activeKey,

    tabs: workspace.tabs,

    openScreen,

    closeTab,
  }
}
