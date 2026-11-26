import type { ReactNode } from "react"

import { AppConfig } from "../../app/config/theme"

interface DataToolbarProps {
  total: number

  recordLabel: string

  children: ReactNode
}

export default function DataToolbar({
  total,
  recordLabel,
  children,
}: DataToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: AppConfig.theme.light.layout.sectionGap,
        flexWrap: "wrap",
        gap: AppConfig.theme.light.layout.toolbarGap,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: AppConfig.theme.light.layout.sectionTitleSize,
        }}
      >
        Tổng số:{" "}
        <span style={{ color: AppConfig.theme.light.colors.primary }}>
          {total}
        </span>{" "}
        {recordLabel}
      </div>

      {children}
    </div>
  )
}
