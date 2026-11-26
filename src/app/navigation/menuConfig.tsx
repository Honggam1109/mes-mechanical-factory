import React from "react"

import { InboxOutlined } from "@ant-design/icons"

import type { MenuProps } from "antd"

import { menuGroups } from "./menuData"

import { MENU_KEYS } from "./menuKeys"

import type { NavigationItem, WorkspaceTab } from "./types"

type MenuItem = Required<MenuProps>["items"][number]

function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[],
): MenuItem {
  return { key, icon, children, label } as MenuItem
}

export const initialTabs: WorkspaceTab[] = [
  {
    label: (
      <span>
        <InboxOutlined /> Tổng quan sản xuất
      </span>
    ),
    key: MENU_KEYS.PRODUCT_OVERVIEW,
    closable: false,
  },
]

export const getMenuItems = (
  visible: (key: string) => boolean = () => true,
): MenuProps["items"] => {
  const prune = (items: NavigationItem[]): NavigationItem[] =>
    items.flatMap((item) => {
      const children = item.children ? prune(item.children) : undefined
      return children
        ? children.length
          ? [{ ...item, children }]
          : []
        : visible(item.key)
          ? [item]
          : []
    })

  const mapItems = (items: NavigationItem[]): MenuItem[] =>
    items.map((item) =>
      getItem(
        item.label,
        item.key,
        item.icon,
        item.children ? mapItems(item.children) : undefined,
      ),
    )

  return mapItems(prune(menuGroups))
}
