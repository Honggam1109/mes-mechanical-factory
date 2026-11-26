import Select from "@/components/shared/SelectableSelect"
import { useEffect, useState } from "react"

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Modal,
  Progress,
  Space,
  Typography,
  message,
} from "antd"

import { DeleteOutlined, EditOutlined } from "@ant-design/icons"

import FormHeader from "../../../components/shared/FormHeader"

import AddButton from "../../../components/shared/AddButton"

import DataTable from "../../../components/shared/DataTable"

import ConfirmDeleteDialog from "../../../components/shared/ConfirmDeleteDialog"

import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import { navigate, useAuth } from "../../auth/AuthContext"

import type { Catalog } from "../../process-bom/lib/model"

import { text } from "../../process-bom/lib/model"

import { ids } from "../../master-data/rules"

import type { ShiftAssignment, WorkOrder } from "../types"

import { hasAction, inScope } from "../lib/access"

import {
  eligibleStations,
  formatTime,
  percent,
  productionState,
  workActuals,
  workContext,
  workStatus,
} from "../lib/model"

import { assignStation, deleteAssignment } from "../lib/remoteService"

import StatusBadge from "./StatusBadge"

import AssignmentDialog from "./AssignmentDialog"

export default function WorkOrderDetail({
  work,

  all,

  view,

  onBack,
}: {
  work: WorkOrder

  all: Catalog

  view: boolean

  onBack: () => void
}) {
  const { auth } = useAuth(),
    [selected, setSelected] = useState(work.stationId),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [dialog, setDialog] = useState<{ record?: ShiftAssignment }>(),
    [deleting, setDeleting] = useState<ShiftAssignment>()

  useEffect(() => {
    setSelected(work.stationId)
  }, [work.stationId])

  const state = productionState(all),
    { order, source, step } = workContext(work, all),
    status = workStatus(work, all),
    actual = workActuals(work.id, all),
    editable =
      !view &&
      ["UNASSIGNED", "ASSIGNED"].includes(status) &&
      hasAction(auth, "PRODUCTION_ASSIGNMENT", "ASSIGN") &&
      inScope(auth, "PRODUCTION_ASSIGNMENT", "WRITE", work, all)

  const personnelEditable =
    !view &&
    !["COMPLETED", "CANCELLED"].includes(status) &&
    hasAction(auth, "PRODUCTION_ASSIGNMENT", "ASSIGN") &&
    inScope(auth, "PRODUCTION_ASSIGNMENT", "WRITE", work, all)

  const dirty = selected !== work.stationId,
    withoutGuard = useUnsavedChanges(dirty && editable, () =>
      setSelected(work.stationId),
    ),
    station = all.stations.find((station) => station.id === selected),
    rows = state.assignments.filter((row) => row.workOrderId === work.id),
    eligible = eligibleStations(work, all)

  const displayed =
    station && !eligible.some((row) => row.id === station.id)
      ? [...eligible, station]
      : eligible

  const back = () => {
    if (dirty && editable)
      Modal.confirm({
        title: "Thay đổi chưa lưu",

        content: "Chưa lưu thay đổi Trạm sản xuất.",

        okText: "Rời khỏi",

        cancelText: "Tiếp tục chỉnh sửa",

        onOk: () => withoutGuard(onBack),
      })
    else onBack()
  }

  const saveStation = async (reset = false) => {
    if (saving || !editable) return

    try {
      setSaving(true)

      setError("")

      await assignStation(work.id, selected, auth, reset)

      message.success("Đã lưu Trạm sản xuất.")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể lưu trạm.")
    } finally {
      setSaving(false)
    }
  }

  const stationAction = () => {
    if (dirty && rows.some((row) => row.status === "ACTIVE"))
      Modal.confirm({
        title: "Đổi Trạm và xóa phân công nhân sự cũ?",

        content:
          "Các dòng Ngày + Ca + Nhân viên hiện tại sẽ bị xóa. Bạn cần phân công lại nhân sự cho Trạm mới.",

        okText: "Đổi Trạm",

        cancelText: "Giữ nguyên",

        onOk: () => saveStation(true),
      })
    else saveStation()
  }

  return (
    <Card bordered={false}>
      <Typography.Title level={4}>
        {view ? "Chi tiết" : "Phân công"} Lệnh làm việc: {work.code}
      </Typography.Title>
      <FormHeader
        onBack={back}
        onReset={() => setSelected(work.stationId)}
        onSave={stationAction}
        actions={
          <Space>
            {view &&
              ["UNASSIGNED", "ASSIGNED"].includes(status) &&
              hasAction(auth, "PRODUCTION_ASSIGNMENT", "ASSIGN") &&
              inScope(auth, "PRODUCTION_ASSIGNMENT", "WRITE", work, all) && (
                <Button
                  type="primary"
                  onClick={() =>
                    navigate(
                      `/workspace/production-assignments?record=${encodeURIComponent(work.id)}`,
                    )
                  }
                >
                  Phân công
                </Button>
              )}
            <StatusBadge status={status} />
          </Space>
        }
      />
      {error && (
        <Alert
          type="error"
          showIcon
          title="Không thể phân công"
          description={<div style={{ whiteSpace: "pre-line" }}>{error}</div>}
          style={{ marginBottom: 16 }}
        />
      )}
      <Typography.Title level={5}>Thông tin Lệnh làm việc</Typography.Title>
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, md: 3 }}
        items={[
          { key: "wo", label: "Mã WO", children: work.code },

          {
            key: "mo",

            label: "Lệnh sản xuất",

            children: order && (
              <Button
                type="link"
                disabled={
                  !hasAction(auth, "PRODUCTION_ORDER", "VIEW") ||
                  !inScope(auth, "PRODUCTION_ORDER", "VIEW", order, all)
                }
                onClick={() =>
                  navigate(
                    `/workspace/production-orders?record=${encodeURIComponent(work.orderId)}`,
                  )
                }
              >
                {order.code}
              </Button>
            ),
          },

          {
            key: "product",

            label: "Sản phẩm",

            children: `${source?.product.code || ""} · ${source?.product.name || ""}`,
          },

          {
            key: "operation",

            label: "Công đoạn",

            children: `${step?.code || ""} · ${step?.name || ""}`,
          },

          { key: "order", label: "Thứ tự", children: step?.order },

          {
            key: "quantity",

            label: "Số lượng kế hoạch",

            children: `${order?.quantity || 0} ${source?.product.unit || ""}`,
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
            key: "actualStart",

            label: "Bắt đầu thực tế",

            children: formatTime(actual.start),
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
                size="small"
                percent={Number(
                  percent(actual.quantity, order?.quantity || 0).toFixed(1),
                )}
              />
            ),
          },
        ]}
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Phân công Trạm sản xuất
      </Typography.Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          aria-label="Trạm sản xuất"
          style={{ minWidth: 320 }}
          showSearch
          optionFilterProp="label"
          disabled={!editable || saving}
          placeholder="Chọn Trạm thuộc đơn vị có khả năng thực hiện"
          value={selected || undefined}
          onChange={setSelected}
          options={displayed.map((station) => ({
            value: station.id,

            label: `${station.code} · ${station.name}`,

            disabled: !eligible.some((row) => row.id === station.id),
          }))}
        />
        {editable && (
          <>
            <Button
              type="primary"
              disabled={!selected || !dirty}
              loading={saving}
              onClick={stationAction}
            >
              Lưu Trạm
            </Button>
            {dirty && (
              <Button onClick={() => setSelected(work.stationId)}>
                Đặt lại
              </Button>
            )}
          </>
        )}
      </Space>
      <Descriptions
        size="small"
        bordered
        column={1}
        style={{ marginBottom: 16 }}
        items={[
          {
            key: "unit",

            label: "Đơn vị sản xuất",

            children:
              text(
                all.productionUnits.find(
                  (unit) => unit.id === station?.productionUnit,
                )?.name,
              ) || "—",
          },
        ]}
      />
      <DataTable
        rowKey="id"
        dataSource={all.machines.filter((machine) =>
          ids(station?.machineIds).includes(machine.id),
        )}
        pagination={false}
        columns={[
          { title: "Mã máy", dataIndex: "code" },

          { title: "Tên máy", dataIndex: "name" },

          { title: "Nhóm máy", dataIndex: "group" },

          {
            title: "Trạng thái",

            render: (_, machine) =>
              machine.status === "Hoạt động" ? "Hoạt động" : "Ngừng hoạt động",
          },
        ]}
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Nhân sự theo Ngày + Ca
      </Typography.Title>
      {!work.stationId && (
        <Alert
          type="info"
          showIcon
          title="Lưu Trạm sản xuất trước khi phân công nhân sự."
          style={{ marginBottom: 16 }}
        />
      )}
      {dirty && (
        <Alert
          type="warning"
          showIcon
          title="Đang thay đổi Trạm. Hãy lưu hoặc đặt lại trước khi sửa nhân sự."
          style={{ marginBottom: 16 }}
        />
      )}
      {personnelEditable && (
        <AddButton
          style={{ marginBottom: 16 }}
          disabled={!work.stationId || dirty}
          onClick={() => setDialog({})}
        >
          Thêm phân công
        </AddButton>
      )}
      <DataTable
        rowKey="id"
        dataSource={rows}
        scroll={{ x: 1000 }}
        columns={[
          { title: "STT", width: 60, render: (_, row, index) => index + 1 },

          { title: "Ngày làm việc", dataIndex: "date" },
          {
            title: "Giờ phân công",
            width: 190,
            render: (_, row) =>
              row.plannedStart ? (
                <>
                  {formatTime(row.plannedStart)}
                  <br />
                  {formatTime(row.plannedEnd || "")}
                </>
              ) : (
                "Theo toàn bộ ca"
              ),
          },

          {
            title: "Ca làm việc",

            render: (_, row) =>
              `${row.shiftSnapshot.name} (${row.shiftSnapshot.start}–${row.shiftSnapshot.end})`,
          },

          {
            title: "Nhân viên",

            render: (_, row) =>
              `${row.employeeSnapshot.code} · ${row.employeeSnapshot.name}`,
          },

          { title: "Sản lượng giao", render: (_, row) => row.quantity ?? "—" },

          {
            title: "Sản lượng thực hiện",

            render: (_, row) =>
              state.productionExecutions

                .filter(
                  (event) =>
                    event.assignmentId === row.id &&
                    event.workOrderId === work.id,
                )

                .reduce(
                  (sum, event) =>
                    sum + (event.quantity ?? event.good + event.ng),
                  0,
                ),
          },

          { title: "Ghi chú", dataIndex: "note" },

          ...(personnelEditable
            ? [
                {
                  title: "Thao tác",

                  width: 100,

                  render: (_: unknown, row: ShiftAssignment) => (
                    <Space>
                      <Button
                        type="text"
                        title="Sửa phân công"
                        aria-label={`Sửa phân công ${row.id}`}
                        icon={<EditOutlined />}
                        disabled={
                          dirty ||
                          state.productionExecutions.some(
                            (event) => event.assignmentId === row.id,
                          )
                        }
                        onClick={() => setDialog({ record: row })}
                      />
                      <Button
                        type="text"
                        danger
                        title="Xóa phân công"
                        aria-label={`Xóa phân công ${row.id}`}
                        icon={<DeleteOutlined />}
                        disabled={
                          dirty ||
                          state.productionExecutions.some(
                            (event) => event.assignmentId === row.id,
                          )
                        }
                        onClick={() => setDeleting(row)}
                      />
                    </Space>
                  ),
                },
              ]
            : []),
        ]}
        pagination={{ pageSize: 10 }}
      />
      {dialog && (
        <AssignmentDialog
          work={work}
          record={dialog.record}
          all={all}
          onClose={() => setDialog(undefined)}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          open
          content={
            <>
              Xóa phân công ngày <strong>{deleting.date}</strong>, ca{" "}
              <strong>{deleting.shiftSnapshot.name}</strong>?
            </>
          }
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => deleteAssignment(deleting.id, auth)}
        />
      )}
    </Card>
  )
}
