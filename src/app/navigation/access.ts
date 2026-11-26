import type { AuthUser } from "../../features/system/types"
import { productionResources } from "../../features/production/lib/access"
import { keyKinds } from "../../features/system/navigation"
import { resources } from "../../features/system/types"

export const isAdmin = (auth: AuthUser | null) =>
  !!auth &&
  ["SYSTEM_USER", "SYSTEM_ROLE"].every((resource) =>
    auth.permissions[resource]?.includes("UPDATE"),
  ) &&
  auth.dataScopes["SYSTEM_USER:WRITE"] === "ALL"

export function canOpenScreen(auth: AuthUser | null, key: string) {
  if (!auth) return false
  const resource =
    productionResources[key] ||
    (keyKinds[key] ? resources[keyKinds[key]] : undefined)
  if (resource) return !!auth.permissions[resource]?.includes("VIEW")
  return isAdmin(auth)
}

export function landingPath(auth: AuthUser | null) {
  if (isAdmin(auth)) return "/dashboard"
  for (const [key, resource] of Object.entries(productionResources))
    if (auth?.permissions[resource]?.includes("VIEW")) {
      // Leaders start at assignment; monitoring remains their second screen.
      if (auth.permissions.PRODUCTION_ASSIGNMENT?.includes("VIEW"))
        return "/workspace/production-assignments"
      return `/workspace/${key}`
    }
  for (const [key, kind] of Object.entries(keyKinds))
    if (auth?.permissions[resources[kind]]?.includes("VIEW"))
      return `/system/${kind}`
  return "/403"
}
