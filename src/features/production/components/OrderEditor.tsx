import Select from "@/components/shared/SelectableSelect"
import { useEffect, useRef, useState } from "react"

import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd"

import FormHeader from "../../../components/shared/FormHeader"

import FormToolbar from "../../../components/shared/FormToolbar"

import DataTable from "../../../components/shared/DataTable"

import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import { navigate, useAuth } from "../../auth/AuthContext"

import {
  active,
  nextCode,
  orderedSteps,
  text,
  type Catalog,
} from "../../process-bom/lib/model"

import type { ManufacturingOrder } from "../types"

import { hasAction, inScope } from "../lib/access"

import {
  duration,
  formatTime,
  orderActuals,
  orderSource,
  percent,
  priorities,
  productionState,
} from "../lib/model"

import { cancelOrder, releaseOrder, saveOrder } from "../lib/remoteService"

import StatusBadge from "./StatusBadge"
const toLocalInput = (value: string) => {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

import WorkOrdersTable from "./WorkOrdersTable"

export default function OrderEditor({
  record,

  all,

  edit,

  onBack,

  onSaved,
}: {
  record?: ManufacturingOrder

  all: Catalog

  edit: boolean

  onBack: () => void

  onSaved: (id: string) => void
}) {
  const { auth } = useAuth(),
    [form] = Form.useForm<ManufacturingOrder>(),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    pending = useRef(false)

  const [initial] = useState<ManufacturingOrder>(() =>
    structuredClone(
      record
        ? {
            ...record,
            start: toLocalInput(record.start),
            end: toLocalInput(record.end),
            plans: record.plans.map((plan) => ({
              ...plan,
              start: toLocalInput(plan.start),
              end: toLocalInput(plan.end),
            })),
          }
        : {
            id: "",

            code: nextCode(all.productionOrders || [], "MO"),

            productId: "",

            routeId: "",

            quantity: 1,

            priority: "Bình thường",

            start: "",

            end: "",

            note: "",

            status: "DRAFT",

            plans: [],

            createdBy: auth?.user.id || "",

            createdAt: "",

            updatedAt: "",
          },
    ),
  )

  const changed = Form.useWatch([], { form, preserve: true }),
    values = { ...initial, ...changed },
    source = orderSource(values, all),
    actual = record
      ? orderActuals(record, all)
      : { quantity: 0, good: 0, ng: 0, start: undefined, end: undefined }

  const editable =
    edit &&
    initial.status === "DRAFT" &&
    hasAction(auth, "PRODUCTION_ORDER", record ? "UPDATE" : "CREATE") &&
    (!record || inScope(auth, "PRODUCTION_ORDER", "WRITE", record, all))

  useEffect(() => {
    if (changed)
      setDirty(
        JSON.stringify({ ...initial, ...changed }) !== JSON.stringify(initial),
      )
  }, [changed, initial])

  const withoutGuard = useUnsavedChanges(dirty && editable, () => {
    form.resetFields()

    setDirty(false)
  })

  const back = () => {
    if (dirty && editable)
      Modal.confirm({
        title: "Thay đổi chưa lưu",

        content: "Rời khỏi sẽ bỏ các thay đổi chưa lưu.",

        okText: "Rời khỏi",

        cancelText: "Tiếp tục chỉnh sửa",

        onOk: () => withoutGuard(onBack),
      })
    else onBack()
  }

  const reset = () => {
    form.resetFields()

    setError("")

    setDirty(false)
  }

  const save = async () => {
    if (!editable || pending.current) return

    pending.current = true

    try {
      const fields = await form.validateFields()

      setSaving(true)

      setError("")

      const row = await saveOrder({ ...values, ...fields }, auth, record?.id)

      message.success("Đã lưu Lệnh sản xuất Nháp.")

      setDirty(false)

      withoutGuard(() => onSaved(row.id))
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

  const transition = (action: "release" | "cancel") => {
    if (!record) return

    Modal.confirm({
      title:
        action === "release"
          ? `Phát hành ${record.code}?`
          : `Hủy ${record.code}?`,

      content:
        action === "release"
          ? "Chốt BOM, quy trình và kế hoạch; tự sinh một Lệnh làm việc cho mỗi công đoạn. Sau phát hành không sửa kế hoạch."
          : "Các WO chưa thực thi sẽ được hủy và các ca đã bố trí không còn chiếm chỗ. Giữ thông tin để tra cứu.",

      okText: "Xác nhận",

      cancelText: "Hủy",

      onOk: async () => {
        try {
          if (action === "release") await releaseOrder(record.id, auth)
          else await cancelOrder(record.id, auth)

          message.success(
            action === "release"
              ? "Đã phát hành và sinh các WO."
              : "Đã hủy lệnh.",
          )

          onSaved(record.id)
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Không thể thực hiện.",
          )

          throw error
        }
      },
    })
  }

  const routes = all.routes.filter(
    (route) =>
      route.product === values.productId &&
      route.lifecycle === "ACTIVE" &&
      active(route),
  )

  if (record && !routes.some((route) => route.id === record.routeId)) {
    const saved = all.routes.find((route) => route.id === record.routeId)

    if (saved) routes.push(saved)
  }

  const hasAppliedRoute = all.routes.some(
    (route) =>
      route.product === values.productId &&
      route.lifecycle === "ACTIVE" &&
      active(route),
  )

  const works = record
    ? productionState(all).workOrders.filter(
        (work) => work.orderId === record.id,
      )
    : []

  const info = (
    <>
      <Row gutter={24}>
        <Col xs={24} md={8}>
          <Form.Item name="code" label="Mã lệnh sản xuất" required>
            <Input disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="productId"
            label="Sản phẩm"
            rules={[{ required: true, message: "Chọn sản phẩm." }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={all.products

                .filter(
                  (product) =>
                    active(product) || product.id === initial.productId,
                )

                .map((product) => ({
                  value: product.id,

                  label: `${product.code} · ${product.name}`,

                  disabled: !active(product),
                }))}
              onChange={() => form.setFieldsValue({ routeId: "", plans: [] })}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Đơn vị tính">
            <Input
              disabled
              value={
                source?.product.unit ||
                text(
                  all.products.find(
                    (product) => product.id === values.productId,
                  )?.unit,
                )
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="routeId"
            label="Quy trình công nghệ"
            rules={[
              {
                required: true,

                message: "Chọn phiên bản quy trình đang áp dụng.",
              },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!editable || saving || !values.productId}
              options={routes.map((route) => ({
                value: route.id,

                label: `${route.code} · ${route.name} · V${route.version}`,

                disabled: route.lifecycle !== "ACTIVE" || !active(route),
              }))}
              onChange={(id) => {
                const route = all.routes.find((route) => route.id === id)

                form.setFieldValue(
                  "plans",

                  orderedSteps(route).map((step) => ({
                    stepId: step.stepId,

                    start: "",

                    end: "",

                    note: "",
                  })),
                )
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item
            name="quantity"
            label="Số lượng kế hoạch"
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
        <Col xs={24} md={6}>
          <Form.Item name="priority" label="Mức độ ưu tiên">
            <Select
              options={priorities.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="start"
            label="Ngày bắt đầu dự kiến"
            rules={[{ required: true, message: "Nhập thời gian bắt đầu." }]}
          >
            <Input type="datetime-local" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="end"
            label="Ngày kết thúc dự kiến"
            rules={[{ required: true, message: "Nhập thời gian kết thúc." }]}
          >
            <Input type="datetime-local" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="Trạng thái">
            <StatusBadge status={record?.status || "DRAFT"} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Col>
      </Row>
      {source && (
        <Descriptions
          size="small"
          bordered
          column={{ xs: 1, md: 3 }}
          items={[
            {
              key: "bom",

              label: "BOM của phiên bản",

              children: source.bom.code,
            },

            {
              key: "version",

              label: "Quy trình / Phiên bản",

              children: (
                <Button
                  type="link"
                  disabled={false}
                  onClick={() =>
                    navigate(
                      `/workspace/master-routes?record=${encodeURIComponent(values.routeId)}&mode=view`,
                    )
                  }
                >
                  {source.route.code} · V{source.route.version}
                </Button>
              ),
            },

            {
              key: "basis",

              label: "Số lượng cơ sở BOM",

              children: `${source.bom.quantity} ${source.product.unit}`,
            },

            ...(record && record.status !== "DRAFT"
              ? [
                  {
                    key: "start",

                    label: "Bắt đầu thực tế",

                    children: formatTime(actual.start),
                  },

                  {
                    key: "end",

                    label: "Kết thúc thực tế",

                    children: formatTime(actual.end),
                  },

                  {
                    key: "good",

                    label: "Sản lượng thực hiện",

                    children: actual.quantity,
                  },

                  {
                    key: "progress",

                    label: "Tiến độ",

                    children: (
                      <Progress
                        percent={Number(
                          percent(actual.quantity, record.quantity).toFixed(1),
                        )}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </>
  )

  const materials = (
    <>
      <DataTable
        rowKey="material"
        dataSource={source?.materials || []}
        scroll={{ x: 1150 }}
        pagination={false}
        columns={[
          { title: "Mã thành phần", dataIndex: "code" },

          { title: "Tên thành phần", dataIndex: "name" },

          { title: "Loại", dataIndex: "category" },

          { title: "Đơn vị tính", dataIndex: "unit" },

          { title: "SL định mức", dataIndex: "norm" },

          {
            title: "SL cần",

            render: (_, line) =>
              line.required.toLocaleString("vi-VN", {
                maximumFractionDigits: 6,
              }),
          },

          { title: "Hao hụt (%)", dataIndex: "waste" },

          {
            title: "Nhu cầu gồm hao hụt",

            render: (_, line) =>
              line.total.toLocaleString("vi-VN", { maximumFractionDigits: 6 }),
          },

          { title: "Ghi chú", dataIndex: "note" },
        ]}
      />
    </>
  )

  const plans = (
    <>
      <DataTable
        rowKey="stepId"
        pagination={false}
        scroll={{ x: 1450 }}
        dataSource={(source?.steps || []).map((step, index) => ({
          ...step,

          index,
        }))}
        columns={[
          { title: "Thứ tự", dataIndex: "order", width: 80 },

          { title: "Mã công đoạn", dataIndex: "code", width: 130 },

          { title: "Tên công đoạn", dataIndex: "name", width: 180 },

          {
            title: "Đơn vị có thể thực hiện",

            width: 200,

            render: (_, step) => (
              <Space wrap>
                {step.unitNames.map((name, index) => (
                  <Tag key={step.allowedUnitIds[index]}>{name}</Tag>
                ))}
              </Space>
            ),
          },

          {
            title: "Bắt đầu KH *",

            width: 220,

            render: (_, step) => (
              <>
                <Form.Item name={["plans", step.index, "stepId"]} hidden>
                  <Input />
                </Form.Item>
                <Form.Item
                  name={["plans", step.index, "start"]}
                  rules={[
                    {
                      required: true,

                      message: "Nhập thời gian bắt đầu công đoạn.",
                    },
                  ]}
                  style={{ margin: 0 }}
                >
                  <Input type="datetime-local" />
                </Form.Item>
              </>
            ),
          },

          {
            title: "Hoàn thành KH *",

            width: 220,

            render: (_, step) => (
              <Form.Item
                name={["plans", step.index, "end"]}
                rules={[
                  {
                    required: true,

                    message: "Nhập thời gian hoàn thành công đoạn.",
                  },
                ]}
                style={{ margin: 0 }}
              >
                <Input type="datetime-local" />
              </Form.Item>
            ),
          },

          {
            title: "Thời lượng",

            width: 120,

            render: (_, step) => `${duration(step.start, step.end)} phút`,
          },

          {
            title: "Ghi chú",

            width: 200,

            render: (_, step) => (
              <Form.Item
                name={["plans", step.index, "note"]}
                style={{ margin: 0 }}
              >
                <Input />
              </Form.Item>
            ),
          },
        ]}
      />
    </>
  )

  return (
    <Card bordered={false}>
      <Typography.Title level={4}>
        {record
          ? `${editable ? "Sửa" : "Chi tiết"} Lệnh sản xuất: ${record.code}`
          : "Thêm mới Lệnh sản xuất"}
      </Typography.Title>
      <FormHeader
        onBack={back}
        onReset={reset}
        onSave={() => void save()}
        actions={
          <Space wrap>
            {editable && (
              <FormToolbar
                onReset={reset}
                onSave={() => void save()}
                saving={saving}
              />
            )}
            {record?.status === "DRAFT" &&
              hasAction(auth, "PRODUCTION_ORDER", "UPDATE") &&
              inScope(auth, "PRODUCTION_ORDER", "WRITE", record, all) &&
              !editable && (
                <Button
                  onClick={() =>
                    navigate(
                      `/workspace/production-orders?record=${encodeURIComponent(record.id)}&mode=edit`,
                    )
                  }
                >
                  Sửa
                </Button>
              )}
            {record?.status === "DRAFT" &&
              hasAction(auth, "PRODUCTION_ORDER", "RELEASE") &&
              inScope(auth, "PRODUCTION_ORDER", "WRITE", record, all) && (
                <Button
                  type="primary"
                  disabled={dirty || saving}
                  onClick={() => transition("release")}
                >
                  Phát hành
                </Button>
              )}
            {record &&
              ["DRAFT", "RELEASED"].includes(record.status) &&
              hasAction(auth, "PRODUCTION_ORDER", "UPDATE") &&
              inScope(auth, "PRODUCTION_ORDER", "WRITE", record, all) && (
                <Button
                  danger
                  disabled={dirty || saving}
                  onClick={() => transition("cancel")}
                >
                  Hủy lệnh
                </Button>
              )}
          </Space>
        }
      />
      {error && (
        <Alert
          type="error"
          showIcon
          title="Dữ liệu chưa hợp lệ"
          description={<div style={{ whiteSpace: "pre-line" }}>{error}</div>}
          style={{ marginBottom: 16 }}
        />
      )}
      {editable && values.productId && !hasAppliedRoute && (
        <Alert
          type="info"
          showIcon
          title="Sản phẩm chưa có phiên bản quy trình Đang áp dụng"
          description="Hãy áp dụng một phiên bản Quy trình công nghệ phù hợp trong nhóm Quy trình BOM trước khi lập lệnh."
          action={
            <Button onClick={() => navigate("/workspace/master-routes")}>
              Mở Quy trình công nghệ
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        name="production-order-editor"
        initialValues={initial}
        layout="vertical"
        disabled={!editable || saving}
      >
        <Tabs
          items={[
            {
              key: "info",

              label: "Thông tin Lệnh sản xuất",

              forceRender: true,

              children: info,
            },

            ...(record && record.status !== "DRAFT" && works.length
              ? [
                  {
                    key: "works",

                    label: `Lệnh làm việc (${works.length})`,

                    children: (
                      <ConfigProvider componentDisabled={false}>
                        <WorkOrdersTable rows={works} all={all} />
                      </ConfigProvider>
                    ),
                  },
                ]
              : []),

            { key: "materials", label: "Nguyên vật liệu", children: materials },

            {
              key: "plans",

              label: "Kế hoạch công đoạn",

              forceRender: true,

              children: plans,
            },
          ]}
        />
      </Form>
    </Card>
  )
}
