import StatusTag from "@/components/shared/StatusTag"
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons"

import "./ExecutionDetail.css"

import { useEffect, useRef, useState } from "react"

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd"

import FormHeader from "../../../components/shared/FormHeader"

import DataTable from "../../../components/shared/DataTable"

import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import { navigate, useAuth } from "../../auth/AuthContext"

import { active, text, type Catalog } from "../../process-bom/lib/model"

import { ids } from "../../master-data/rules"

import type { ExecutionReport, WorkOrder } from "../types"

import { hasAction, inScope } from "../lib/access"

import {
  canStartWork,
  formatTime,
  productionState,
  stamp,
  workActuals,
  workContext,
  workStatus,
} from "../lib/model"

import {
  executionBlockers,
  executionLabels,
  executionStatus,
  stationContext,
  stopSessions,
} from "../lib/execution"

import { executeWork, executionAction } from "../lib/remoteService"

import StatusBadge from "./StatusBadge"

const kindLabels = {
  START: "Bắt đầu",

  REPORT: "Ghi nhận sản lượng",

  PAUSE: "Tạm dừng",

  RESUME: "Tiếp tục",

  COMPLETE: "Hoàn thành",
}

export default function ExecutionDetail({
  work,

  all,

  now,

  onBack,
}: {
  work: WorkOrder

  all: Catalog

  now: Date

  onBack: () => void
}) {
  const { auth } = useAuth(),
    [kind, setKind] = useState<ExecutionReport["kind"]>(),
    [error, setError] = useState(""),
    [form] = Form.useForm(),
    pending = useRef(false),
    [busy, setBusy] = useState(false)

  const reasonId = Form.useWatch("reasonId", form),
    { order, source, step, station } = workContext(work, all),
    actual = workActuals(work.id, all),
    status = workStatus(work, all),
    current = stationContext(work.stationId, all, now, work.id)

  const blockers = [
      ...executionBlockers(work, work.stationId, all, now),
      ...(status === "ASSIGNED" ? canStartWork(work, all) : []),
    ],
    state = productionState(all),
    events = state.productionExecutions.filter(
      (row) => row.workOrderId === work.id,
    )

  useUnsavedChanges(!!kind, () => setKind(undefined))

  // Re-evaluate against current state/time in the command; button state is only guidance.

  const can = (action: ExecutionReport["kind"]) =>
    hasAction(auth, "PRODUCTION_EXECUTION", executionAction[action]) &&
    inScope(auth, "PRODUCTION_EXECUTION", "WRITE", work, all)

  const stationsMachines = all.machines.filter((machine) =>
    ids(station?.machineIds).includes(machine.id),
  )

  const show = (action: ExecutionReport["kind"]) => {
    form.resetFields()

    setError("")

    setKind(action)
  }

  const submit = async () => {
    if (!kind || pending.current) return

    pending.current = true

    setBusy(true)

    try {
      const values = await form.validateFields()

      setError("")

      await executeWork(
        { ...values, kind, workOrderId: work.id, stationId: work.stationId },

        auth,
      )

      setKind(undefined)

      message.success(`${kindLabels[kind]} thành công`)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      pending.current = false

      setBusy(false)
    }
  }

  const reason = all.stops.find((row) => row.id === reasonId)

  const items = [
    { key: "wo", label: "Lệnh làm việc", children: work.code },

    {
      key: "mo",

      label: "Lệnh sản xuất",

      children: (
        <Button
          type="link"
          disabled={
            !order ||
            !hasAction(auth, "PRODUCTION_ORDER", "VIEW") ||
            !inScope(auth, "PRODUCTION_ORDER", "VIEW", order, all)
          }
          onClick={() =>
            navigate(`/workspace/production-orders?record=${work.orderId}`)
          }
        >
          {order?.code}
        </Button>
      ),
    },

    {
      key: "product",

      label: "Sản phẩm",

      children: `${source?.product.code} · ${source?.product.name}`,
    },

    {
      key: "step",

      label: "Công đoạn / Thứ tự",

      children: `${step?.order} · ${step?.code} · ${step?.name}`,
    },

    {
      key: "qty",

      label: "SL kế hoạch / Đơn vị tính",

      children: `${order?.quantity} ${source?.product.unit}`,
    },

    {
      key: "reported",

      label: "Sản lượng đã ghi nhận",

      children: actual.quantity,
    },

    {
      key: "start",

      label: "Bắt đầu kế hoạch",

      children: formatTime(step?.start),
    },

    {
      key: "end",

      label: "Hoàn thành kế hoạch",

      children: formatTime(step?.end),
    },

    {
      key: "status",

      label: "Trạng thái WO",

      children: <StatusBadge status={status} />,
    },

    {
      key: "display",

      label: "Tình trạng theo thời gian",

      children: (
        <StatusTag
          color={executionStatus(work, all, now) === "OVERDUE" ? "red" : "blue"}
        >
          {executionLabels[executionStatus(work, all, now)]}
        </StatusTag>
      ),
    },
  ]

  return (
    <Card className="execution-detail">
      <FormHeader
        onReset={() => {}}
        onSave={() => {}}
        onBack={onBack}
        actions={
          <Typography.Title level={4} style={{ margin: 0 }}>
            Thực thi {work.code}
          </Typography.Title>
        }
      />
      <div className="execution-info-grid">
        <section className="execution-info-box">
          <Descriptions
            size="small"
            title="Thông tin Lệnh làm việc"
            column={{ xs: 1, sm: 2 }}
            items={items}
          />
        </section>
        <section className="execution-info-box">
          <Descriptions
            style={{ marginTop: 0 }}
            size="small"
            title="Nguồn lực thực hiện"
            column={{ xs: 1, sm: 2 }}
            items={[
              {
                key: "unit",

                label: "Đơn vị sản xuất",

                children: text(
                  all.productionUnits.find(
                    (row) => row.id === station?.productionUnit,
                  )?.name,
                ),
              },

              { key: "station", label: "Trạm", children: text(station?.name) },

              {
                key: "date",

                label: "Ngày hiện tại",

                children: now.toLocaleDateString("vi-VN"),
              },

              {
                key: "shift",

                label: "Ca hiện tại / Ngày làm việc",

                children: current.slot
                  ? `${current.slot.shift.name} (${current.slot.date})`
                  : "Không xác định được ca",
              },

              {
                key: "employee",

                label: "Nhân viên hiện tại",

                children: current.assignment
                  ? `${current.employee?.code} · ${current.employee?.name}`
                  : "Chưa được phân công",
              },

              {
                key: "machines",

                label: "Máy thuộc Trạm",

                children: stationsMachines.length
                  ? stationsMachines.map((machine) => (
                      <Tag key={machine.id}>
                        {text(machine.code)} · {text(machine.name)}
                      </Tag>
                    ))
                  : "Chưa có máy",
              },
            ]}
          />
        </section>
      </div>
      {blockers.length > 0 && !["COMPLETED", "CANCELLED"].includes(status) && (
        <Alert
          style={{ marginTop: 16 }}
          type="warning"
          showIcon
          title={blockers.join(" ")}
        />
      )}
      <Card
        className="execution-control-panel"
        size="small"
        title="Điều khiển thực thi"
        style={{ marginTop: 16 }}
      >
        <div className="execution-output">
          <div>
            <span>SẢN LƯỢNG ĐÃ GHI NHẬN</span>
            <div>
              <strong>{actual.quantity.toLocaleString("vi-VN")}</strong>
              <small>
                {" "}
                / {order?.quantity.toLocaleString("vi-VN")}{" "}
                {source?.product.unit}
              </small>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>
        <Space wrap style={{ marginBottom: 16 }}>
          <span>Bắt đầu thực tế: {formatTime(actual.start)}</span>
          <span>Hoàn thành thực tế: {formatTime(actual.end)}</span>
          <span>
            Thời gian từ lúc bắt đầu:{" "}
            {actual.start
              ? Math.max(
                  0,

                  Math.floor(
                    ((actual.end ? stamp(actual.end) : now.getTime()) -
                      stamp(actual.start)) /
                      60000,
                  ),
                )
              : 0}{" "}
            phút
          </span>
        </Space>
        <div>
          <Space wrap className="execution-action-buttons">
            {!actual.started &&
              !["COMPLETED", "CANCELLED"].includes(status) && (
                <Button
                  type="primary"
                  disabled={
                    !can("START") ||
                    blockers.length > 0 ||
                    status !== "ASSIGNED" ||
                    canStartWork(work, all).some((error) =>
                      error.includes("Công đoạn trước"),
                    )
                  }
                  icon={<PlayCircleOutlined />}
                  size="large"
                  className="execution-action-start"
                  onClick={() => show("START")}
                >
                  Bắt đầu
                </Button>
              )}
            {status === "IN_PROGRESS" && (
              <>
                <Button
                  type="primary"
                  disabled={!can("REPORT") || !!blockers.length}
                  icon={<PlusCircleOutlined />}
                  size="large"
                  className="execution-action-report"
                  onClick={() => show("REPORT")}
                >
                  Ghi nhận sản lượng
                </Button>
                <Button
                  disabled={!can("PAUSE") || !!blockers.length}
                  icon={<PauseCircleOutlined />}
                  size="large"
                  className="execution-action-pause"
                  onClick={() => show("PAUSE")}
                >
                  Tạm dừng
                </Button>
                <Button
                  disabled={!can("COMPLETE") || !!blockers.length}
                  icon={<CheckCircleOutlined />}
                  size="large"
                  className="execution-action-complete"
                  onClick={() => show("COMPLETE")}
                >
                  Hoàn thành
                </Button>
              </>
            )}
            {status === "PAUSED" && (
              <Button
                type="primary"
                disabled={!can("RESUME") || !!blockers.length}
                icon={<PlayCircleOutlined />}
                size="large"
                className="execution-action-resume"
                onClick={() => show("RESUME")}
              >
                Tiếp tục
              </Button>
            )}
          </Space>
        </div>
        {canStartWork(work, all).some((error) =>
          error.includes("Công đoạn trước"),
        ) && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            title="Công đoạn trước phải Hoàn thành trước khi bắt đầu."
          />
        )}
      </Card>
      <Tabs
        style={{ marginTop: 24 }}
        items={[
          {
            key: "reports",

            label: "Nhật ký sản lượng",

            children: (
              <DataTable
                rowKey="id"
                scroll={{ x: 950 }}
                dataSource={events.filter((row) => row.kind === "REPORT")}
                columns={[
                  {
                    title: "Thời gian",

                    render: (_, row) => formatTime(row.at),
                  },

                  {
                    title: "Ngày làm việc",

                    render: (_, row) =>
                      row.date ||
                      state.assignments.find((a) => a.id === row.assignmentId)
                        ?.date,
                  },

                  {
                    title: "Ca",

                    render: (_, row) =>
                      row.shiftName ||
                      state.assignments.find((a) => a.id === row.assignmentId)
                        ?.shiftSnapshot.name,
                  },

                  {
                    title: "Nhân viên",

                    render: (_, row) =>
                      row.employeeName ||
                      state.assignments.find((a) => a.id === row.assignmentId)
                        ?.employeeSnapshot.name,
                  },

                  {
                    title: "Sản lượng",

                    render: (_, row) => row.quantity ?? row.good + row.ng,
                  },

                  { title: "Ghi chú", dataIndex: "note" },
                ]}
              />
            ),
          },

          {
            key: "stops",

            label: "Nhật ký dừng",

            children: (
              <DataTable
                rowKey="id"
                scroll={{ x: 1200 }}
                dataSource={stopSessions(work.id, all)}
                columns={[
                  {
                    title: "Bắt đầu dừng",

                    render: (_, row) => formatTime(row.at),
                  },

                  {
                    title: "Kết thúc dừng",

                    render: (_, row) => formatTime(row.end),
                  },

                  {
                    title: "Thời lượng (phút)",

                    render: (_, row) =>
                      Math.max(
                        0,

                        ((row.end ? stamp(row.end) : now.getTime()) -
                          stamp(row.at)) /
                          60000,
                      ).toFixed(1),
                  },

                  {
                    title: "Nguyên nhân",

                    render: (_, row) =>
                      `${row.reasonName} · ${row.reasonGroup}`,
                  },

                  {
                    title: "Máy liên quan",

                    render: (_, row) => row.machineName || "—",
                  },

                  { title: "Nhân viên", dataIndex: "employeeName" },

                  { title: "Ghi chú", dataIndex: "note" },
                ]}
              />
            ),
          },

          {
            key: "events",

            label: "Lịch sử thao tác",

            children: (
              <DataTable
                rowKey="id"
                dataSource={events}
                columns={[
                  {
                    title: "Thời gian",

                    render: (_, row) => formatTime(row.at),
                  },

                  {
                    title: "Thao tác",

                    render: (_, row) => kindLabels[row.kind],
                  },

                  { title: "Nhân viên", dataIndex: "employeeName" },

                  { title: "Ca", dataIndex: "shiftName" },

                  { title: "Ghi chú", dataIndex: "note" },
                ]}
              />
            ),
          },
        ]}
      />
      <Modal
        className="execution-command-modal"
        width={560}
        centered
        open={!!kind}
        title={kind ? `${kindLabels[kind]} · ${work.code}` : ""}
        onCancel={() => {
          if (!busy) setKind(undefined)
        }}
        onOk={submit}
        confirmLoading={busy}
        okText={kind ? kindLabels[kind] : "Xác nhận"}
        okButtonProps={{ size: "large" }}
        cancelButtonProps={{ size: "large" }}
        cancelText="Hủy"
        destroyOnHidden
      >
        <div className="execution-modal-context">
          <div>
            <span>CÔNG ĐOẠN</span>
            <strong>{step?.name}</strong>
          </div>
          <div>
            <span>NHÂN VIÊN · CA</span>
            <strong>
              {String(current.employee?.name || "—")} ·{" "}
              {String(current.slot?.shift.name || "—")}
            </strong>
          </div>
        </div>
        <div className="execution-modal-quantities">
          <div>
            <span>Kế hoạch</span>
            <strong>
              {order?.quantity.toLocaleString("vi-VN")}{" "}
              <small>{source?.product.unit}</small>
            </strong>
          </div>
          <div>
            <span>Đã ghi nhận</span>
            <strong>{actual.quantity.toLocaleString("vi-VN")}</strong>
          </div>
        </div>
        <p className="execution-modal-time">
          Thời điểm xác nhận: {now.toLocaleString("vi-VN")}
        </p>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            style={{ marginBottom: 16 }}
          />
        )}
        {kind === "COMPLETE" && (
          <>
            <p>Bắt đầu thực tế: {formatTime(actual.start)}</p>
            {actual.quantity < (order?.quantity || 0) && (
              <Alert
                type="warning"
                showIcon
                title="Sản lượng đã ghi nhận chưa đạt số lượng kế hoạch. Bạn có chắc chắn muốn hoàn thành Lệnh làm việc?"
                style={{ marginBottom: 16 }}
              />
            )}
          </>
        )}
        <Form
          form={form}
          layout="vertical"
          name="execution-command"
          preserve={false}
        >
          {kind === "REPORT" && (
            <Form.Item
              name="quantity"
              label="Sản lượng thực hiện"
              rules={[
                { required: true, message: "Nhập sản lượng lớn hơn 0" },

                {
                  type: "number",

                  min: Number.MIN_VALUE,

                  message: "Sản lượng phải lớn hơn 0",
                },
              ]}
            >
              <InputNumber
                size="large"
                className="execution-quantity-input"
                placeholder="Nhập sản lượng lần này"
                style={{ width: "100%" }}
              />
            </Form.Item>
          )}
          {kind === "PAUSE" && (
            <>
              <Form.Item
                name="reasonId"
                label="Nguyên nhân dừng"
                rules={[{ required: true, message: "Chọn nguyên nhân dừng" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={all.stops

                    .filter(active)

                    .map((row) => ({
                      value: row.id,

                      label: `${row.code} · ${row.name}`,
                    }))}
                />
              </Form.Item>
              <p>Nhóm nguyên nhân: {text(reason?.group) || "—"}</p>
              <Form.Item name="machineId" label="Máy liên quan (nếu có)">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={stationsMachines.map((row) => ({
                    value: row.id,

                    label: `${row.code} · ${row.name}`,
                  }))}
                />
              </Form.Item>
            </>
          )}
          {["REPORT", "PAUSE", "COMPLETE"].includes(kind || "") && (
            <Form.Item
              name="note"
              label={
                kind === "COMPLETE" && actual.quantity < (order?.quantity || 0)
                  ? "Lý do hoàn thành thiếu sản lượng"
                  : "Ghi chú"
              }
              rules={
                kind === "COMPLETE" && actual.quantity < (order?.quantity || 0)
                  ? [
                      {
                        required: true,

                        whitespace: true,

                        message: "Nhập lý do hoàn thành thiếu sản lượng",
                      },
                    ]
                  : []
              }
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
