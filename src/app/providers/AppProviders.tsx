import type { ReactNode } from "react"
import { ConfigProvider, theme } from "antd"
import viVN from "antd/locale/vi_VN"
import { AppConfig } from "../config/theme"

export default function AppProviders({ children }: { children: ReactNode }) {
  const { colors, layout } = AppConfig.theme.light
  return (
    <ConfigProvider
      locale={viVN}
      componentSize="middle"
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: colors.primary,
          colorInfo: colors.primary,
          colorLink: colors.primary,
          colorBgLayout: colors.bgLayout,
          colorBgContainer: colors.bgContainer,
          colorBorder: "#b8c2cc",
          colorBorderSecondary: colors.borderColor,
          colorText: "#262626",
          colorTextSecondary: "#595959",
          colorTextPlaceholder: "#737d87",
          fontSize: 14,
          controlHeight: 32,
          borderRadius: layout.borderRadius,
          fontWeightStrong: 600,
        },
        components: {
          Menu: {
            itemSelectedColor: colors.primary,
            itemSelectedBg: "#e8f6f5",
            itemHoverColor: colors.primary,
            itemHoverBg: "#f0faf9",
            itemActiveBg: "#e8f6f5",
            subMenuItemSelectedColor: colors.primary,
          },
          Tabs: {
            itemSelectedColor: colors.primary,
            itemHoverColor: colors.primary,
            itemActiveColor: colors.primary,
            inkBarColor: colors.primary,
          },
          Table: {
            headerBg: "#fafafa",
            headerColor: "#303b47",
            headerSplitColor: "#f0f0f0",
            borderColor: "#f0f0f0",
            cellPaddingBlockMD: 12,
            cellPaddingInlineMD: 16,
            rowHoverBg: "#fafafa",
          },
          Form: { labelColor: "#303b47", itemMarginBottom: 24 },
          Descriptions: { labelColor: "#303b47" },
          Card: { bodyPadding: 24, headerPadding: 24 },
          Layout: { headerBg: colors.bgHeader, siderBg: colors.bgContainer },
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}
