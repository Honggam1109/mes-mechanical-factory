import Select from "@/components/shared/SelectableSelect"
import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import { useRef, useState } from "react"

import {
  Alert,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
} from "antd"

import type { Catalog } from "../../process-bom/lib/model"

import { active, text } from "../../process-bom/lib/model"

import { useAuth } from "../../auth/AuthContext"

import type { ShiftAssignment, WorkOrder } from "../types"

import {
  employeeUnit,
  formatTime,
  shiftInterval,
  workContext,
} from "../lib/model"

import { saveAssignment } from "../lib/remoteService"

const localInput = (value?: string) => {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

export default function AssignmentDialog({
  work,

  record,

  all,

  onClose,
}: {
  work: WorkOrder

  record?: ShiftAssignment

  all: Catalog

  onClose: () => void
}) {
  const { auth } = useAuth(),
    [form] = Form.useForm(),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    { step, station } = workContext(work, all)

  const pending = useRef(false)

  useUnsavedChanges(dirty, () => {
    setDirty(false)
    onClose()
  })

  const shiftId = Form.useWatch("shiftId", form),
    date = Form.useWatch("date", form),
    shift = all.shifts.find((shift) => shift.id === shiftId),
    interval = shiftInterval(date || "", {
      start: text(shift?.start),

      end: text(shift?.end),
    })

  const close = () => {
    if (saving) return

    if (dirty)
      Modal.confirm({
        title: "Thay đổi chưa lưu",

        content: "Đóng cửa sổ sẽ bỏ thay đổi phân công.",

        okText: "Đóng",

        cancelText: "Tiếp tục chỉnh sửa",

        onOk: onClose,
      })
    else onClose()
  }

  return (
    <Modal
      open
      title={
        record ? "Sửa phân công nhân sự theo ca" : "Phân công nhân sự theo ca"
      }
      width={680}
      okText="Xác nhận"
      cancelText="Hủy"
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      maskClosable={false}
      closable={!saving}
      onCancel={close}
      onOk={async () => {
        if (pending.current) return

        pending.current = true

        try {
          const values = await form.validateFields()

          setSaving(true)

          setError("")

          await saveAssignment(
            {
              ...values,

              workOrderId: work.id,

              note: values.note || "",

              quantity: values.quantity == null ? undefined : values.quantity,
            },

            auth,

            record?.id,
          )

          setDirty(false)

          message.success("Đã lưu phân công nhân sự theo ca.")

          onClose()
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
      }}
    >
      <Descriptions
        size="small"
        bordered
        column={1}
        style={{ marginBottom: 16 }}
        items={[
          { key: "work", label: "Lệnh làm việc", children: work.code },

          { key: "operation", label: "Công đoạn", children: step?.name },

          {
            key: "station",

            label: "Trạm sản xuất",

            children: text(station?.name),
          },

          {
            key: "unit",

            label: "Đơn vị sản xuất",

            children: text(
              all.productionUnits.find(
                (unit) => unit.id === station?.productionUnit,
              )?.name,
            ),
          },

          {
            key: "plan",

            label: "Khoảng kế hoạch",

            children: `${formatTime(step?.start)} – ${formatTime(step?.end)}`,
          },
        ]}
      />
      {error && (
        <Alert
          type="error"
          showIcon
          title="Phân công chưa hợp lệ"
          description={<div style={{ whiteSpace: "pre-line" }}>{error}</div>}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        name="shift-assignment"
        layout="vertical"
        disabled={saving}
        initialValues={
          record
            ? {
                date: record.date,

                shiftId: record.shiftId,

                employeeId: record.employeeId,

                quantity: record.quantity,

                note: record.note,
                plannedStart: localInput(record.plannedStart || step?.start),
                plannedEnd: localInput(record.plannedEnd || step?.end),
              }
            : {
                date: localInput(step?.start).slice(0, 10),
                note: "",
                plannedStart: localInput(step?.start),
                plannedEnd: localInput(step?.end),
              }
        }
        onValuesChange={() => setDirty(true)}
      >
        <Form.Item
          name="date"
          label="Ngày làm việc"
          rules={[{ required: true, message: "Chọn ngày làm việc." }]}
        >
          <Input
            type="date"
            min={step?.start.slice(0, 10)}
            max={step?.end.slice(0, 10)}
          />
        </Form.Item>
        <Form.Item
          name="shiftId"
          label="Ca làm việc"
          rules={[{ required: true, message: "Chọn ca làm việc." }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={all.shifts

              .filter((shift) => active(shift) || shift.id === record?.shiftId)

              .map((shift) => ({
                value: shift.id,

                label: `${shift.code} · ${shift.name} (${shift.start}–${shift.end}${
                  String(shift.end) <= String(shift.start) ? ", qua ngày" : ""
                })`,

                disabled: !active(shift),
              }))}
          />
        </Form.Item>
        <Form.Item
          name="plannedStart"
          label="Bắt đầu phân công"
          rules={[{ required: true, message: "Nhập giờ bắt đầu." }]}
        >
          <Input type="datetime-local" />
        </Form.Item>
        <Form.Item
          name="plannedEnd"
          label="Kết thúc phân công"
          rules={[{ required: true, message: "Nhập giờ kết thúc." }]}
        >
          <Input type="datetime-local" />
        </Form.Item>
        {Number.isFinite(interval.start) && (
          <Alert
            type="info"
            showIcon
            title={`Ca đã chọn: ${formatTime(new Date(interval.start).toISOString())} → ${formatTime(new Date(interval.end).toISOString())}`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item
          name="employeeId"
          label="Nhân viên"
          rules={[{ required: true, message: "Chọn nhân viên." }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Nhân viên đang làm việc cùng đơn vị với trạm"
            options={all.employees

              .filter(
                (employee) =>
                  (active(employee) &&
                    employeeUnit(employee) === station?.productionUnit) ||
                  employee.id === record?.employeeId,
              )

              .map((employee) => ({
                value: employee.id,

                label: `${employee.code} · ${employee.name}`,

                disabled:
                  !active(employee) ||
                  employeeUnit(employee) !== station?.productionUnit,
              }))}
          />
        </Form.Item>
        <Form.Item name="quantity" label="Sản lượng giao">
          <InputNumber
            min={0.000001}
            style={{ width: "100%" }}
            placeholder="Không bắt buộc"
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
