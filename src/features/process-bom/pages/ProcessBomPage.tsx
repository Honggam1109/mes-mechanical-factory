import StatusTag from "@/components/shared/StatusTag"
import { useState } from "react"

import { Select, 
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Result,
  Row,
  Space,
  Typography,
  message,
  Modal,
} from "antd"

import {
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  } from "@ant-design/icons"

import DataTable from "../../../components/shared/DataTable"

import DataToolbar from "../../../components/shared/DataToolbar"

import ActionToolbar from "../../../components/shared/ActionToolbar"

import FilterPanel, {
  FilterActions,
} from "../../../components/shared/FilterPanel"

import ConfirmDeleteDialog from "../../../components/shared/ConfirmDeleteDialog"

import ImportDialog from "../../../components/shared/ImportDialog"

import ExportDialog from "../../../components/shared/ExportDialog"

import { useMasterData, updateRows } from "../../master-data/store"

import type { RecordData } from "../../master-data/config"

import useWorkspaceLocation from "../../../app/navigation/useWorkspaceLocation"

import { navigate } from "../../auth/AuthContext"

import {
  bomLines,
  routeSteps,
  text,
  lifecycleLabel,
  routeCatalog,
} from "../lib/model"

import {
  importConfigurations,
  newRouteVersion,
  transitionRoute,
  type ConfigurationKind,
} from "../lib/service"

import { decodeConfigurations, downloadConfigurations } from "../lib/excel"

import ConfigurationEditor from "../components/ConfigurationEditor"

