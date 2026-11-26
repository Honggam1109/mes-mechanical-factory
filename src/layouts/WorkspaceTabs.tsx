import { Tabs, Button, Dropdown, Tooltip } from "antd"
import type { CSSProperties } from "react"
import type { TabsProps } from "antd"
import { DownOutlined, FileTextOutlined, ReloadOutlined } from "@ant-design/icons"
import { getMenuLabel } from "../app/navigation/menuUtils"
import { AppConfig } from "../app/config/theme"
import { MENU_KEYS } from "../app/navigation/menuKeys"
import type { WorkspaceTab } from "../app/navigation/types"

interface WorkspaceTabsProps {
  activeKey: string
  items: WorkspaceTab[]
  onChange: (key: string) => void
  onClose: (key: string) => void
  onRefresh: () => void
}

export default function WorkspaceTabs({ activeKey, items, onChange, onClose, onRefresh }: WorkspaceTabsProps) {
  const onEdit: TabsProps["onEdit"] = (key, action) => {
    if (action === "remove" && typeof key === "string") onClose(key)
  }
  return (
    <div className="workspace-tab-strip" style={{
      "--workspace-primary": AppConfig.theme.light.colors.primary,
      "--workspace-background": AppConfig.theme.light.colors.bgContainer,
      "--workspace-border": AppConfig.theme.light.colors.borderColor,
      "--workspace-text": AppConfig.theme.light.colors.secondaryText,
    } as CSSProperties}>
      <Tabs className="workspace-tabs" hideAdd onChange={onChange} activeKey={activeKey}
        type="editable-card" onEdit={onEdit} items={items.map(item => ({
          ...item,
          label: <span className="workspace-tab-label"><FileTextOutlined />{item.key === MENU_KEYS.PRODUCT_OVERVIEW ? "Tổng quan sản xuất" : getMenuLabel(item.key) || item.label}</span>,
        }))}
        moreIcon={<DownOutlined />}
        style={{ marginBottom: 0 }} tabBarStyle={{ margin: 0, borderBottom: "none" }}
        tabBarExtraContent={<div className="workspace-tab-actions">
          <Tooltip title="Tải lại tab hiện tại"><Button type="text" aria-label="Tải lại tab hiện tại" icon={<ReloadOutlined />} onClick={onRefresh} /></Tooltip>
          <Dropdown disabled={!items.some(item => item.closable !== false)} trigger={["click"]} menu={{ items: [
            { key: "others", label: "Đóng các tab khác", disabled: !items.some(item => item.key !== activeKey && item.closable !== false) },
            { key: "all", label: "Đóng tất cả tab", disabled: !items.some(item => item.closable !== false) },
          ].filter(item => !item.disabled), onClick: ({ key }) => items.forEach(item => {
            if (item.closable !== false && (key === "all" || item.key !== activeKey)) onClose(item.key)
          }) }}>
            <Button type="text" aria-label="Tùy chọn tab" icon={<DownOutlined />} />
          </Dropdown>
        </div>}
      />
    </div>
  )
}
