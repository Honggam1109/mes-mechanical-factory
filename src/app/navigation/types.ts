import type { ReactNode } from "react"
import type { TabsProps } from "antd"
import { MENU_KEYS } from "./menuKeys"

export type ScreenKey = typeof MENU_KEYS[keyof typeof MENU_KEYS]
export interface NavigationItem {
  key: string
  label: string
  icon?: ReactNode
  children?: NavigationItem[]
}
export type WorkspaceTab = NonNullable<TabsProps["items"]>[number]
