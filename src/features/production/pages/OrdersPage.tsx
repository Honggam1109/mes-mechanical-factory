import { useState } from "react"

import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Progress,
  Result,
  Row,
  Select,
  Space,
  Typography,
} from "antd"

import { DeleteOutlined, EditOutlined } from "@ant-design/icons"

import { useMasterData } from "../../master-data/store"

import { navigate, useAuth } from "../../auth/AuthContext"

import useWorkspaceLocation from "../../../app/navigation/useWorkspaceLocation"

import FilterPanel, {
  FilterActions,
} from "../../../components/shared/FilterPanel"

import DataToolbar from "../../../components/shared/DataToolbar"

import ActionToolbar from "../../../components/shared/ActionToolbar"

import DataTable from "../../../components/shared/DataTable"

import ConfirmDeleteDialog from "../../../components/shared/ConfirmDeleteDialog"

import ExportDialog from "../../../components/shared/ExportDialog"

import type { ManufacturingOrder } from "../types"

import { hasAction, inScope } from "../lib/access"

import { filterOrders, type ProductionFilters } from "../lib/filters"

import {
  formatTime,
  orderActuals,
  orderLabels,
  orderSource,
  percent,
  productionState,
  workActuals,
} from "../lib/model"

import { deleteOrder } from "../lib/remoteService"

import { downloadOrders } from "../lib/excel"

import OrderEditor from "../components/OrderEditor"

import StatusBadge from "../components/StatusBadge"

const base = "/workspace/production-orders",
  resource = "PRODUCTION_ORDER"

