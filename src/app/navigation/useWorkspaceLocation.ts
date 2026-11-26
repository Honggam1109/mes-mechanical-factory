import { useSyncExternalStore } from "react"
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener)
  return () => window.removeEventListener("popstate", listener)
}
export default function useWorkspaceLocation() {
  const location = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.search,
  )
  const [pathname, search = ""] = location.split("?")
  return { pathname, query: new URLSearchParams(search) }
}
