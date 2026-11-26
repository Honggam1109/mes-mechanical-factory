import { useState } from "react"

import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Result,
  Row,
  Select,
  Typography,
} from "antd"

import { useMasterData } from "../../master-data/store"

import { navigate, useAuth } from "../../auth/AuthContext"

import useWorkspaceLocation from "../../../app/navigation/useWorkspaceLocation"

import FilterPanel, {
  FilterActions,
} from "../../../components/shared/FilterPanel"

import DataToolbar from "../../../components/shared/DataToolbar"

import ActionToolbar from "../../../components/shared/ActionToolbar"

import { hasAction, inScope } from "../lib/access"

import {
  filterWorks,
  sortWorkQueue,
  type ProductionFilters,
} from "../lib/filters"

import { productionState, workLabels } from "../lib/model"

import WorkOrderDetail from "../components/WorkOrderDetail"

import WorkOrdersTable from "../components/WorkOrdersTable"

const base = "/workspace/production-assignments",
  resource = "PRODUCTION_ASSIGNMENT"

export default function AssignmentsPage() {
  const all = useMasterData(),
    { auth } = useAuth(),
    { query } = useWorkspaceLocation(),
    [form] = Form.useForm(),
    [filters, setFilters] = useState<ProductionFilters>({}),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10)

  if (!hasAction(auth, resource, "VIEW"))
    return (
      <Result status="403" title="Bạn không có quyền xem Phân công sản xuất" />
    )

  const permitted = productionState(all).workOrders.filter((work) =>
      inScope(auth, resource, "VIEW", work, all),
    ),
    filtered = sortWorkQueue(filterWorks(permitted, filters, all), all),
    id = query.get("record"),
    work = permitted.find((work) => work.id === id)

  if (id) {
    if (!work)
      return (
        <Result
          status="403"
          title="Không tìm thấy WO trong phạm vi được phép"
          extra={<Button onClick={() => navigate(base)}>Về danh sách</Button>}
        />
      )

    return (
      <WorkOrderDetail
        key={`${id}-${query.get("mode")}`}
        work={work}
        all={all}
        view={query.get("mode") === "view"}
        onBack={() => navigate(base)}
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
        <Typography.Title level={4}>
          Phân công sản xuất — Lệnh làm việc
        </Typography.Title>
        <Form
          form={form}
          name="production-assignments-filter"
          layout="vertical"
        >
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="keyword" label="Từ khóa tìm kiếm">
                <Input
                  placeholder="Mã WO, mã MO hoặc tên sản phẩm…"
                  onPressEnter={search}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="operationId" label="Công đoạn">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả"
                  options={all.operations.map((operation) => ({
                    value: operation.id,

                    label: `${operation.code} · ${operation.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="stationId" label="Trạm sản xuất">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả"
                  options={all.stations.map((station) => ({
                    value: station.id,

                    label: `${station.code} · ${station.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  allowClear
                  placeholder="Tất cả"
                  options={Object.entries(workLabels).map(([value, label]) => ({
                    value,

                    label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="range" label="Khoảng thời gian kế hoạch">
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
        <DataToolbar total={filtered.length} recordLabel="WO">
          <ActionToolbar onReload={search} />
        </DataToolbar>
        <WorkOrdersTable
          rows={filtered}
          all={all}
          page={page}
          size={size}
          onPage={(next, nextSize) => {
            setPage(nextSize === size ? next : 1)

            setSize(nextSize)
          }}
        />
      </Card>
    </>
  )
}
