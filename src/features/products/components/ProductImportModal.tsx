import { useState } from "react"

import { Alert, Button, Modal, Space, Table, Typography } from "antd"

import ImportDialog from "../../../components/shared/ImportDialog"

import { decodeProducts, downloadProducts } from "../services/productExcel"

import { validateProductImport } from "../lib/productImport"

import type { ProductImportPreview } from "../lib/productImport"

import type { Product } from "../types/product"

interface Props {
  open: boolean

  products: Product[]

  onClose: () => void

  onImport: (preview: ProductImportPreview) => void
}

export default function ProductImportModal({
  open,

  products,

  onClose,

  onImport,
}: Props) {
  const [busy, setBusy] = useState(false)

  const [error, setError] = useState("")

  const [fileName, setFileName] = useState("")

  const [source, setSource] = useState<{
    headers: string[]

    rows: string[][]
  } | null>(null)

  const preview = source
    ? validateProductImport(source.headers, source.rows, products)
    : null

  const readFile = async (file?: File) => {
    if (!file) return

    setSource(null)

    setError("")

    setFileName(file.name)

    if (!/\.xlsx$/i.test(file.name)) {
      setError("Chỉ hỗ trợ file .xlsx.")

      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File tối đa 5 MB.")

      return
    }

    setBusy(true)

    try {
      setSource(await decodeProducts(await file.arrayBuffer()))
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không đọc được file Excel.",
      )
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = async () => {
    setBusy(true)

    setError("")

    try {
      await downloadProducts([], "mau-nhap-san-pham.xlsx")
    } catch {
      setError("Không tạo được file mẫu.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ImportDialog
      busy={busy}
      onFile={readFile}
      onTemplate={downloadTemplate}
      onRemoveFile={() => {
        setSource(null)

        setError("")

        setFileName("")
      }}
      title="Nhập Excel sản phẩm"
      open={open}
      onCancel={busy ? undefined : onClose}
      width={800}
      okText="Xác nhận nhập"
      cancelText="Hủy"
      confirmLoading={busy}
      okButtonProps={{
        disabled:
          busy ||
          !preview ||
          preview.issues.length > 0 ||
          preview.rows.length === 0,
      }}
      cancelButtonProps={{ disabled: busy }}
      onOk={() => {
        if (preview && !preview.issues.length) {
          try {
            onImport(preview)
            onClose()
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Không thể nhập dữ liệu.",
            )
          }
        }
      }}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Text>
          Chọn file .xlsx theo mẫu. Mã mới sẽ được thêm; mã đã tồn tại sẽ cập
          nhật 6 cột trong file. Phân loại: Thành phẩm, Bán thành phẩm, Linh
          kiện / Vật tư. Trạng thái: Hoạt động, Ngừng hoạt động.
        </Typography.Text>
        {error && <Alert type="error" showIcon title={error} />}
        {preview &&
          (preview.issues.length ? (
            <>
              <Alert
                type="error"
                showIcon
                title={`Có ${preview.issues.length} lỗi. Chưa nhập bất kỳ dữ liệu nào.`}
              />
              <Table
                size="small"
                rowKey={(_, index) => String(index)}
                dataSource={preview.issues}
                columns={[
                  { title: "Dòng", dataIndex: "row", width: 70 },

                  { title: "Lỗi", dataIndex: "message" },
                ]}
                pagination={{ pageSize: 5 }}
              />
            </>
          ) : (
            <>
              <Alert
                type="info"
                showIcon
                title={`Thêm ${preview.added} sản phẩm, cập nhật ${preview.updated} sản phẩm. Nhấn Xác nhận nhập để áp dụng.`}
              />
              <Table
                size="small"
                rowKey="code"
                dataSource={preview.rows}
                scroll={{ x: 600 }}
                pagination={{ pageSize: 5 }}
                columns={[
                  { title: "Mã sản phẩm", dataIndex: "code" },

                  { title: "Tên sản phẩm", dataIndex: "name" },

                  { title: "Phân loại", dataIndex: "category" },

                  { title: "Trạng thái", dataIndex: "status" },
                ]}
              />
            </>
          ))}
      </Space>
    </ImportDialog>
  )
}
