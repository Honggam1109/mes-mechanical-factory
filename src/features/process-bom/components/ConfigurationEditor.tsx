import StatusTag from "@/components/shared/StatusTag"
import Select from "@/components/shared/SelectableSelect"
import { useEffect, useRef, useState } from "react"

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Steps,
  Tabs,
  Typography,
  message,
} from "antd"

import FormHeader from "../../../components/shared/FormHeader"

import DataTable from "../../../components/shared/DataTable"

import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import type { RecordData } from "../../master-data/config"

import {
  active,
  bomLines,
  nextCode,
  text,
  operationUnitIds,
  routeSteps,
  routeCatalog,
  lifecycleLabel,
  type Catalog,
} from "../lib/model"

import {
  saveConfiguration,
  newRouteVersion,
  transitionRoute,
  type ConfigurationKind,
} from "../lib/service"

import BomLines from "./BomLines"

import BomTree from "./BomTree"

import RouteSteps from "./RouteSteps"

import RouteMaterials from "./RouteMaterials"

export default function ConfigurationEditor({
  kind,
  record,
  isNew,
  all,
  readOnly,
  onBack,
  onSaved,
  onEdit,
  onVersion,
}: {
  kind: ConfigurationKind
  record?: RecordData
  isNew: boolean
  all: Catalog
  readOnly: boolean
  onBack: () => void
  onSaved: (row: RecordData) => void
  onEdit: () => void
  onVersion: (id: string) => void
}) {
  const [form] = Form.useForm<RecordData>(),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    pending = useRef(false)

  const [initial] = useState<RecordData>(() => ({
    ...structuredClone(record || {}),
    id: record?.id || crypto.randomUUID(),
    code:
      record?.code || nextCode(all[kind], kind === "boms" ? "BOM" : "PROCESS"),
    status: record?.status || "Hoạt động",
    name: record?.name || "",
    description: record?.description || "",
    product: record?.product || "",
    quantity: record?.quantity || 1,
    details: structuredClone(record?.details || []),
    bom: record?.bom || "",
    version: record?.version || "1.0",
    lifecycle: record?.lifecycle || "DRAFT",
    materials: record?.materials || [],
    operation: record?.operation || "",
    productionUnit: record?.productionUnit || "",
    changeNote: record?.changeNote || "",
  }))

  const watched = Form.useWatch([], { form, preserve: true }),
    values = { ...initial, ...watched },
    catalog = kind === "routes" ? routeCatalog(values, all) : all

  const bom = catalog.boms.find((row) => row.id === values.bom),
    product = catalog.products.find(
      (row) => row.id === (kind === "boms" ? values.product : bom?.product),
    ),
    primary = catalog.operations.find((row) => row.id === values.operation)

  const locked = kind === "routes" && !isNew && record?.lifecycle !== "DRAFT",
    disabled = readOnly || locked || saving

  useEffect(() => {
    if (watched)
      setDirty(
        JSON.stringify({ ...initial, ...watched }) !== JSON.stringify(initial),
      )
  }, [watched, initial])

  const withoutGuard = useUnsavedChanges(dirty && !disabled, () => {
    form.resetFields()
    setDirty(false)
  })

  const back = () => {
    if (dirty && !disabled)
      Modal.confirm({
        title: "Thay đổi chưa lưu",
        content: "Rời khỏi sẽ bỏ các thay đổi chưa lưu.",
        okText: "Rời khỏi",
        cancelText: "Tiếp tục chỉnh sửa",
        onOk: () => withoutGuard(onBack),
      })
    else onBack()
  }

  const save = async () => {
    if (pending.current || disabled) return
    pending.current = true
    try {
      const fields = await form.validateFields()
      setSaving(true)
      setError("")
      const row = saveConfiguration(
        kind,
        { ...initial, ...fields },
        isNew ? undefined : record?.id,
      )
      setDirty(false)
      message.success("Đã lưu cấu hình.")
      withoutGuard(() => onSaved(row))
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Vui lòng kiểm tra các trường bắt buộc.",
      )
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  const change = (action: "APPLY" | "ARCHIVE") =>
    Modal.confirm({
      title:
        action === "APPLY" ? "Áp dụng phiên bản này?" : "Lưu trữ phiên bản?",
      content:
        action === "APPLY"
          ? "Phiên bản đang áp dụng cùng mã sẽ được lưu trữ. BOM và cấu hình phiên bản này sẽ được giữ nguyên."
          : "Phiên bản và thông tin đã áp dụng được giữ lại.",
      okText: "Xác nhận",
      cancelText: "Hủy",
      onOk: () => {
        if (!record) return
        try {
          transitionRoute(record.id, action)
          message.success("Đã cập nhật trạng thái phiên bản.")
          onVersion(record.id)
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Không thể cập nhật.",
          )
          throw error
        }
      },
    })

  const fork = () => {
    if (!record) return
    try {
      const copy = newRouteVersion(record.id)
      onVersion(copy.id)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể tạo phiên bản.",
      )
    }
  }

  const versions = all.routes
    .filter((row) => row.code === record?.code)
    .sort(
      (a, b) =>
        Number.parseFloat(text(b.version)) - Number.parseFloat(text(a.version)),
    )

  const history = (
    <DataTable
      rowKey="id"
      dataSource={versions}
      pagination={false}
      columns={[
        {
          title: "Phiên bản",
          render: (_, row) => (
            <Button type="link" onClick={() => onVersion(row.id)}>
              V{String(row.version)}
            </Button>
          ),
        },
        {
          title: "Trạng thái",
          render: (_, row) => lifecycleLabel(row.lifecycle),
        },
        {
          title: "BOM",
          render: (_, row) =>
            text(all.boms.find((bom) => bom.id === row.bom)?.code),
        },
        {
          title: "Ngày áp dụng",
          render: (_, row) =>
            row.appliedAt
              ? new Date(text(row.appliedAt)).toLocaleString("vi-VN")
              : "—",
        },
        { title: "Ghi chú thay đổi", dataIndex: "changeNote" },
      ]}
    />
  )

  const bomTree = bom ? (
    <BomTree record={bom} all={catalog} quantity={Number(values.quantity)} />
  ) : (
    <Alert type="info" title="Chọn BOM để xem cấu trúc định mức." />
  )

  return (
    <Card bordered={false}>
      <Typography.Title level={4}>{`${
        locked ? "Chi tiết" : isNew ? "Thêm mới" : "Sửa"
      } ${
        kind === "boms" ? "định mức BOM" : "quy trình công nghệ"
      }`}</Typography.Title>
      <FormHeader
        onBack={back}
        onReset={() => {
          form.resetFields()
          setError("")
          setDirty(false)
        }}
        onSave={() => void save()}
        saving={saving}
        {...(locked
          ? {
              actions: (
                <Space>
                  {record?.lifecycle === "ACTIVE" && (
                    <Button onClick={() => change("ARCHIVE")}>Lưu trữ</Button>
                  )}
                  <Button type="primary" onClick={fork}>
                    Tạo phiên bản mới
                  </Button>
                </Space>
              ),
            }
          : readOnly
            ? { actions: <Button onClick={onEdit}>Chỉnh sửa</Button> }
            : {})}
      />
      {kind === "routes" && (
        <Space
          wrap
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Steps
            size="small"
            current={
              values.lifecycle === "ACTIVE"
                ? 1
                : values.lifecycle === "ARCHIVED"
                  ? 2
                  : 0
            }
            items={[
              { title: "Bản nháp" },
              { title: "Đang áp dụng" },
              { title: "Lưu trữ" },
            ]}
            style={{ width: 430 }}
          />
          <Space>
            <StatusTag color={values.lifecycle === "ACTIVE" ? "green" : "default"}>
              V{String(values.version)} · {lifecycleLabel(values.lifecycle)}
            </StatusTag>
            {versions.length > 0 && (
              <Select
                value={record?.id}
                style={{ width: 180 }}
                options={versions.map((row) => ({
                  value: row.id,
                  label: `V${row.version} · ${lifecycleLabel(row.lifecycle)}`,
                }))}
                onChange={onVersion}
              />
            )}
            {record?.lifecycle === "DRAFT" && (
              <Button
                type="primary"
                disabled={dirty}
                onClick={() => change("APPLY")}
              >
                Áp dụng phiên bản
              </Button>
            )}
          </Space>
        </Space>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title="Dữ liệu chưa hợp lệ"
          description={<div style={{ whiteSpace: "pre-line" }}>{error}</div>}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        name={`configuration-${kind}`}
        initialValues={initial}
        layout="vertical"
        disabled={disabled}
      >
        <Typography.Title level={5}>
          {kind === "boms" ? "Thông tin BOM" : "Thông tin quy trình công nghệ"}
        </Typography.Title>
        <Row gutter={24}>
          <Col xs={24} md={kind === "routes" ? 6 : 8}>
            <Form.Item
              name="code"
              label={kind === "boms" ? "Mã BOM" : "Mã quy trình"}
              required
            >
              <Input readOnly disabled />
            </Form.Item>
          </Col>
          {kind === "routes" && (
            <>
              <Col xs={24} md={6}>
                <Form.Item
                  name="name"
                  label="Tên quy trình"
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: "Nhập tên quy trình.",
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="bom"
                  label="Định mức nguyên vật liệu (BOM)"
                  rules={[{ required: true, message: "Chọn BOM." }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={catalog.boms
                      .filter(
                        (row) =>
                          (active(row) || row.id === values.bom) &&
                          (isNew || !record || row.product === initial.product),
                      )
                      .map((row) => ({
                        value: row.id,
                        label: `${row.code} · ${catalog.products.find((product) => product.id === row.product)?.name || ""}`,
                        disabled: !active(row),
                      }))}
                    onChange={(id) => {
                      const selected = all.boms.find((row) => row.id === id)
                      form.setFieldsValue({
                        product: selected?.product || "",
                        quantity: selected?.quantity || 1,
                        materials: bomLines(selected).map(
                          (line) => line.material,
                        ),
                      })
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  name="operation"
                  label="Công đoạn chính"
                  rules={[{ required: true, message: "Chọn công đoạn." }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={catalog.operations
                      .filter(
                        (row) => active(row) || row.id === values.operation,
                      )
                      .map((row) => ({
                        value: row.id,
                        label: `${row.code} · ${row.name}`,
                        disabled: !active(row),
                      }))}
                    onChange={(id) => {
                      const operation = all.operations.find(
                          (row) => row.id === id,
                        ),
                        units = operationUnitIds(operation),
                        steps = routeSteps(values)
                      form.setFieldsValue({
                        productionUnit: units.length === 1 ? units[0] : "",
                        details: steps.length
                          ? steps.map((step, index) =>
                              index === 0 ? { ...step, operation: id } : step,
                            )
                          : [
                              {
                                stepId: crypto.randomUUID(),
                                order: 10,
                                operation: id,
                                note: "",
                              },
                            ],
                      })
                    }}
                  />
                </Form.Item>
              </Col>
            </>
          )}
          <Col xs={24} md={kind === "routes" ? 6 : 8}>
            <Form.Item
              name="product"
              label="Thành phẩm / Bán thành phẩm"
              rules={[{ required: true, message: "Chọn sản phẩm." }]}
            >
              <Select
                disabled={kind === "routes" || disabled}
                showSearch
                optionFilterProp="label"
                options={catalog.products
                  .filter((row) => active(row) || row.id === values.product)
                  .map((row) => ({
                    value: row.id,
                    label: `${row.code} · ${row.name}`,
                    disabled: !active(row),
                  }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={kind === "routes" ? 6 : 8}>
            <Form.Item
              name="quantity"
              label={kind === "boms" ? "Số lượng cơ sở" : "Sản lượng chuẩn"}
              rules={[
                {
                  required: true,
                  type: "number",
                  min: 0.000001,
                  message: "Số lượng phải lớn hơn 0.",
                },
              ]}
            >
              <InputNumber min={0.000001} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={kind === "routes" ? 6 : 8}>
            <Form.Item label="Đơn vị tính" required>
              <Input disabled value={text(product?.unit)} />
            </Form.Item>
          </Col>
          {kind === "routes" && (
            <Col xs={24} md={6}>
              <Form.Item
                name="productionUnit"
                label="Khu vực / Đơn vị sản xuất"
                rules={[
                  {
                    required: true,
                    message: "Chọn đơn vị phù hợp công đoạn chính.",
                  },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={catalog.productionUnits
                    .filter((unit) =>
                      operationUnitIds(primary).includes(unit.id),
                    )
                    .map((unit) => ({
                      value: unit.id,
                      label: text(unit.name),
                      disabled: !active(unit),
                    }))}
                />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} md={8}>
            <Form.Item
              name="status"
              label="Trạng thái sử dụng"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "Hoạt động", label: "Hoạt động" },
                  { value: "Không hoạt động", label: "Ngừng hoạt động" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
          {kind === "routes" && (
            <Col span={24}>
              <Form.Item name="changeNote" label="Ghi chú thay đổi phiên bản">
                <Input />
              </Form.Item>
            </Col>
          )}
        </Row>
        {kind === "boms" ? (
          <Tabs
            items={[
              {
                key: "lines",
                label: `Danh sách thành phần (${bomLines(values).length})`,
                forceRender: true,
                children: (
                  <BomLines form={form} all={all} readOnly={disabled} />
                ),
              },
              {
                key: "tree",
                label: "Cây định mức (BOM Tree)",
                children: <BomTree record={values} all={all} />,
              },
            ]}
          />
        ) : (
          <Tabs
            items={[
              {
                key: "materials",
                label: `Vật tư tiêu hao (${
                  Array.isArray(values.materials) ? values.materials.length : 0
                })`,
                forceRender: true,
                children: (
                  <RouteMaterials
                    record={values}
                    all={catalog}
                    form={form}
                    readOnly={disabled}
                  />
                ),
              },
              {
                key: "steps",
                label: "Danh sách công đoạn",
                forceRender: true,
                children: (
                  <RouteSteps form={form} all={catalog} readOnly={disabled} />
                ),
              },
              {
                key: "history",
                label: `Lịch sử phiên bản (${versions.length})`,
                children: history,
              },
              { key: "tree", label: "Cây cấu trúc BOM", children: bomTree },
            ]}
          />
        )}
      </Form>
    </Card>
  )
}
