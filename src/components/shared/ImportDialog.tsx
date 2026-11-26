import { useEffect, useState } from "react"
import { Button, Modal, Upload } from "antd"
import type { ModalProps } from "antd"
import { InboxOutlined } from "@ant-design/icons"

interface Props extends ModalProps {
  busy?: boolean
  onFile: (file: File) => void | Promise<void>
  onRemoveFile: () => void
  onTemplate: () => void | Promise<void>
}
export default function ImportDialog({
  busy,
  onFile,
  onRemoveFile,
  onTemplate,
  children,
  ...props
}: Props) {
  const [filename, setFilename] = useState("")
  useEffect(() => {
    if (!props.open) setFilename("")
  }, [props.open])
  return (
    <Modal
      width={900}
      okText="Xác nhận nhập"
      cancelText="Hủy"
      confirmLoading={busy}
      cancelButtonProps={{ disabled: busy }}
      {...props}
    >
      <Button
        disabled={busy}
        onClick={() => void onTemplate()}
        style={{ marginBottom: 12 }}
      >
        Tải file mẫu
      </Button>
      <Upload.Dragger
        accept=".xlsx"
        multiple={false}
        maxCount={1}
        disabled={busy}
        showUploadList={false}
        beforeUpload={(file) => {
          setFilename(file.name)
          void onFile(file)
          return false
        }}
        style={{ marginBottom: 16 }}
      >
        <p>
          <InboxOutlined />
        </p>
        <p>Kéo thả hoặc bấm để chọn file .xlsx</p>
      </Upload.Dragger>
      {filename && (
        <p>
          {filename}{" "}
          <Button
            type="link"
            danger
            disabled={busy}
            onClick={() => {
              setFilename("")
              onRemoveFile()
            }}
          >
            Gỡ file
          </Button>
        </p>
      )}
      {children}
    </Modal>
  )
}
