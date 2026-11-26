import AddButton from "./AddButton"

// src/components/ActionToolbar.tsx

import React from "react"

import { Space, Button } from "antd"

import {
  UploadOutlined,
  DownloadOutlined,
  SyncOutlined,
} from "@ant-design/icons"

export interface ActionToolbarProps {
  readOnly?: boolean

  disabled?: boolean

  loading?: boolean

  onAdd?: () => void

  onReload?: () => void

  onImport?: () => void

  onExport?: () => void
}

export default function ActionToolbar({
  readOnly = false,

  disabled = false,

  loading = false,

  onAdd,

  onReload,

  onImport,

  onExport,
}: ActionToolbarProps) {
  return (
    <Space wrap>
      {/* Nút Nhập Excel */}
      {!readOnly && onImport && (
        <Button
          icon={<UploadOutlined />}
          title="Nhập Excel (Import)"
          aria-label="Nhập Excel"
          disabled={disabled || loading}
          onClick={onImport}
        >Nhập Excel</Button>
      )}

      {/* Nút Xuất Excel */}
      {onExport && (
        <Button
          icon={<DownloadOutlined />}
          title="Xuất Excel (Export)"
          aria-label="Xuất Excel"
          disabled={disabled || loading}
          onClick={onExport}
        >Xuất Excel</Button>
      )}

      {/* Nút Tải lại / Reload */}
      <Button
        icon={<SyncOutlined />}
        title="Tải lại bảng"
        aria-label="Tải lại"
        disabled={disabled}
        loading={loading}
        onClick={onReload}
      >Tải lại</Button>

      {/* Nút Thêm mới đơn giản */}
      {!readOnly && onAdd && (
        <AddButton disabled={disabled || loading} onClick={onAdd} />
      )}
    </Space>
  )
}
