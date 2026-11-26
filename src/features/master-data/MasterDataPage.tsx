import StatusTag from "@/components/shared/StatusTag"
import Select from "@/components/shared/SelectableSelect"
import useUnsavedChanges from "../../components/shared/useUnsavedChanges"

import { useEffect, useRef, useState } from "react"

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Tabs,
  Typography,
  message,
} from "antd"

import { DeleteOutlined, EditOutlined } from "@ant-design/icons"

import FilterPanel, { FilterActions } from "../../components/shared/FilterPanel"

import DataTable from "../../components/shared/DataTable"

import DataToolbar from "../../components/shared/DataToolbar"

import ActionToolbar from "../../components/shared/ActionToolbar"

import FormHeader from "../../components/shared/FormHeader"

import AddButton from "../../components/shared/AddButton"

import ConfirmDeleteDialog from "../../components/shared/ConfirmDeleteDialog"

import ImportDialog from "../../components/shared/ImportDialog"

import ExportDialog from "../../components/shared/ExportDialog"

import { definitions } from "./config"

import ProductionUnitMembers from "./ProductionUnitMembers"

import useWorkspaceLocation from "../../app/navigation/useWorkspaceLocation"

import { ids, statusLabel } from "./rules"

import type { Field, RecordData } from "./config"

import { useAuth } from "../auth/AuthContext"

import { employeeService, canManageEmployees } from "./employeeService"

import {
  isReferenced,
  updateRows,
  useMasterData,
  validateRecord,
} from "./store"

