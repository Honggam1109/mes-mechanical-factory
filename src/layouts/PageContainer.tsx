import type { ReactNode } from "react"
import { AppConfig } from "../app/config/theme"

export default function PageContainer({ children }: { children: ReactNode }) {
  return <div className="page-container" style={{ padding: 24, overflow: "auto", flex: 1, minHeight: 0, background: AppConfig.theme.light.colors.bgLayout }}>{children}</div>
}
