import StatusTag from "@/components/shared/StatusTag"
import { useEffect, useState } from "react"

import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Result,
  Row,
  Select,
  Space,
  Typography,
} from "antd"

import { ReloadOutlined } from "@ant-design/icons"

import { useMasterData } from "../../master-data/store"

import { navigate, useAuth } from "../../auth/AuthContext"

import useWorkspaceLocation from "../../../app/navigation/useWorkspaceLocation"

import FilterPanel from "../../../components/shared/FilterPanel"

import DataTable from "../../../components/shared/DataTable"

import { active, text } from "../../process-bom/lib/model"

import { hasAction, inScope } from "../lib/access"
import { sortWorkQueue } from "../lib/filters"

import {
  formatTime,
  productionState,
  workActuals,
  workContext,
} from "../lib/model"

import {
  executionLabels,
  executionStatus,
  stationContext,
} from "../lib/execution"

import ExecutionDetail from "../components/ExecutionDetail"

const base = "/workspace/production",
  resource = "PRODUCTION_EXECUTION"

export default function ExecutionPage() {
  const all = useMasterData(),
    { auth } = useAuth(),
    { query } = useWorkspaceLocation(),
    [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)

    return () => window.clearInterval(timer)
  }, [])

  const units = all.productionUnits.filter(active),
    unitId =
      query.get("unit") ||
      (auth?.dataScopes[`${resource}:VIEW`] === "SELF"
        ? auth.employee?.productionTeamId || ""
        : ""),
    stationId = query.get("station") || "",
    id = query.get("record")

  const permitted = sortWorkQueue(
    productionState(all).workOrders.filter((work) =>
      inScope(auth, resource, "VIEW", work, all),
    ),
    all,
  )

  const stations = all.stations.filter(
    (station) =>
      active(station) &&
      station.productionUnit === unitId &&
      (auth?.dataScopes[`${resource}:VIEW`] === "ALL" ||
        permitted.some((work) => work.stationId === station.id)),
  )

  const station = stations.find((row) => row.id === stationId),
    rows = station
      ? permitted.filter((work) => work.stationId === stationId)
      : auth?.dataScopes[`${resource}:VIEW`] === "SELF"
        ? permitted
        : [],
    work = rows.find((row) => row.id === id)

  const link = (unit: string, station = "", record = "") =>
    `${base}?${new URLSearchParams({ unit, ...(station ? { station } : {}), ...(record ? { record } : {}) })}`

  const current = stationContext(stationId, all, now)

  if (!hasAction(auth, resource, "VIEW"))
    return (
      <Result status="403" title="Bạn không có quyền xem Thực thi sản xuất" />
    )

  if (id)
    return work ? (
      <ExecutionDetail
        key={work.id}
        work={work}
        all={all}
        now={now}
        onBack={() => navigate(link(unitId, stationId))}
      />
    ) : (
      <Result
        status="403"
        title="WO không thuộc Trạm đang chọn hoặc ngoài phạm vi dữ liệu"
        extra={
          <Button onClick={() => navigate(link(unitId, stationId))}>
            Về danh sách
          </Button>
        }
      />
    )

  return (
    <>
      <FilterPanel>
        <Typography.Title level={4}>Thực thi sản xuất</Typography.Title>
        <Form layout="vertical" name="execution-station">
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <Form.Item label="Đơn vị sản xuất" required>
                <Select
                  value={unitId || undefined}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn đơn vị đang Hoạt động"
                  onChange={(value) => navigate(link(value))}
                  options={units

                    .filter(
                      (unit) =>
                        auth?.dataScopes[`${resource}:VIEW`] === "ALL" ||
                        permitted.some(
                          (work) =>
                            workContext(work, all).station?.productionUnit ===
                            unit.id,
                        ),
                    )

                    .map((unit) => ({
                      value: unit.id,

                      label: `${unit.code} · ${unit.name}`,
                    }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item label="Trạm sản xuất">
                <Select
                  allowClear
                  value={stationId || undefined}
                  disabled={!unitId}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả trạm được phân công"
                  onChange={(value) => navigate(link(unitId, value))}
                  options={stations.map((row) => ({
                    value: row.id,

                    label: `${row.code} · ${row.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Button
                style={{ marginTop: 30 }}
                icon={<ReloadOutlined />}
                onClick={() => setNow(new Date())}
              >
                Làm mới
              </Button>
            </Col>
          </Row>
        </Form>
      </FilterPanel>
      {station || auth?.dataScopes[`${resource}:VIEW`] === "SELF" ? (
        <>
          {station && (
            <Card style={{ marginTop: 16 }} title="Thông tin thực thi hiện tại">
              <Descriptions
                column={{ xs: 1, md: 3 }}
                items={[
                  {
                    key: "date",

                    label: "Ngày hiện tại",

                    children: now.toLocaleDateString("vi-VN"),
                  },

                  {
                    key: "shift",

                    label: "Ca hiện tại",

                    children: current.slot
                      ? `${current.slot.shift.name} · ${current.slot.shift.start}–${current.slot.shift.end} (ngày ${current.slot.date})`
                      : current.slots.length
                        ? "Nhiều ca giao nhau, chưa xác định phân công"
                        : "Ngoài thời gian ca",
                  },

                  {
                    key: "employee",

                    label: "Nhân viên được phân công",

                    children: current.assignment
                      ? `${current.employee?.code} · ${current.employee?.name}`
                      : "Chưa được phân công",
                  },

                  {
                    key: "unit",

                    label: "Đơn vị sản xuất",

                    children: text(
                      units.find((unit) => unit.id === unitId)?.name,
                    ),
                  },

                  {
                    key: "station",

                    label: "Trạm sản xuất",

                    children: text(
                      station?.name || "Tất cả trạm được phân công",
                    ),
                  },
                ]}
              />
              {current.error && (
                <Alert type="warning" showIcon title={current.error} />
              )}
            </Card>
          )}
          <Card
            style={{ marginTop: 16 }}
            title={`${
              station ? "Lệnh làm việc tại Trạm" : "Công việc được giao cho tôi"
            } (${rows.length})`}
          >
            <DataTable
              rowKey="id"
              dataSource={rows}
              scroll={{ x: 1512 }}
              columns={[
                {
                  title: "Mã WO",

                  width: 118,

                  render: (_, row) => (
                    <Button
                      type="link"
                      onClick={() =>
                        navigate(link(unitId, row.stationId, row.id))
                      }
                    >
                      {row.code}
                    </Button>
                  ),
                },

                {
                  title: "Mã MO",

                  width: 109,

                  render: (_, row) => workContext(row, all).order?.code,
                },

                {
                  title: "Sản phẩm",

                  width: 202,

                  render: (_, row) => {
                    const source = workContext(row, all).source

                    return `${source?.product.code} · ${source?.product.name}`
                  },
                },

                {
                  title: "Thứ tự",

                  width: 67,

                  render: (_, row) => workContext(row, all).step?.order,
                },

                {
                  title: "Công đoạn",

                  width: 143,

                  render: (_, row) => workContext(row, all).step?.name,
                },

                {
                  title: "SL kế hoạch",

                  width: 92,

                  render: (_, row) => workContext(row, all).order?.quantity,
                },

                {
                  title: "Bắt đầu KH",

                  width: 151,

                  render: (_, row) =>
                    formatTime(workContext(row, all).step?.start),
                },

                {
                  title: "Hoàn thành KH",

                  width: 151,

                  render: (_, row) =>
                    formatTime(workContext(row, all).step?.end),
                },

                {
                  title: "SL đã ghi nhận",

                  width: 101,

                  render: (_, row) => workActuals(row.id, all).quantity,
                },

                {
                  title: "Trạm",
                  width: 160,
                  render: (_, row) => text(workContext(row, all).station?.name),
                },
                {
                  title: "Nhân viên hiện tại",

                  width: 151,

                  render: (_, row) =>
                    stationContext(row.stationId, all, now, row.id).assignment
                      ? text(
                          stationContext(row.stationId, all, now, row.id)
                            .employee?.name,
                        )
                      : "Chưa phân công",
                },

                {
                  title: "Trạng thái thực thi",

                  width: 151,

                  render: (_, row) => (
                    <StatusTag
                      color={
                        executionStatus(row, all, now) === "OVERDUE"
                          ? "red"
                          : "blue"
                      }
                    >
                      {executionLabels[executionStatus(row, all, now)]}
                    </StatusTag>
                  ),
                },

                {
                  title: "Thao tác",

                  width: 76,

                  fixed: "right",

                  render: (_, row) => (
                    <Space>
                      <Button
                        onClick={() =>
                          navigate(link(unitId, row.stationId, row.id))
                        }
                      >
                        Thực thi
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <Empty description="Chọn Đơn vị sản xuất và Trạm để xem các WO đã được phân công thực tế." />
        </Card>
      )}
    </>
  )
}
