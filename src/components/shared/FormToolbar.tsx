// src/components/FormToolbar.tsx

import React from "react"

import { Space, Button } from "antd"

import { SyncOutlined, CheckOutlined } from "@ant-design/icons"

export interface FormToolbarProps {
  disabled?: boolean

  saving?: boolean

  onBack?: () => void

  onReset: () => void

  onSave: () => void

  saveText?: string
}

export default function FormToolbar({
  disabled = false,

  saving = false,

  onReset,

  onSave,

  saveText = "Lưu",
}: FormToolbarProps) {
  return (
    <Space wrap>
      <Button
        icon={<SyncOutlined />}
        disabled={disabled || saving}
        onClick={onReset}
      >
        Đặt lại
      </Button>
      <Button
        type="primary"
        icon={<CheckOutlined />}
        disabled={disabled}
        loading={saving}
        onClick={onSave}
      >
        {saveText}
      </Button>
    </Space>
  )
}