export default function ProcessBomPage({ kind }: { kind: ConfigurationKind }) {
  const all = useMasterData(),
    { query } = useWorkspaceLocation(),
    [form] = Form.useForm(),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [deleting, setDeleting] = useState<RecordData>(),
    [importOpen, setImportOpen] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [preview, setPreview] = useState<RecordData[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState<string[]>([])

  const base = `/workspace/${
      kind === "boms" ? "master-boms" : "master-routes"
    }`,
    id = query.get("record"),
    isNew = query.get("new") === "1",
    record = all[kind].find((row) => row.id === id),
    title = kind === "boms" ? "Định mức BOM" : "Quy trình công nghệ"

  const grouped =
    kind === "boms"
      ? all.boms
      : [...new Set(all.routes.map((row) => String(row.code)))].flatMap(
          (code) => {
            const versions = all.routes
              .filter(
                (row) =>
                  row.code === code &&
                  (!filters.lifecycle || row.lifecycle === filters.lifecycle),
              )
              .sort(
                (a, b) =>
                  Number.parseFloat(String(b.version)) -
                  Number.parseFloat(String(a.version)),
              )
            return versions.length
              ? [
                  versions.find((row) => row.lifecycle === "ACTIVE") ||
                    versions[0],
                ]
              : []
          },
        )

  const filtered = grouped.filter(
    (row) =>
      (!filters.code ||
        text(row.code)

          .toLowerCase()

          .includes(filters.code.trim().toLowerCase())) &&
      (!filters.name ||
        text(row.name)

          .toLowerCase()

          .includes(filters.name.trim().toLowerCase())) &&
      (!filters.product || row.product === filters.product) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.operation ||
        routeSteps(row).some((step) => step.operation === filters.operation)),
  )

  const open = (row: RecordData) =>
    navigate(`${base}?record=${encodeURIComponent(row.id)}&mode=edit`)

  const openVersion = (id: string) =>
    navigate(`${base}?record=${encodeURIComponent(id)}&mode=edit`)

  const fork = (row: RecordData) => {
    try {
      openVersion(newRouteVersion(row.id).id)
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "Không thể tạo phiên bản.",
      )
    }
  }

  const change = (row: RecordData, action: "APPLY" | "ARCHIVE") =>
    Modal.confirm({
      title:
        action === "APPLY"
          ? `Áp dụng ${row.code} V${row.version}?`
          : "Lưu trữ phiên bản?",
      content: "Các phiên bản đã áp dụng được giữ nguyên trong lịch sử.",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: () => {
        try {
          transitionRoute(row.id, action)
          message.success("Đã cập nhật trạng thái phiên bản.")
        } catch (error) {
          message.error(
            error instanceof Error ? error.message : "Không thể cập nhật.",
          )
          throw error
        }
      },
    })

  if (id || isNew) {
    if (id && !record)
      return (
        <Result
          status="404"
          title="Không tìm thấy bản ghi"
          extra={<Button onClick={() => navigate(base)}>Về danh sách</Button>}
        />
      )

    return (
      <ConfigurationEditor
        key={`${kind}-${id || "new"}-${record?.lifecycle}-${query.get("mode")}`}
        kind={kind}
        all={all}
        record={record}
        isNew={isNew}
        readOnly={
          query.get("mode") === "view" ||
          (kind === "routes" && !!record && record.lifecycle !== "DRAFT")
        }
        onVersion={openVersion}
        onBack={() => navigate(base)}
        onSaved={() => navigate(base)}
        onEdit={() => record && open(record)}
      />
    )
  }

  const productCell = (row: RecordData) => {
    const product = (
      kind === "routes" ? routeCatalog(row, all) : all
    ).products.find((item) => item.id === row.product)

    return (
      <Button
        type="link"
        style={{
          padding: 0,

          height: "auto",

          textAlign: "left",

          whiteSpace: "normal",
        }}
        onClick={() =>
          navigate(
            `/workspace/products-list?record=${encodeURIComponent(text(row.product))}`,
          )
        }
      >
        {text(product?.name) || "Sản phẩm không còn tồn tại"}
        <br />
        <Typography.Text type="secondary">
          {text(product?.code)}
        </Typography.Text>
      </Button>
    )
  }

  const columns = [
    {
      title: "STT",

      width: 65,

      render: (_: unknown, _row: RecordData, index: number) =>
        (page - 1) * size + index + 1,
    },

    {
      title: kind === "boms" ? "Mã BOM" : "Mã quy trình",

      dataIndex: "code",

      render: (code: unknown, row: RecordData) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => open(row)}>
          {text(code)}
        </Button>
      ),
    },

    ...(kind === "routes"
      ? [{ title: "Tên quy trình", dataIndex: "name" }]
      : []),

    {
      title: "Sản phẩm",

      render: (_: unknown, row: RecordData) => productCell(row),
    },

    ...(kind === "boms"
      ? [
          { title: "Số lượng cơ sở", dataIndex: "quantity" },
          {
            title: "Số thành phần",
            render: (_: unknown, row: RecordData) => bomLines(row).length,
          },
        ]
      : [
          {
            title: "Công đoạn",
            render: (_: unknown, row: RecordData) =>
              routeSteps(row)
                .map((step) =>
                  String(
                    routeCatalog(row, all).operations.find(
                      (operation) => operation.id === step.operation,
                    )?.name || "",
                  ),
                )
                .join(" → "),
          },

          {
            title: "Định mức nguyên vật liệu (BOM)",
            render: (_: unknown, row: RecordData) => (
              <Button
                type="link"
                onClick={() =>
                  navigate(
                    `/workspace/master-boms?record=${encodeURIComponent(String(row.bom))}&mode=edit`,
                  )
                }
              >
                {String(
                  routeCatalog(row, all).boms.find((bom) => bom.id === row.bom)
                    ?.code || "Chưa chọn BOM",
                )}
              </Button>
            ),
          },

          {
            title: "Phiên bản hiện hành",
            render: (_: unknown, row: RecordData) => (
              <>
                <strong>V{String(row.version)}</strong>
                <br />
                {row.appliedAt
                  ? new Date(String(row.appliedAt)).toLocaleDateString("vi-VN")
                  : "—"}
              </>
            ),
          },

          {
            title: "Trạng thái phiên bản",
            render: (_: unknown, row: RecordData) => (
              <StatusTag
                color={
                  row.lifecycle === "ACTIVE"
                    ? "success"
                    : row.lifecycle === "DRAFT"
                      ? "orange"
                      : "default"
                }
              >
                {lifecycleLabel(row.lifecycle)}
              </StatusTag>
            ),
          },
        ]),

    {
      title: "Trạng thái sử dụng",

      render: (_: unknown, row: RecordData) => (
        <StatusTag color={row.status === "Hoạt động" ? "success" : "default"}>
          {row.status === "Hoạt động" ? "Hoạt động" : "Ngừng hoạt động"}
        </StatusTag>
      ),
    },

    {
      title: "Thao tác",

      width: 240,

      render: (_: unknown, row: RecordData) => (
        <Space>
          {(kind !== "routes" || row.lifecycle === "DRAFT") && <Button type="text" title="Sửa" aria-label={`Sửa ${row.code}`} icon={<EditOutlined />} onClick={() => open(row)} />}
          {kind === "routes" && (
            <>
              <Button
                type="text"
                title="Tạo phiên bản mới"
                icon={<CopyOutlined />}
                onClick={() => fork(row)}
              />
              {row.lifecycle === "DRAFT" && (
                <Button size="small" onClick={() => change(row, "APPLY")}>
                  Áp dụng
                </Button>
              )}
              {row.lifecycle === "ACTIVE" && (
                <Button size="small" onClick={() => change(row, "ARCHIVE")}>
                  Lưu trữ
                </Button>
              )}
            </>
          )}
          {(kind === "boms" || row.lifecycle === "DRAFT") && (
            <Button
              type="text"
              danger
              title="Xóa"
              aria-label={`Xóa ${row.code}`}
              icon={<DeleteOutlined />}
              onClick={() => setDeleting(row)}
            />
          )}
        </Space>
      ),
    },
  ]

  const file = async (file: File) => {
    setPreview([])

    setError("")

    setBusy(true)

    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024)
        throw new Error("Chọn file .xlsx tối đa 5 MB.")

      setPreview(
        await decodeConfigurations(await file.arrayBuffer(), kind, all),
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể đọc file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FilterPanel>
        <Typography.Title level={4}>{title}</Typography.Title>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item
                name="code"
                label={kind === "boms" ? "Mã BOM" : "Mã quy trình"}
              >
                <Input placeholder="Nhập mã cần tìm…" />
              </Form.Item>
            </Col>
            {kind === "routes" && (
              <Col xs={24} md={6}>
                <Form.Item name="name" label="Tên quy trình">
                  <Input placeholder="Nhập tên quy trình…" />
                </Form.Item>
              </Col>
            )}
            {kind === "routes" && (
              <>
                <Col xs={24} md={6}>
                  <Form.Item name="operation" label="Công đoạn">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Tất cả"
                      options={all.operations.map((operation) => ({
                        value: operation.id,
                        label: String(operation.name),
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="lifecycle" label="Trạng thái phiên bản">
                    <Select
                      allowClear
                      placeholder="Tất cả"
                      options={["DRAFT", "ACTIVE", "ARCHIVED"].map((value) => ({
                        value,
                        label: lifecycleLabel(value),
                      }))}
                    />
                  </Form.Item>
                </Col>
              </>
            )}
            <Col xs={24} md={6}>
              <Form.Item name="product" label="Sản phẩm">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả"
                  options={all.products.map((product) => ({
                    value: product.id,

                    label: `${product.code} · ${product.name}`,
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
                    { value: "Hoạt động", label: "Hoạt động" },

                    { value: "Không hoạt động", label: "Ngừng hoạt động" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col
              span={24}
              style={{
                display: "flex",

                justifyContent: "flex-end",

                marginBottom: 16,
              }}
            >
              <FilterActions
                onSearch={() => {
                  setFilters(form.getFieldsValue())

                  setPage(1)
                }}
                onReset={() => {
                  form.resetFields()

                  setFilters({})

                  setPage(1)
                }}
              />
            </Col>
          </Row>
        </Form>
      </FilterPanel>
      <Card bordered={false} style={{ marginTop: 16 }}>
        {kind === "routes" && (
          <Button
            style={{ marginBottom: 12 }}
            onClick={() =>
              setExpanded(expanded.length ? [] : filtered.map((row) => row.id))
            }
          >
            {expanded.length ? "Thu gọn tất cả" : "Mở rộng tất cả"}
          </Button>
        )}
        <DataToolbar total={filtered.length} recordLabel="bản ghi">
          <ActionToolbar
            onAdd={() => navigate(`${base}?new=1`)}
            onReload={() => message.success("Đã tải lại dữ liệu.")}
            onImport={() => {
              setPreview([])

              setError("")

              setImportOpen(true)
            }}
            onExport={() => setExportOpen(true)}
          />
        </DataToolbar>
        <DataTable
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          expandable={
            kind === "routes"
              ? {
                  expandedRowKeys: expanded,
                  onExpandedRowsChange: (keys) => setExpanded(keys.map(String)),
                  expandedRowRender: (row) => (
                    <DataTable
                      rowKey="id"
                      pagination={false}
                      dataSource={all.routes
                        .filter((version) => version.code === row.code)
                        .sort(
                          (a, b) =>
                            Number.parseFloat(String(b.version)) -
                            Number.parseFloat(String(a.version)),
                        )}
                      columns={[
                        {
                          title: "Phiên bản",
                          render: (_, version) => (
                            <Button
                              type="link"
                              onClick={() => openVersion(version.id)}
                            >
                              V{String(version.version)}
                            </Button>
                          ),
                        },
                        {
                          title: "Trạng thái",
                          render: (_, version) =>
                            lifecycleLabel(version.lifecycle),
                        },
                        {
                          title: "BOM",
                          render: (_, version) =>
                            String(
                              routeCatalog(version, all).boms.find(
                                (bom) => bom.id === version.bom,
                              )?.code || "—",
                            ),
                        },
                        { title: "Ghi chú thay đổi", dataIndex: "changeNote" },
                      ]}
                    />
                  ),
                }
              : undefined
          }
          scroll={{ x: 1000 }}
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

            showTotal: (total, range) =>
              `Hiển thị ${range[0]}–${range[1]} trên ${total} bản ghi`,
          }}
        />
      </Card>
      <ImportDialog
        title={`Import Excel · ${title}`}
        open={importOpen}
        busy={busy}
        onCancel={() => !busy && setImportOpen(false)}
        onFile={file}
        onRemoveFile={() => {
          setPreview([])

          setError("")
        }}
        onTemplate={() => downloadConfigurations(kind, [], all, true)}
        okButtonProps={{ disabled: busy || !preview.length || !!error }}
        onOk={() => {
          try {
            importConfigurations(kind, preview)

            setImportOpen(false)

            form.resetFields()

            setFilters({})

            setPage(1)

            message.success(`Đã thêm ${preview.length} bản ghi.`)
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Không thể nhập dữ liệu.",
            )
          }
        }}
      >
        <p>
          Import chỉ thêm mới. Mã sản phẩm, mã thành phần và mã công đoạn lấy từ
          danh mục nguồn. Danh sách chi tiết dùng mảng JSON theo hướng dẫn trong
          file mẫu.
        </p>
        {error && (
          <Alert
            type="error"
            showIcon
            title="Dữ liệu chưa hợp lệ"
            description={
              <div
                style={{
                  whiteSpace: "pre-line",

                  maxHeight: 240,

                  overflow: "auto",
                }}
              >
                {error}
              </div>
            }
          />
        )}
        <p>{preview.length} bản ghi hợp lệ trong file</p>
        <DataTable
          rowKey="id"
          dataSource={preview}
          columns={columns.filter((column) => column.title !== "Thao tác")}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 800 }}
        />
      </ImportDialog>
      <ExportDialog
        open={exportOpen}
        filteredCount={filtered.length}
        totalCount={all[kind].length}
        onClose={() => setExportOpen(false)}
        onExport={(exportAll) =>
          downloadConfigurations(kind, exportAll ? all[kind] : filtered, all)
        }
      />
      {deleting && (
        <ConfirmDeleteDialog
          open
          content={
            <>
              Xóa <strong>{text(deleting.code)}</strong> khỏi danh sách?
            </>
          }
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => {
            updateRows(
              kind,

              all[kind].filter((row) => row.id !== deleting.id),
            )

            setDeleting(undefined)

            message.success("Đã xóa bản ghi.")
          }}
        />
      )}
    </>
  )
}
