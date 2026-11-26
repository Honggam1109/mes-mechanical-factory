import { menuGroups } from "./menuData"
import { MENU_KEYS } from "./menuKeys"
import type { NavigationItem, ScreenKey } from "./types"

export function isScreenKey(key: string): key is ScreenKey {
  return Object.values(MENU_KEYS).some(value => value === key)
}

export function getMenuLabel(key: string, tree: NavigationItem[] = menuGroups): string {
  for (const node of tree) {
    if (node.key === key) return node.label
    const label = node.children ? getMenuLabel(key, node.children) : ""
    if (label) return label
  }
  return ""
}

export function getMenuParentKeys(key: string, tree: NavigationItem[] = menuGroups): string[] {
  for (const node of tree) {
    if (!node.children) continue
    if (node.children.some(child => child.key === key)) return [node.key]
    const parents = getMenuParentKeys(key, node.children)
    if (parents.length) return [node.key, ...parents]
  }
  return []
}
