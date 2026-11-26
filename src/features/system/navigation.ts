import type { EntityKind } from "./types"
export const systemKeys: Record<EntityKind, string> = {
  users: "sys-users",
  roles: "sys-roles",
  permissions: "sys-func-permissions",
  "data-permissions": "sys-data-permissions",
}
export const keyKinds = Object.fromEntries(
  Object.entries(systemKeys).map(([kind, key]) => [key, kind]),
) as Record<string, EntityKind>
export function pathKey(path: string) {
  const match =
    /^\/system\/(users|roles|permissions|data-permissions)(?:\/[^/]+)?\/?$/.exec(
      path,
    )
  return match
    ? systemKeys[(match[1] as EntityKind)]
    : path.startsWith("/workspace/")
      ? path.slice(11)
      : undefined
}