export default function OrdersPage() {
  const all = useMasterData(),
    { auth } = useAuth(),
    { query } = useWorkspaceLocation(),
    [form] = Form.useForm(),
    [filters, setFilters] = useState<ProductionFilters>({}),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [deleting, setDeleting] = useState<ManufacturingOrder>(),
    [exportOpen, setExportOpen] = useState(false)

  if (!hasAction(auth, resource, "VIEW"))
    return <Result status="403" title="Bạn không có quyền xem Lệnh sản xuất" />

  const permitted = productionState(all).productionOrders.filter((order) =>
      inScope(auth, resource, "VIEW", order, all),
    ),
    filtered = filterOrders(permitted, filters, all),
    id = query.get("record"),
    isNew = query.get("new") === "1",
    record = permitted.find((order) => order.id === id)

  const open = (order: ManufacturingOrder, edit = false) =>
    navigate(
      `${base}?record=${encodeURIComponent(order.id)}${
        edit ? "&mode=edit" : ""
      }`,
    )

  if (isNew || id) {
    if ((isNew && !hasAction(auth, resource, "CREATE")) || (id && !record))
      return (
        <Result
          status="403"
          title="Không tìm thấy lệnh trong phạm vi được phép"
          extra={<Button onClick={() => navigate(base)}>Về danh sách</Button>}
        />
      )

    return (
      <OrderEditor
        key={`${id || "new"}-${record?.status}-${record?.updatedAt}-${query.get("mode")}`}
        record={record}
        all={all}
        edit={isNew || query.get("mode") === "edit"}
        onBack={() => navigate(base)}
        onSaved={(id) =>
          navigate(`${base}?record=${encodeURIComponent(id)}&mode=edit`)
        }
      />
    )
  }

  const search = () => {
    const { range, ...values } = form.getFieldsValue()

    setFilters({
      ...values,

      from: range?.[0]?.format("YYYY-MM-DD"),

      to: range?.[1]?.format("YYYY-MM-DD"),
    })

    setPage(1)
  }

  return (
    <>
      <FilterPanel>
        <Typography.Title level={4}>Lệnh sản xuất</Typography.Title>
        <Form form={form} name="production-orders-filter" layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="keyword" label="Mã lệnh / ghi chú">
                <Input
                  placeholder="Mã MO hoặc LỊCH SỬ DEMO…"
                  onPressEnter={search}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="productId" label="Sản phẩm">
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
              <Form.Item name="routeId" label="Quy trình công nghệ">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả phiên bản"
                  options={all.routes.map((route) => ({
                    value: route.id,

                    label: `${route.code} · ${route.name} · V${route.version}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  allowClear
                  placeholder="Tất cả"
                  options={Object.entries(orderLabels).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="range" label="Ngày bắt đầu sản xuất dự kiến">
                <DatePicker.RangePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  placeholder={["Từ ngày", "Đến ngày"]}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              md={12}
              style={{
                display: "flex",

                alignItems: "center",

                justifyContent: "flex-end",
              }}
            >
              <FilterActions
                onSearch={search}
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
        <DataToolbar total={filtered.length} recordLabel="lệnh">
          <Space wrap>
            <ActionToolbar
              onAdd={
                hasAction(auth, resource, "CREATE")
                  ? () => navigate(`${base}?new=1`)
                  : undefined
              }
              onExport={
                hasAction(auth, resource, "EXPORT")
                  ? () => setExportOpen(true)
                  : undefined
              }
              onReload={() => search()}
            />
          </Space>
        </DataToolbar>
        <DataTable
          rowKey="id"
          dataSource={filtered}
          scroll={{ x: 1306 }}
          columns={[
            {
              title: "Mã lệnh sản xuất",

              width: 126,

              render: (_, order) => (
                <Button type="link" onClick={() => open(order)}>
                  {order.code}
                </Button>
              ),
            },

            {
              title: "Sản phẩm",

              width: 185,

              render: (_, order) => {
                const product = orderSource(order, all)?.product

                return (
                  <>
                    {product?.name}
                    <br />
                    <Typography.Text type="secondary">
                      {product?.code}
                    </Typography.Text>
                  </>
                )
              },
            },

            {
              title: "Quy trình công nghệ",

              width: 168,

              render: (_, order) => {
                const route = orderSource(order, all)?.route

                return (
                  <>
                    {route?.name}
                    <br />
                    <Typography.Text type="secondary">
                      {route?.code} · V{route?.version}
                    </Typography.Text>
                  </>
                )
              },
            },

            {
              title: "Số lượng kế hoạch",

              width: 109,

              render: (_, order) =>
                `${order.quantity} ${orderSource(order, all)?.product.unit || ""}`,
            },

            {
              title: "Bắt đầu dự kiến",

              width: 151,

              render: (_, order) => formatTime(order.start),
            },

            {
              title: "Kết thúc dự kiến",

              width: 151,

              render: (_, order) => formatTime(order.end),
            },

            {
              title: "SL thực hiện",

              width: 84,

              render: (_, order) => orderActuals(order, all).quantity,
            },

            {
              title: "Tiến độ",

              width: 126,

              render: (_, order) => (
                <>
                  <Progress
                    size="small"
                    percent={Number(
                      percent(
                        orderActuals(order, all).quantity,

                        order.quantity,
                      ).toFixed(1),
                    )}
                  />
                  <Typography.Text type="secondary">
                    {
                      all.workOrders.filter(
                        (work) =>
                          work.orderId === order.id &&
                          workActuals(work.id, all).completed,
                      ).length
                    }
                    /{order.plans.length} công đoạn
                  </Typography.Text>
                </>
              ),
            },

            {
              title: "Trạng thái",

              width: 134,

              render: (_, order) => <StatusBadge status={order.status} />,
            },

            {
              title: "Thao tác",

              fixed: "right",

              width: 72,

              render: (_, order) => (
                <Space>
                  {order.status === "DRAFT" &&
                    inScope(auth, resource, "WRITE", order, all) && (
                      <>
                        {hasAction(auth, resource, "UPDATE") && (
                          <Button
                            type="text"
                            title="Sửa"
                            aria-label={`Sửa ${order.code}`}
                            icon={<EditOutlined />}
                            onClick={() => open(order, true)}
                          />
                        )}
                        {hasAction(auth, resource, "DELETE") && (
                          <Button
                            danger
                            type="text"
                            title="Xóa"
                            aria-label={`Xóa ${order.code}`}
                            icon={<DeleteOutlined />}
                            onClick={() => setDeleting(order)}
                          />
                        )}
                      </>
                    )}
                </Space>
              ),
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
              setPage(size === nextSize ? next : 1)

              setSize(nextSize)
            },

            showTotal: (total, range) =>
              `Hiển thị ${range[0]}–${range[1]} trên ${total} lệnh`,
          }}
        />
      </Card>
      {deleting && (
        <ConfirmDeleteDialog
          open
          content={
            <>
              Xóa Lệnh sản xuất Nháp <strong>{deleting.code}</strong>?
            </>
          }
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => deleteOrder(deleting.id, auth)}
        />
      )}
      <ExportDialog
        open={exportOpen}
        filteredCount={filtered.length}
        totalCount={permitted.length}
        onClose={() => setExportOpen(false)}
        onExport={(allRows) =>
          hasAction(auth, resource, "EXPORT")
            ? downloadOrders(allRows ? permitted : filtered, all)
            : Promise.reject(new Error("Bạn không có quyền xuất file."))
        }
      />
    </>
  )
}