export default function MasterDataPage({ entity }: { entity: string }) {
  const { auth, refresh } = useAuth()

  const employees = entity === "employees"

  const canEdit = !employees || canManageEmployees(auth)

  const [loadError, setLoadError] = useState("")

  const [loading, setLoading] = useState(false)

  const reloadEmployees = async () => {
    setLoading(true)

    setLoadError("")

    try {
      updateRows("employees", await employeeService.list())
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Không thể tải nhân viên.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (employees) void reloadEmployees()
  }, [entity])

  const all = useMasterData()

  const { query } = useWorkspaceLocation()

  const targetRecord = query.get("record")

  const openedTarget = useRef("")

  const [unitTab, setUnitTab] = useState("info")

  const config = definitions[entity]

  const rows = all[entity] ?? []

  const [filterForm] = Form.useForm()

  const [form] = Form.useForm()

  const [filters, setFilters] = useState<Record<string, string>>({})

  const [page, setPage] = useState(1)

  const [size, setSize] = useState(10)

  const [editing, setEditing] = useState<RecordData | null>(null)

  const [formOpen, setFormOpen] = useState(false)

  const [readOnly, setReadOnly] = useState(false)

  const [dirty, setDirty] = useState(false)

  useUnsavedChanges(dirty && formOpen && !readOnly, () => {
    setDirty(false)

    setFormOpen(false)
  })

  const [leaveOpen, setLeaveOpen] = useState(false)

  const [deleting, setDeleting] = useState<RecordData | null>(null)

  const [importOpen, setImportOpen] = useState(false)

  const [preview, setPreview] = useState<RecordData[]>([])

  const [errors, setErrors] = useState<string[]>([])

  const [busy, setBusy] = useState(false)

  const [exportOpen, setExportOpen] = useState(false)

  const kind = Form.useWatch("kind", form)

  const warehouse = Form.useWatch("warehouse", form)

  const productionUnit = Form.useWatch("productionUnit", form)

  const stationStatus = Form.useWatch("status", form)

  const selectedMachines = ids(Form.useWatch("machineIds", form))

  const filtered = rows.filter((record) =>
    Object.entries(filters).every(
      ([key, value]) =>
        !value ||
        (config.fields.find((f) => f.key === key)?.kind === "select"
          ? record[key] === value
          : String(record[key] ?? "")

              .toLowerCase()

              .includes(value.trim().toLowerCase())),
    ),
  )

  const openForm = (record: RecordData | null, view = false) => {
    setUnitTab("info")

    setReadOnly(view)

    setEditing(record)

    setDirty(false)

    setErrors([])

    const defaults: RecordData = {
      id: crypto.randomUUID(),

      code: `${config.prefix}-${String(rows.reduce((max, item) => Math.max(max, Number(String(item.code).split("-").at(-1)) || 0), 0) + 1).padStart(3, "0")}`,

      name: "",

      status: "Hoạt động",

      description: "",

      version: "1",

      quantity: 1,

      productionUnitIds: [],

      kind: config.fields.find((f) => f.key === "kind")?.options?.[0] ?? "",

      values: [],

      details: [],
    }

    form.resetFields()

    form.setFieldsValue(structuredClone(record ?? defaults))

    setFormOpen(true)
  }

  useEffect(() => {
    const token = `${entity}:${targetRecord}`

    if (!targetRecord) {
      openedTarget.current = ""

      return
    }

    const record = rows.find((row) => row.id === targetRecord)

    if (record && openedTarget.current !== token) {
      openedTarget.current = token

      openForm(record, true)
    }
  }, [entity, targetRecord, rows])

  const label = (record: RecordData, f: Field): string =>
    f.key === "status"
      ? statusLabel(entity, record.status)
      : f.key === "machineCount"
        ? String(ids(record.machineIds).length)
        : f.key === "stationCount"
          ? String(
              (all.stations || []).filter(
                (station) =>
                  (entity !== "machines" || station.status === "Hoạt động") &&
                  (entity === "machines"
                    ? ids(station.machineIds).includes(record.id)
                    : station.productionUnit === record.id),
              ).length,
            )
          : f.key === "employeeCount"
            ? String(
                all.employees.filter(
                  (employee) => employee.productionUnitId === record.id,
                ).length,
              )
            : f.key === "duration"
              ? (() => {
                  const minutes = (v: unknown) =>
                    String(v)

                      .split(":")

                      .reduce((h, p) => h * 60 + Number(p), 0)

                  return (
                    String(
                      ((minutes(record.end) - minutes(record.start) + 1440) %
                        1440) -
                        Number(record.breakMinutes || 0),
                    ) + " phút"
                  )
                })()
              : f.kind === "multi-select"
                ? ids(record[f.key])

                    .map(
                      (id) =>
                        all[f.ref!]?.find((item) => item.id === id)?.name || id,
                    )

                    .join(", ")
                : f.ref
                  ? String(
                      all[f.ref]?.find((item) => item.id === record[f.key])
                        ?.name ?? "—",
                    )
                  : typeof record[f.key] === "boolean"
                    ? record[f.key]
                      ? "Có"
                      : "Không"
                    : String(record[f.key] ?? "—")

  const control = (f: Field, filter = false) => {
    if (f.kind === "select" || f.kind === "multi-select") {
      const options = f.ref
        ? (all[f.ref] ?? [])

            .filter(
              (item) =>
                filter ||
                ((entity !== "stations" ||
                  f.kind !== "multi-select" ||
                  (item.productionUnit === productionUnit &&
                    (stationStatus !== "Hoạt động" ||
                      !(all.stations || []).some(
                        (station) =>
                          station.id !== editing?.id &&
                          station.status === "Hoạt động" &&
                          ids(station.machineIds).includes(item.id),
                      )))) &&
                  (item.id !== editing?.id || f.ref !== entity) &&
                  (item.status === "Hoạt động" ||
                    editing?.[f.key] === item.id ||
                    ids(editing?.[f.key]).includes(item.id)) &&
                  (entity !== "locations" ||
                    f.key !== "parent" ||
                    item.warehouse === warehouse)),
            )

            .map((item) => ({
              value: item.id,

              disabled: !filter && item.status !== "Hoạt động",

              label: `${item.code} · ${item.name}`,
            }))
        : f.options?.map((value) => ({
            value,

            label: f.key === "status" ? statusLabel(entity, value) : value,
          }))

      return (
        <Select
          mode={f.kind === "multi-select" && !filter ? "multiple" : undefined}
          allowClear
          showSearch
          optionFilterProp="label"
          options={options}
          placeholder={filter ? "Tất cả" : "Chọn"}
        />
      )
    }

    if (f.kind === "boolean") return <Checkbox>{f.label}</Checkbox>

    if (f.kind === "number")
      return <InputNumber min={f.min ?? 0} style={{ width: "100%" }} />

    if (f.kind === "tags")
      return (
        <Select
          mode="tags"
          tokenSeparators={[","]}
          placeholder="Nhập giá trị rồi nhấn Enter"
        />
      )

    if (f.kind === "textarea")
      return <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />

    return (
      <Input
        type={
          filter
            ? "text"
            : f.kind === "time"
              ? "time"
              : f.kind === "date"
                ? "date"
                : "text"
        }
        disabled={!filter && (f.key === "code" || readOnly || !canEdit || busy)}
        allowClear
        onPressEnter={
          filter
            ? () => {
                setFilters(filterForm.getFieldsValue())

                setPage(1)
              }
            : undefined
        }
      />
    )
  }

  const save = async () => {
    if (busy || !canEdit) return

    setBusy(true)

    try {
      const values = await form.validateFields()

      const record = {
        ...values,

        name: String(values.name ?? "").trim(),

        code: String(values.code ?? "").trim(),

        id: editing?.id ?? values.id,

        updatedAt: new Date().toISOString(),
      } as RecordData

      if (entity === "shifts")
        record.overnight = String(record.end) < String(record.start)

      if (entity === "attributes" && record.kind !== "Danh sách chọn")
        record.values = []

      const issues = validateRecord(entity, record)

      if (issues.length) {
        setErrors(issues)

        return
      }

      if (employees) {
        await employeeService.save(record, !!editing)

        await reloadEmployees()

        await refresh()
      } else
        updateRows(
          entity,

          editing
            ? rows.map((item) => (item.id === editing.id ? record : item))
            : [record, ...rows],
        )

      setFormOpen(false)

      setErrors([])

      setDirty(false)

      message.success(employees ? "Đã lưu nhân viên." : "Đã lưu dữ liệu.")
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "Vui lòng kiểm tra các trường bắt buộc.",
      )
    } finally {
      setBusy(false)
    }
  }

  const excelFields = [
    ...config.fields.filter((f) => f.kind !== "computed"),

    ...(config.details
      ? [{ key: "details", label: `${config.detailLabel} (JSON)` } as Field]
      : []),
  ]

  const exportExcel = async (template = false, exportAll = false) => {
    setBusy(true)

    try {
      const { default: ExcelJS } = await import("exceljs")

      const book = new ExcelJS.Workbook()

      const sheet = book.addWorksheet("Data")

      sheet.addRow(excelFields.map((f) => f.label))

      if (!template)
        (exportAll ? rows : filtered).forEach((record) =>
          sheet.addRow(
            excelFields.map((f) =>
              f.key === "details"
                ? JSON.stringify(
                    ((record.details ?? []) as Record<string, unknown>[]).map(
                      (detail) =>
                        Object.fromEntries(
                          config.details!.map((item) => [
                            item.key,

                            item.ref
                              ? (all[item.ref]?.find(
                                  (reference) =>
                                    reference.id === detail[item.key],
                                )?.code ?? "")
                              : (detail[item.key] ?? ""),
                          ]),
                        ),
                    ),
                  )
                : Array.isArray(record[f.key])
                  ? JSON.stringify(
                      f.kind === "multi-select"
                        ? ids(record[f.key]).map(
                            (id) =>
                              all[f.ref!]?.find((item) => item.id === id)
                                ?.code || id,
                          )
                        : record[f.key],
                    )
                  : f.ref
                    ? (all[f.ref]?.find((item) => item.id === record[f.key])
                        ?.code ?? "")
                    : (record[f.key] ?? ""),
            ),
          ),
        )

      sheet.columns.forEach((column) => {
        column.width = 26
      })

      sheet.getRow(1).font = { bold: true }

      sheet.views = [{ state: "frozen", ySplit: 1 }]

      const buffer = await book.xlsx.writeBuffer()

      const url = URL.createObjectURL(
        new Blob([new Uint8Array(buffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      )

      const link = document.createElement("a")

      link.href = url

      link.download = `${template ? "mau-" : ""}${entity}.xlsx`

      link.click()

      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      message.error("Không xuất được file Excel.")
    } finally {
      setBusy(false)
    }
  }

  const readExcel = async (file: File) => {
    setBusy(true)

    setPreview([])

    setErrors([])

    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("File vượt giới hạn 10 MB.")

      const { default: ExcelJS } = await import("exceljs")

      const book = new ExcelJS.Workbook()

      await book.xlsx.load(await file.arrayBuffer())

      const sheet = book.worksheets[0]

      if (!sheet || sheet.rowCount > 5001 || sheet.columnCount > 100)
        throw new Error("File không hợp lệ hoặc vượt 5.000 dòng / 100 cột.")

      const headers = excelFields.map((f) =>
        sheet

          .getRow(1)

          .getCell(excelFields.indexOf(f) + 1)

          .text.trim(),
      )

      if (headers.some((header, index) => header !== excelFields[index].label))
        throw new Error("Cột không đúng định dạng. Vui lòng sử dụng file mẫu.")

      const imported: RecordData[] = []

      const issues: string[] = []

      let staged = [...rows]

      for (let index = 2; index <= sheet.rowCount; index++) {
        const source = sheet.getRow(index)

        if (!source.hasValues) continue

        const record: RecordData = { id: crypto.randomUUID() }

        for (const [column, f] of excelFields.entries()) {
          const cell = source.getCell(column + 1)

          if (cell.type === 6)
            throw new Error(
              `Dòng ${index}: vui lòng thay công thức bằng giá trị.`,
            )

          const value = cell.text.trim()

          if (
            f.key === "details" ||
            f.kind === "tags" ||
            f.kind === "multi-select"
          ) {
            try {
              const parsed = JSON.parse(value || "[]")

              if (
                !Array.isArray(parsed) ||
                (f.kind === "tags" || f.kind === "multi-select"
                  ? parsed.some((item) => typeof item !== "string")
                  : parsed.some(
                      (item) =>
                        !item ||
                        typeof item !== "object" ||
                        Array.isArray(item),
                    ))
              )
                throw new Error()

              record[f.key] =
                f.kind === "multi-select"
                  ? parsed.map(
                      (value: string) =>
                        all[f.ref!]?.find(
                          (item) => item.code === value || item.id === value,
                        )?.id || value,
                    )
                  : parsed
            } catch {
              issues.push(`Dòng ${index}: ${f.label} cần mảng JSON hợp lệ.`)

              record[f.key] = []
            }
          } else if (f.ref)
            record[f.key] =
              all[f.ref]?.find((item) => item.code === value)?.id ?? value
          else if (f.kind === "number") {
            if (value) record[f.key] = Number(value)
          } else if (f.kind === "boolean") {
            if (!["", "true", "false", "Có", "Không", "1", "0"].includes(value))
              issues.push(`Dòng ${index}: ${f.label} cần true/false.`)

            record[f.key] = ["true", "Có", "1"].includes(value)
          } else
            record[f.key] =
              entity === "operations" &&
              f.key === "status" &&
              value === "Ngừng hoạt động"
                ? "Không hoạt động"
                : value
        }

        if (config.details && Array.isArray(record.details))
          record.details = (record.details as Record<string, unknown>[]).map(
            (detail) =>
              Object.fromEntries(
                config.details!.map((f) => [
                  f.key,

                  f.ref
                    ? (all[f.ref]?.find((item) => item.code === detail[f.key])
                        ?.id ?? detail[f.key])
                    : detail[f.key],
                ]),
              ),
          )

        if (entity === "shifts")
          record.overnight = String(record.end) < String(record.start)

        if (entity === "attributes" && record.kind !== "Danh sách chọn")
          record.values = []

        const found = validateRecord(entity, record, {
          ...all,

          [entity]: staged,
        })

        issues.push(...found.map((issue) => `Dòng ${index}: ${issue}`))

        staged = [...staged, record]

        imported.push(record)
      }

      if (!imported.length) issues.push("File không có dữ liệu.")

      setPreview(imported)

      setErrors(issues)
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Không đọc được file Excel.",
      ])
    } finally {
      setBusy(false)
    }
  }

  const errorList = errors.length ? (
    <Alert
      type="error"
      showIcon
      title="Dữ liệu chưa hợp lệ"
      description={
        <div style={{ maxHeight: 180, overflow: "auto" }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      }
      style={{ marginBottom: 16 }}
    />
  ) : null

  return (
    <>
      {!formOpen ? (
        <>
          <Typography.Title level={4}>{config.title}</Typography.Title>

          {employees && loadError && (
            <Alert
              type="error"
              title={loadError}
              action={
                <Button onClick={() => void reloadEmployees()}>Thử lại</Button>
              }
              style={{ marginBottom: 16 }}
            />
          )}
          <FilterPanel>
            <Form form={filterForm} layout="vertical">
              <Row gutter={24}>
                {config.filters.map((key) => {
                  const f = config.fields.find((item) => item.key === key)!

                  return (
                    <Col xs={24} md={8} key={key}>
                      <Form.Item name={key} label={f.label}>
                        {control(f, true)}
                      </Form.Item>
                    </Col>
                  )
                })}
                <Col span={24} style={{ textAlign: "right" }}>
                  <FilterActions
                    onSearch={() => {
                      setFilters(filterForm.getFieldsValue())

                      setPage(1)
                    }}
                    onReset={() => {
                      filterForm.resetFields()

                      setFilters({})

                      setPage(1)
                    }}
                  />
                </Col>
              </Row>
            </Form>
          </FilterPanel>
          <Card bordered={false}>
            <DataToolbar total={filtered.length} recordLabel="bản ghi">
              <ActionToolbar
                disabled={busy || loading || (employees && !!loadError)}
                readOnly={!canEdit}
                onAdd={() => openForm(null)}
                onReload={() => {
                  if (employees) {
                    void reloadEmployees()

                    return
                  }

                  setPage(1)

                  message.success(
                    "Đã cập nhật danh sách.",
                  )
                }}
                onExport={() => setExportOpen(true)}
                onImport={() => {
                  setPreview([])

                  setErrors([])

                  setImportOpen(true)
                }}
              />
            </DataToolbar>
            <DataTable<RecordData>
              rowKey="id"
              loading={employees && loading}
              dataSource={employees && loadError ? [] : filtered}
              scroll={{ x: 900 }}
              columns={[
                ...(entity === "operations"
                  ? [
                      {
                        title: "STT",

                        width: 60,

                        render: (_: unknown, __: RecordData, index: number) =>
                          (page - 1) * size + index + 1,
                      },
                    ]
                  : []),

                ...config.columns.map((key) => {
                  const f = config.fields.find((item) => item.key === key)!

                  return {
                    title: f.label,

                    dataIndex: key,

                    render: (_: unknown, record: RecordData) =>
                      key === "code" ||
                      (entity === "attributes" && key === "name") ? (
                        <Button
                          type="link"
                          style={{ padding: 0 }}
                          onClick={() => openForm(record)}
                        >
                          {String(record[key])}
                        </Button>
                      ) : key === "status" ? (
                        <StatusTag
                          color={
                            record.status === "Hoạt động"
                              ? "success"
                              : "default"
                          }
                        >
                          {String(record.status)}
                        </StatusTag>
                      ) : (
                        label(record, f)
                      ),
                  }
                }),

                {
                  title: "Thao tác",

                  width: 100,

                  render: (_: unknown, record: RecordData) =>
                    canEdit ? (
                      <Space>
                        
                        <Button
                          type="text"
                          title="Chỉnh sửa"
                          icon={<EditOutlined />}
                          onClick={() => openForm(record)}
                        />
                        <Button
                          type="text"
                          danger
                          title="Xóa"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            if (isReferenced(entity, record.id))
                              message.warning(
                                "Bản ghi đang được tham chiếu. Bạn có thể chỉnh sửa để ngừng sử dụng.",
                              )
                            else setDeleting(record)
                          }}
                        />
                      </Space>
                    ) : null,
                },
              ]}
              pagination={{
                total: filtered.length,

                current: Math.min(
                  page,

                  Math.max(1, Math.ceil(filtered.length / size)),
                ),

                pageSize: size,

                onChange: (next, nextSize) => {
                  setPage(nextSize === size ? next : 1)

                  setSize(nextSize)
                },
              }}
            />
          </Card>
        </>
      ) : (
        <Card bordered={false}>
          <FormHeader
            {...(readOnly
              ? {
                  actions: (
                    <Button onClick={() => setReadOnly(false)}>
                      Chỉnh sửa
                    </Button>
                  ),
                }
              : {})}
            disabled={!canEdit}
            saving={busy}
            onBack={() => (dirty ? setLeaveOpen(true) : setFormOpen(false))}
            onSave={() => void save()}
            onReset={() => {
              openForm(editing)
            }}
          />
          <Typography.Title level={4}>
            {readOnly ? "Chi tiết" : editing ? "Chỉnh sửa" : "Thêm mới"} ·{" "}
            {config.title}
          </Typography.Title>
          {errorList}
          {entity === "productionUnits" && editing && (
            <Tabs
              activeKey={unitTab}
              onChange={setUnitTab}
              items={[
                { key: "info", label: "Thông tin đơn vị" },

                {
                  key: "employees",

                  label: `Nhân viên (${all.employees.filter((row) => row.productionUnitId === editing.id).length})`,

                  children: (
                    <ProductionUnitMembers
                      unitId={editing.id}
                      entity="employees"
                    />
                  ),
                },

                {
                  key: "stations",

                  label: `Trạm sản xuất (${all.stations.filter((row) => row.productionUnit === editing.id).length})`,

                  children: (
                    <ProductionUnitMembers
                      unitId={editing.id}
                      entity="stations"
                    />
                  ),
                },
              ]}
            />
          )}
          <Form
            style={
              entity === "productionUnits" && editing && unitTab !== "info"
                ? { display: "none" }
                : undefined
            }
            form={form}
            layout="vertical"
            disabled={!canEdit || busy || readOnly}
            onValuesChange={(changed) => {
              setDirty(true)

              if (entity === "stations" && "productionUnit" in changed)
                form.setFieldValue("machineIds", [])

              if (
                entity === "attributes" &&
                changed.kind &&
                changed.kind !== "Danh sách chọn"
              )
                form.setFieldValue("values", [])
            }}
          >
            <Form.Item name="id" hidden>
              <Input />
            </Form.Item>
            <Row gutter={24}>
              {config.fields

                .filter(
                  (f) =>
                    f.kind !== "computed" &&
                    (entity !== "attributes" ||
                      f.key !== "values" ||
                      kind === "Danh sách chọn"),
                )

                .map((f) => (
                  <Col
                    key={f.key}
                    xs={24}
                    md={f.kind === "textarea" || f.kind === "tags" ? 24 : 8}
                  >
                    <Form.Item
                      name={f.key}
                      label={f.kind === "boolean" ? " " : f.label}
                      valuePropName={f.kind === "boolean" ? "checked" : "value"}
                      rules={[
                        {
                          type:
                            f.kind === "multi-select" || f.kind === "tags"
                              ? "array"
                              : f.kind === "number"
                                ? "number"
                                : f.kind === "boolean"
                                  ? "boolean"
                                  : "string",

                          required:
                            f.required ||
                            (entity === "attributes" && f.key === "kind"),

                          message: `Vui lòng nhập ${f.label.toLowerCase()}.`,

                          whitespace: f.kind ? undefined : true,
                        },
                      ]}
                    >
                      {control(f)}
                    </Form.Item>
                  </Col>
                ))}
            </Row>
            {entity === "stations" && (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="Một máy chỉ thuộc một trạm đang hoạt động. Chỉ chọn máy thuộc cùng đơn vị sản xuất."
                  style={{ marginBottom: 16 }}
                />
                <DataTable
                  rowKey="id"
                  pagination={false}
                  dataSource={all.machines.filter((machine) =>
                    selectedMachines.includes(machine.id),
                  )}
                  columns={[
                    { title: "Mã máy", dataIndex: "code" },

                    { title: "Tên máy", dataIndex: "name" },

                    {
                      title: "Trạng thái",

                      render: (_, machine) =>
                        statusLabel("machines", machine.status),
                    },

                    ...(!readOnly
                      ? [
                          {
                            title: "Thao tác",

                            render: (_: unknown, machine: RecordData) => (
                              <Button
                                danger
                                disabled={busy || !canEdit}
                                onClick={() => {
                                  form.setFieldValue(
                                    "machineIds",

                                    selectedMachines.filter(
                                      (id) => id !== machine.id,
                                    ),
                                  )

                                  setDirty(true)
                                }}
                              >
                                Gỡ máy
                              </Button>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            )}
            {config.details && (
              <>
                <Typography.Title level={5}>
                  {config.detailLabel}
                </Typography.Title>
                <Form.List name="details">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name: index, ...rest }) => (
                        <Card
                          key={key}
                          size="small"
                          style={{ marginBottom: 12 }}
                        >
                          <Row gutter={16}>
                            {config.details!.map((f) => (
                              <Col xs={24} md={5} key={f.key}>
                                <Form.Item
                                  {...rest}
                                  name={[index, f.key]}
                                  label={f.label}
                                  rules={[
                                    {
                                      required: f.required,

                                      message: "Trường này bắt buộc.",
                                    },
                                  ]}
                                >
                                  {control(f)}
                                </Form.Item>
                              </Col>
                            ))}
                            <Col xs={24} md={4}>
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => {
                                  remove(index)

                                  setDirty(true)
                                }}
                              >
                                Xóa dòng
                              </Button>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <AddButton
                        onClick={() => {
                          add({
                            order: fields.length + 1,

                            quantity: 1,

                            waste: 0,
                          })

                          setDirty(true)
                        }}
                      >
                        Thêm {config.detailLabel?.toLowerCase()}
                      </AddButton>
                    </>
                  )}
                </Form.List>
              </>
            )}
          </Form>
        </Card>
      )}
      <Modal
        title="Thay đổi chưa lưu"
        open={leaveOpen}
        okText="Rời khỏi"
        cancelText="Tiếp tục chỉnh sửa"
        onCancel={() => setLeaveOpen(false)}
        onOk={() => {
          setLeaveOpen(false)

          setFormOpen(false)

          setDirty(false)
        }}
      >
        Rời khỏi sẽ bỏ các thay đổi chưa lưu.
      </Modal>
      {deleting && (
        <ConfirmDeleteDialog
          open
          content={
            <>
              Xóa bản ghi{" "}
              <strong>{String(deleting.name ?? deleting.code)}</strong> khỏi
              danh sách?
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            if (isReferenced(entity, deleting.id))
              throw new Error("Đang được tham chiếu")

            if (employees) {
              try {
                await employeeService.remove(deleting.id)

                await reloadEmployees()
              } catch (error) {
                if (error instanceof Error) message.error(error.message)

                throw error
              }
            } else
              updateRows(
                entity,

                rows.filter((item) => item.id !== deleting.id),
              )
          }}
        />
      )}
      <ExportDialog
        open={exportOpen}
        filteredCount={filtered.length}
        totalCount={rows.length}
        onClose={() => setExportOpen(false)}
        onExport={(all) => exportExcel(false, all)}
      />
      <ImportDialog
        busy={busy}
        onFile={readExcel}
        onRemoveFile={() => {
          setPreview([])

          setErrors([])
        }}
        onTemplate={() => exportExcel(true)}
        title={`Import Excel · ${config.title}`}
        width={900}
        open={importOpen}
        onCancel={() => {
          if (!busy) {
            setImportOpen(false)

            setErrors([])
          }
        }}
        okText="Xác nhận thêm mới"
        cancelText="Hủy"
        confirmLoading={busy}
        okButtonProps={{ disabled: busy || !preview.length || !!errors.length }}
        onOk={async () => {
          if (busy || !canEdit) return

          const staged = [...rows]

          const issues = preview.flatMap((record) => {
            const found = validateRecord(entity, record, {
              ...all,

              [entity]: staged,
            })

            staged.push(record)

            return found
          })

          if (issues.length) {
            setErrors(issues)

            return
          }

          if (employees) {
            setBusy(true)

            try {
              await employeeService.import(preview)

              await reloadEmployees()
            } catch (error) {
              message.error(
                error instanceof Error ? error.message : "Không thể import.",
              )

              return
            } finally {
              setBusy(false)
            }
          } else updateRows(entity, [...preview, ...rows])

          setImportOpen(false)

          setFilters({})

          filterForm.resetFields()

          setPage(1)

          message.success(
            `Đã thêm ${preview.length} bản ghi${employees ? "" : ""}.`,
          )
        }}
      >
        <p>
          Import chỉ thêm mới. Mã trùng sẽ bị chặn. Trường tham chiếu sử dụng mã
          từ danh mục tương ứng; danh sách giá trị và dòng chi tiết dùng mảng
          JSON như file Export.
        </p>
        {errorList}
        <Typography.Paragraph>
          {preview.length} bản ghi trong file
        </Typography.Paragraph>
        <DataTable
          rowKey="id"
          dataSource={preview}
          scroll={{ x: 600 }}
          columns={config.columns.map((key) => {
            const f = config.fields.find((item) => item.key === key)!

            return {
              title: f.label,

              render: (_: unknown, record: RecordData) => label(record, f),
            }
          })}
          pagination={{ pageSize: 5 }}
        />
      </ImportDialog>
    </>
  )
}
