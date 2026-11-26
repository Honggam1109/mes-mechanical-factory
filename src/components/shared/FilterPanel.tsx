import type { ReactNode } from "react"

import { Card, Space, Button } from "antd"

import { SearchOutlined, SyncOutlined } from "@ant-design/icons"

import { AppConfig } from "../../app/config/theme"

interface FilterPanelProps {
  children: ReactNode
}

interface FilterActionsProps {
  onSearch: () => void

  onReset: () => void

  disabled?: boolean

  loading?: boolean
}

export function FilterActions({
  onSearch,
  onReset,
  disabled = false,
  loading = false,
}: FilterActionsProps) {
  return (
    <Space wrap>
      <Button
        icon={<SyncOutlined />}
        disabled={disabled || loading}
        onClick={onReset}
      >
        Đặt lại
      </Button>
      <Button
        type="primary"
        icon={<SearchOutlined />}
        disabled={disabled}
        loading={loading}
        onClick={onSearch}
      >
        Tìm kiếm
      </Button>
    </Space>
  )
}

export default function FilterPanel({ children }: FilterPanelProps) {
  return (
    <Card
      className="filter-panel"
      style={{ marginBottom: AppConfig.theme.light.layout.sectionGap }}
    >
      {children}
    </Card>
  )
}
