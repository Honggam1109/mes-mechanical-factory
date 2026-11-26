import StatusTag from "@/components/shared/StatusTag"
import { Button, Card, Descriptions, Space, Tabs, Tag, Typography } from "antd"
import FormHeader from "../../../components/shared/FormHeader"
import DataTable from "../../../components/shared/DataTable"
import { ids } from "../../master-data/rules"
import { text, type Catalog } from "../../process-bom/lib/model"
import { formatTime, productionState, stamp, workContext } from "../lib/model"
import { stopSessions } from "../lib/execution"
import {
  monitorLabels,
  monitorColors,
  monitorWorkState,
  type MonitoredStation,
} from "../lib/monitor"
import MonitorWork from "./MonitorWork"
export default function MonitorDetail({
  row,
  all,
  now,
  updated,
  workId,
  onOpen,
  onBack,
}: {
  row: MonitoredStation
  all: Catalog
  now: Date
  updated: Date
  workId?: string | null
  onOpen: (id: string) => void
  onBack: () => void
}) {
  const work = row.works.find((work) => work.id === workId) || row.primary,
    state = productionState(all)
  const reports = state.productionExecutions
    .filter(
      (event) =>
        event.kind === "REPORT" &&
        row.works.some((work) => work.id === event.workOrderId),
    )
    .sort((a, b) => stamp(b.at) - stamp(a.at))
    .slice(0, 10)
  const pauses = row.works
    .flatMap((work) => stopSessions(work.id, all))
    .sort((a, b) => stamp(b.at) - stamp(a.at))
    .slice(0, 10)
  const owner = (assignmentId: string) =>
    state.assignments.find((row) => row.id === assignmentId)
  return (
    <Card>
      <FormHeader
        onBack={onBack}
        onReset={() => {}}
        onSave={() => {}}
        actions={
          <Typography.Title level={4} style={{ margin: 0 }}>
            Giám sát {text(row.station.code)}
          </Typography.Title>
        }
      />
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, md: 3 }}
        items={[
          { key: "name", label: "Tên Trạm", children: text(row.station.name) },
          {
            key: "unit",
            label: "Đơn vị sản xuất",
            children: text(
              all.productionUnits.find(
                (unit) => unit.id === row.station.productionUnit,
              )?.name,
            ),
          },
          {
            key: "status",
            label: "Trạng thái vận hành",
            children: (
              <StatusTag color={monitorColors[row.status]}>
                {monitorLabels[row.status]}
              </StatusTag>
            ),
          },
          {
            key: "shift",
            label: "Ca hiện tại",
            children: row.current.slot
              ? `${row.current.slot.shift.name} (${row.current.slot.date})`
              : "—",
          },
          {
            key: "employee",
            label: "Nhân viên hiện tại",
            children: row.current.assignment
              ? text(row.current.employee?.name)
              : "Chưa phân công",
          },
          {
            key: "updated",
            label: "Cập nhật lúc",
            children: updated.toLocaleTimeString("vi-VN"),
          },
          {
            key: "machines",
            label: "Máy thuộc Trạm",
            span: 3,
            children: all.machines
              .filter((machine) =>
                ids(row.station.machineIds).includes(machine.id),
              )
              .map((machine) => (
                <Tag key={machine.id}>
                  {text(machine.code)} · {text(machine.name)}
                </Tag>
              )),
          },
        ]}
      />
      <Card
        size="small"
        title={workId ? "Chi tiết Lệnh làm việc" : "Công việc hiện tại"}
        style={{ marginTop: 20 }}
      >
        {work ? (
          <MonitorWork work={work} all={all} now={now} />
        ) : (
          <Typography.Text type="secondary">Không có công việc</Typography.Text>
        )}
        {row.pause && (
          <p>
            <StatusTag color="orange">Đang dừng</StatusTag>
            {row.pause.reasonName} · Từ {formatTime(row.pause.at)}
          </p>
        )}
      </Card>
      <Card size="small" title="Công việc kế tiếp" style={{ marginTop: 20 }}>
        <DataTable
          rowKey="id"
          dataSource={row.upcoming}
          scroll={{ x: 950 }}
          pagination={false}
          columns={[
            {
              title: "WO",
              render: (_, work) => (
                <Button type="link" onClick={() => onOpen(work.id)}>
                  {work.code}
                </Button>
              ),
            },
            {
              title: "Sản phẩm",
              render: (_, work) => workContext(work, all).source?.product.name,
            },
            {
              title: "Công đoạn",
              render: (_, work) => workContext(work, all).step?.name,
            },
            {
              title: "Bắt đầu KH",
              render: (_, work) =>
                formatTime(workContext(work, all).step?.start),
            },
            {
              title: "Hoàn thành KH",
              render: (_, work) => formatTime(workContext(work, all).step?.end),
            },
            {
              title: "Trạng thái",
              render: (_, work) => (
                <StatusTag color={monitorColors[monitorWorkState(work, all, now)]}>
                  {monitorLabels[monitorWorkState(work, all, now)]}
                </StatusTag>
              ),
            },
          ]}
        />
      </Card>
      <Tabs
        style={{ marginTop: 20 }}
        items={[
          {
            key: "reports",
            label: "Nhật ký sản lượng gần nhất",
            children: (
              <DataTable
                rowKey="id"
                pagination={false}
                dataSource={reports}
                scroll={{ x: 850 }}
                columns={[
                  {
                    title: "Thời gian",
                    render: (_, event) => formatTime(event.at),
                  },
                  {
                    title: "WO",
                    render: (_, event) => (
                      <Button
                        type="link"
                        onClick={() => onOpen(event.workOrderId)}
                      >
                        {
                          row.works.find(
                            (work) => work.id === event.workOrderId,
                          )?.code
                        }
                      </Button>
                    ),
                  },
                  {
                    title: "Nhân viên",
                    render: (_, event) =>
                      event.employeeName ||
                      owner(event.assignmentId)?.employeeSnapshot.name,
                  },
                  {
                    title: "Ca",
                    render: (_, event) =>
                      event.shiftName ||
                      owner(event.assignmentId)?.shiftSnapshot.name,
                  },
                  {
                    title: "Sản lượng",
                    render: (_, event) =>
                      event.quantity ?? event.good + event.ng,
                  },
                ]}
              />
            ),
          },
          {
            key: "stops",
            label: "Nhật ký dừng gần nhất",
            children: (
              <DataTable
                rowKey="id"
                pagination={false}
                dataSource={pauses}
                scroll={{ x: 1100 }}
                columns={[
                  {
                    title: "Bắt đầu dừng",
                    render: (_, event) => formatTime(event.at),
                  },
                  {
                    title: "Kết thúc",
                    render: (_, event) => formatTime(event.end),
                  },
                  { title: "Nguyên nhân", dataIndex: "reasonName" },
                  {
                    title: "Máy liên quan",
                    render: (_, event) => event.machineName || "—",
                  },
                  {
                    title: "Thời lượng (phút)",
                    render: (_, event) =>
                      Math.max(
                        0,
                        ((event.end ? stamp(event.end) : now.getTime()) -
                          stamp(event.at)) /
                          60000,
                      ).toFixed(1),
                  },
                  {
                    title: "Trạng thái",
                    render: (_, event) => (
                      <StatusTag color={event.end ? "default" : "orange"}>
                        {event.end ? "Đã kết thúc" : "Đang dừng"}
                      </StatusTag>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "all",
            label: `Lệnh làm việc (${row.works.length})`,
            children: (
              <Space wrap>
                {row.works.map((work) => (
                  <Button key={work.id} onClick={() => onOpen(work.id)}>
                    {work.code}
                  </Button>
                ))}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
