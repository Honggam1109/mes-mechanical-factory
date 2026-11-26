import { useRef, useState } from "react"

import type { ReactNode } from "react"

import { Alert, Button, Modal, Space, Typography, theme } from "antd"

import { ExclamationCircleOutlined } from "@ant-design/icons"

export interface ConfirmDeleteDialogProps {
  open: boolean

  title?: ReactNode

  content: ReactNode

  onCancel: () => void

  onConfirm: () => void | Promise<void>
}

export default function ConfirmDeleteDialog({
  open,
  title = "Xác nhận xóa",
  content,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const { token } = theme.useToken()

  const pending = useRef(false)

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState("")

  const cancel = () => {
    if (!pending.current) {
      setError("")
      onCancel()
    }
  }

  const confirm = async () => {
    if (pending.current) return

    pending.current = true

    setLoading(true)

    setError("")

    try {
      await onConfirm()
      onCancel()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không thể xóa. Vui lòng thử lại.",
      )
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      centered
      width={440}
      onCancel={cancel}
      closable={!loading}
      keyboard={!loading}
      maskClosable={!loading}
      title={
        <Space size={token.marginSM}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: token.borderRadiusLG,
              background: token.colorErrorBg,
              color: token.colorError,
            }}
          >
            <ExclamationCircleOutlined style={{ fontSize: 22 }} />
          </span>
          <span>{title}</span>
        </Space>
      }
      footer={
        <Space size={token.marginXS}>
          <Button disabled={loading} onClick={cancel}>
            Hủy
          </Button>
          <Button type="primary" danger loading={loading} onClick={confirm}>
            Xóa
          </Button>
        </Space>
      }
    >
      <div
        style={{ paddingTop: token.paddingSM, paddingBottom: token.paddingXS }}
      >
        <Typography.Paragraph
          style={{
            marginBottom: error ? token.marginSM : 0,
            color: token.colorTextSecondary,
            overflowWrap: "anywhere",
          }}
        >
          {content}
        </Typography.Paragraph>
        {error && <Alert type="error" showIcon title={error} />}
      </div>
    </Modal>
  )
}
