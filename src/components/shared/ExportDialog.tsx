import { useEffect, useState } from "react"
import { Modal, Radio, message } from "antd"

interface Props {
  open: boolean
  filteredCount: number
  totalCount: number
  onClose: () => void
  onExport: (all: boolean) => Promise<void>
}
export default function ExportDialog({
  open,
  filteredCount,
  totalCount,
  onClose,
  onExport,
}: Props) {
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setAll(false)
  }, [open])
  return (
    <Modal
      title="Xuất Excel"
      open={open}
      okText="Xuất file"
      cancelText="Hủy"
      confirmLoading={busy}
      cancelButtonProps={{ disabled: busy }}
      onCancel={busy ? undefined : onClose}
      onOk={async () => {
        if (busy) return
        setBusy(true)
        try {
          await onExport(all)
          onClose()
        } catch (error) {
          message.error(
            error instanceof Error ? error.message : "Không thể xuất Excel.",
          )
        } finally {
          setBusy(false)
        }
      }}
    >
      <Radio.Group
        value={all}
        disabled={busy}
        onChange={(event) => setAll(event.target.value)}
      >
        <p>
          <Radio value={false}>
            Theo bộ lọc hiện tại ({filteredCount} bản ghi)
          </Radio>
        </p>
        <p>
          <Radio value={true}>
            Tất cả dữ liệu được phép xem ({totalCount} bản ghi)
          </Radio>
        </p>
      </Radio.Group>
    </Modal>
  )
}
