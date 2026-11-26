import StatusTag from "@/components/shared/StatusTag"
import { useEffect, useState } from "react"

import {
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Result,
  Row,
  Select,
  Space,
  Statistic,
  Typography,
} from "antd"

import { ReloadOutlined } from "@ant-design/icons"

import FilterPanel from "../../../components/shared/FilterPanel"

import { refreshMasterData, useMasterData } from "../../master-data/store"

import { navigate, useAuth } from "../../auth/AuthContext"

import useWorkspaceLocation from "../../../app/navigation/useWorkspaceLocation"

import { active, text } from "../../process-bom/lib/model"

import { hasAction } from "../lib/access"

import { formatTime, stamp, workContext } from "../lib/model"

import {
  filterMonitoredStations,
  monitorColors,
  monitorLabels,
  monitorResource,
  monitorStations,
  stationVisible,
  type MonitorFilters,
} from "../lib/monitor"

import MonitorStationTable from "../components/MonitorStationTable"

import MonitorDetail from "../components/MonitorDetail"

const base = "/workspace/production-progress"

export default function MonitoringPage() {
  const all = useMasterData(),
    { auth } = useAuth(),
    { query } = useWorkspaceLocation(),
    [filters, setFilters] = useState<MonitorFilters>({}),
    [updated, setUpdated] = useState(() => new Date()),
    [error, setError] = useState("")

  const refresh = () => {
    try {
      refreshMasterData()

      setUpdated(new Date())

      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu")
    }
  }

  useEffect(() => {
    const timer = window.setInterval(refresh, 15000)

    return () => window.clearInterval(timer)
  }, [])

  const units = all.productionUnits.filter(
    (unit) =>
      active(unit) &&
      (auth?.dataScopes[`${monitorResource}:VIEW`] === "ALL" ||
        all.stations.some(
          (station) =>
            station.productionUnit === unit.id &&
            stationVisible(station.id, all, auth),
        )),
  )

  const unitId = query.get("unit") || (units.length === 1 ? units[0].id : ""),
    stationId = query.get("station"),
    rows = monitorStations(unitId, all, auth, updated),
    filtered = filterMonitoredStations(rows, filters, all),
    detail = rows.find((row) => row.station.id === stationId)

  const open = (station: string, work?: string) =>
    navigate(
      `${base}?${new URLSearchParams({ unit: unitId, station, ...(work ? { work } : {}) })}`,
    )

  if (!hasAction(auth, monitorResource, "VIEW"))
    return (
      <Result
        status="403"
        title="Bạn không có quyền xem Giám sát vận hành sản xuất"
      />
    )

  if (stationId)
    return detail ? (
      <MonitorDetail
        row={detail}
        all={all}
        now={updated}
        updated={updated}
        workId={query.get("work")}
        onOpen={(work) => open(stationId, work)}
        onBack={() => navigate(`${base}?unit=${unitId}`)}
      />
    ) : (
      <Result
        status="403"
        title="Không tìm thấy Trạm trong phạm vi được phép"
        extra={<Button onClick={() => navigate(base)}>Về tổng quan</Button>}
      />
    )

  const set = (patch: Partial<MonitorFilters>) =>
    setFilters((old) => ({ ...old, ...patch }))

  return (
    <>
      <FilterPanel>
        <Typography.Title level={4}>
          Giám sát vận hành sản xuất
        </Typography.Title>
        <Form layout="vertical" name="production-monitor-filter">
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Đơn vị sản xuất" required>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn đơn vị"
                  value={unitId || undefined}
                  onChange={(id) => {
                    setFilters({})

                    navigate(`${base}?unit=${id}`)
                  }}
                  options={units.map((unit) => ({
                    value: unit.id,

                    label: `${unit.code} · ${unit.name}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="Trạng thái vận hành">
                <Select
                  allowClear
                  value={filters.status}
                  onChange={(status) => set({ status })}
                  placeholder="Tất cả"
                  options={Object.entries(monitorLabels).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="Công đoạn">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={filters.operationId}
                  onChange={(operationId) => set({ operationId })}
                  placeholder="Tất cả"
                  options={all.operations

                    .filter((operation) =>
                      rows.some((row) =>
                        row.pending.some(
                          (work) =>
                            workContext(work, all).step?.operationId ===
                            operation.id,
                        ),
                      ),
                    )

                    .map((operation) => ({
                      value: operation.id,

                      label: text(operation.name),
                    }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Tìm kiếm">
                <Input
                  allowClear
                  placeholder="Trạm, WO, MO, sản phẩm…"
                  value={filters.keyword}
                  onChange={(event) => set({ keyword: event.target.value })}
                />
              </Form.Item>
            </Col>
          </Row>
          <Space
            wrap
            style={{ width: "100%", justifyContent: "space-between" }}
          >
            <Checkbox
              checked={filters.problems}
              onChange={(event) => set({ problems: event.target.checked })}
            >
              Chỉ hiển thị có vấn đề
            </Checkbox>
            <Space wrap>
              <Typography.Text type="secondary">
                Cập nhật lúc {updated.toLocaleTimeString("vi-VN")}
              </Typography.Text>
              <Button onClick={() => setFilters({})}>Đặt lại</Button>
              <Button icon={<ReloadOutlined />} onClick={refresh}>
                Làm mới
              </Button>
            </Space>
          </Space>
        </Form>
        {error && (
          <Typography.Paragraph type="danger">{error}</Typography.Paragraph>
        )}
      </FilterPanel>
      {unitId ? (
        <>
          <Card style={{marginTop:16}} styles={{body:{padding:16}}}>
            <Space style={{width:"100%",justifyContent:"space-between",marginBottom:16}} wrap>
              <Typography.Title level={5} style={{margin:0}}>Danh sách trạm <Typography.Text type="secondary">({filtered.length}/{rows.length})</Typography.Text></Typography.Title>
              <Space wrap><StatusTag color="green">Đang chạy</StatusTag><StatusTag color="orange">Tạm dừng</StatusTag><StatusTag color="red">Quá hạn / bất thường</StatusTag></Space>
            </Space>
            <MonitorStationTable rows={filtered} all={all} now={updated} onOpen={open}/>
          </Card>
        </>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <Empty description="Chọn Đơn vị sản xuất" />
        </Card>
      )}
    </>
  )
}

