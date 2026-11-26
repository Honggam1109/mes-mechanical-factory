import StatusTag from "@/components/shared/StatusTag"
import { useState } from "react"

import { Select, 
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from "antd"

import { DeleteOutlined, EditOutlined } from "@ant-design/icons"

import ImportDialog from "../../../components/shared/ImportDialog"

import ExportDialog from "../../../components/shared/ExportDialog"

import DataTable from "../../../components/shared/DataTable"

import DataToolbar from "../../../components/shared/DataToolbar"

import ActionToolbar from "../../../components/shared/ActionToolbar"

import FilterPanel, {
  FilterActions,
} from "../../../components/shared/FilterPanel"

import ConfirmDeleteDialog from "../../../components/shared/ConfirmDeleteDialog"

import { AppConfig } from "../../../app/config/theme"

import { updateRows, useMasterData } from "../../master-data/store"

import { filterUnits, importUnits, saveUnit } from "../lib/unitData"

import {
  unitKinds,
  type Unit,
  type UnitFilters,
  type UnitValues,
} from "../types/unit"

import UnitFormModal from "../components/UnitFormModal"

import { downloadUnits, readUnits } from "../services/unitExcel"

export default function UnitsPage() {
  const references = useMasterData()

  const rows = references.units.map((row) => ({
    ...row,

    status: row.status === "Hoạt động" ? "ACTIVE" : "INACTIVE",
  })) as unknown as Unit[]

  const setRows = (value: Unit[] | ((previous: Unit[]) => Unit[])) =>
    updateRows(
      "units",

      (typeof value === "function" ? value(rows) : value).map((row) => ({
        ...row,

        code: row.name,

        status: row.status === "ACTIVE" ? "Hoạt động" : "Không hoạt động",
      })),
    )

  const [filters, setFilters] = useState<UnitFilters>({}),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [form] = Form.useForm<UnitFilters>()

  const [dialog, setDialog] = useState<{
      record: Unit | null

      readOnly: boolean
    } | null>(null),
    [deleting, setDeleting] = useState<Unit | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [preview, setPreview] = useState<UnitValues[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [exportOpen, setExportOpen] = useState(false)

  const filtered = filterUnits(rows, filters)

  const reset = () => {
    form.resetFields()

    setFilters({})

    setPage(1)
  }

  const exportFile = async (template = false, exportAll = false) => {
    if (busy) return

    setBusy(true)

    try {
      await downloadUnits(template ? [] : exportAll ? rows : filtered, template)

      message.success(
        template ? "Đã tải file mẫu." : "Đã xuất danh sách đơn vị tính.",
      )
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Không thể xuất Excel.")
    } finally {
      setBusy(false)
    }
  }

  const loadFile = async (file: File) => {
    setBusy(true)

    setError("")

    setPreview([])

    try {
      const values = await readUnits(file)

      importUnits(rows, values)

      setPreview(values)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đọc file Excel.")
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      title: "Tên đơn vị",

      dataIndex: "name",

      render: (name: string, row: Unit) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => setDialog({ record: row, readOnly: true })}
        >
          {name}
        </Button>
      ),
    },

    { title: "Nhãn đơn vị", dataIndex: "label" },

    {
      title: "Loại đơn vị",

      dataIndex: "kind",

      render: (kind: string) => {
        const option = unitKinds.find((k) => k.value === kind)

        return <Tag color={option?.color}>{option?.label}</Tag>
      },
    },

    {
      title: "Mô tả đơn vị",

      dataIndex: "description",

      render: (value: string) => value || "—",
    },

    {
      title: "Trạng thái",

      dataIndex: "status",

      render: (status: string) => (
        <StatusTag color={status === "ACTIVE" ? "success" : "default"}>
          {status === "ACTIVE" ? "Sử dụng" : "Ngừng sử dụng"}
        </StatusTag>
      ),
    },

    {
      title: "Hành động",

      width: 140,

      fixed: "right" as const,

      render: (_: unknown, row: Unit) => (
        <Space size={0}>
          <Button
            type="text"
            title="Sửa đơn vị"
            aria-label={`Sửa ${row.name}`}
            icon={<EditOutlined />}
            onClick={() => setDialog({ record: row, readOnly: false })}
          />
          
          <Button
            type="text"
            danger
            title="Xóa đơn vị"
            aria-label={`Xóa ${row.name}`}
            icon={<DeleteOutlined />}
            onClick={() => setDeleting(row)}
          />
        </Space>
      ),
    },
  ]

  return (
    <>
      <FilterPanel>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Đơn vị tính
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Danh mục đơn vị đo lường sản xuất và định mức ({rows.length} bản ghi)
        </Typography.Paragraph>
        <Form
          name="unit-filters"
          form={form}
          layout="vertical"
          onFinish={(values) => {
            setFilters(values)

            setPage(1)
          }}
        >
          <Row gutter={AppConfig.theme.light.layout.filterGap}>
            <Col xs={24} md={8}>
              <Form.Item name="name" label="Tên đơn vị">
                <Input
                  allowClear
                  placeholder="Nhập tên đơn vị..."
                  onPressEnter={() => form.submit()}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="label" label="Nhãn đơn vị">
                <Input
                  allowClear
                  placeholder="Nhập ký hiệu..."
                  onPressEnter={() => form.submit()}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="kind" label="Loại đơn vị">
                <Select
                  allowClear
                  placeholder="Tất cả"
                  options={unitKinds.map((k) => ({
                    value: k.value,

                    label: k.label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  allowClear
                  placeholder="Tất cả"
                  options={[
                    { value: "ACTIVE", label: "Sử dụng" },

                    { value: "INACTIVE", label: "Ngừng sử dụng" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: "right" }}>
            <FilterActions onReset={reset} onSearch={() => form.submit()} />
          </div>
        </Form>
      </FilterPanel>
      <Card bordered={false}>
        <DataToolbar total={filtered.length} recordLabel="đơn vị tính">
          <ActionToolbar
            disabled={busy}
            loading={busy}
            onAdd={() => setDialog({ record: null, readOnly: false })}
            onReload={() => {
              setPage(1)

              message.success("Đã tải lại dữ liệu trong phiên.")
            }}
            onImport={() => {
              setPreview([])

              setError("")

              setImportOpen(true)
            }}
            onExport={() => setExportOpen(true)}
          />
        </DataToolbar>
        <DataTable<Unit>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 1000 }}
          pagination={{
            total: filtered.length,

            current: Math.min(
              page,

              Math.max(1, Math.ceil(filtered.length / size)),
            ),

            pageSize: size,

            onChange: (next, nextSize) => {
              setPage(size === nextSize ? next : 1)

              setSize(nextSize)
            },

            showTotal: (total, range) =>
              `Hiển thị ${range[0]}–${range[1]} trên ${total} bản ghi`,
          }}
        />
      </Card>
      {dialog && (
        <UnitFormModal
          record={dialog.record}
          readOnly={dialog.readOnly}
          onClose={() => setDialog(null)}
          onSave={(values) => {
            setRows(saveUnit(rows, values, dialog.record?.id))

            if (!dialog.record) reset()

            message.success("Đã lưu đơn vị tính trong phiên frontend.")
          }}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          open
          content={
            <>
              Bạn có chắc muốn xóa đơn vị <strong>{deleting.name}</strong>?
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setRows((previous) =>
              previous.filter((row) => row.id !== deleting.id),
            )

            message.success("Đã xóa đơn vị tính.")
          }}
        />
      )}
      <ExportDialog
        open={exportOpen}
        filteredCount={filtered.length}
        totalCount={rows.length}
        onClose={() => setExportOpen(false)}
        onExport={(all) => exportFile(false, all)}
      />
      <ImportDialog
        busy={busy}
        onFile={loadFile}
        onTemplate={() => exportFile(true)}
        onRemoveFile={() => {
          setPreview([])
          setError("")
        }}
        title="Import Excel · Đơn vị tính"
        width={900}
        open={importOpen}
        onCancel={() => {
          if (!busy) setImportOpen(false)
        }}
        okText="Xác nhận thêm mới"
        cancelText="Hủy"
        confirmLoading={busy}
        okButtonProps={{ disabled: busy || !preview.length || !!error }}
        onOk={() => {
          try {
            setRows(importUnits(rows, preview))

            setImportOpen(false)

            reset()

            message.success(`Đã thêm ${preview.length} đơn vị tính.`)
          } catch (e) {
            setError(e instanceof Error ? e.message : "Không thể import.")
          }
        }}
      >
        <p>
          Import chỉ thêm mới. Dùng đúng cột trong file mẫu; tên đơn vị không
          được trùng.
        </p>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            style={{ marginBottom: 16 }}
          />
        )}
        <DataTable<Unit>
          rowKey="id"
          columns={columns.slice(0, -1)}
          dataSource={preview.map((row, index) => ({
            ...row,

            id: String(index),
          }))}
          scroll={{ x: 800 }}
          pagination={{ pageSize: 5 }}
        />
      </ImportDialog>
    </>
  )
}
