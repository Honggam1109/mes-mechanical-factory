import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import { useRef, useState } from "react"

import { Alert, Button, Form, Input, Modal, Select, Typography } from "antd"

import { unitKinds, type Unit, type UnitValues } from "../types/unit"

export default function UnitFormModal({
  record,

  readOnly,

  onClose,

  onSave,
}: {
  record: Unit | null

  readOnly: boolean

  onClose: () => void

  onSave: (values: UnitValues) => void
}) {
  const [form] = Form.useForm<UnitValues>(),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    pending = useRef(false)

  const [dirty, setDirty] = useState(false)

  useUnsavedChanges(dirty && !readOnly, () => {
    setDirty(false)
    onClose()
  })

  const close = () => {
    if (!dirty || readOnly) onClose()
    else
      Modal.confirm({
        title: "Thay đổi chưa lưu",
        content: "Rời khỏi sẽ bỏ các thay đổi chưa lưu.",
        okText: "Rời khỏi",
        cancelText: "Tiếp tục chỉnh sửa",
        onOk: onClose,
      })
  }

  const save = async () => {
    if (pending.current) return

    pending.current = true

    try {
      const values = await form.validateFields()

      setSaving(true)

      setError("")

      onSave({
        ...values,

        label: values.label ?? "",

        description: values.description ?? "",

        status: values.status ?? "ACTIVE",
      })

      onClose()
    } catch (e) {
      if (e instanceof Error) setError(e.message)
    } finally {
      pending.current = false

      setSaving(false)
    }
  }

  return (
    <Modal
      open
      centered
      width={560}
      title={
        readOnly
          ? "Chi tiết đơn vị tính"
          : record
            ? "Sửa đơn vị tính"
            : "Thêm mới đơn vị tính"
      }
      onCancel={() => {
        if (!pending.current) close()
      }}
      maskClosable={!saving}
      keyboard={!saving}
      closable={!saving}
      footer={
        <>
          <Button disabled={saving} onClick={close}>
            {readOnly ? "Đóng" : "Hủy"}
          </Button>
          {!readOnly && (
            <Button type="primary" loading={saving} onClick={() => void save()}>
              {record ? "Lưu" : "Thêm mới"}
            </Button>
          )}
        </>
      }
    >
      <Typography.Paragraph type="secondary">
        {readOnly
          ? "Thông tin đơn vị đo lường."
          : "Khai báo thông tin đơn vị đo lường."}
      </Typography.Paragraph>
      <Form
        name="unit-editor"
        form={form}
        onValuesChange={() => setDirty(true)}
        layout="vertical"
        disabled={readOnly || saving}
        initialValues={
          record ?? {
            name: "",

            label: "",

            kind: "COUNT",

            description: "",

            status: "ACTIVE",
          }
        }
      >
        <Form.Item
          name="name"
          label="Tên đơn vị"
          rules={[
            {
              required: true,

              whitespace: true,

              message: "Vui lòng nhập tên đơn vị.",
            },
          ]}
        >
          <Input placeholder="Ví dụ: Chiếc, Hộp, Kg..." />
        </Form.Item>
        <Form.Item name="label" label="Nhãn đơn vị">
          <Input placeholder="Ví dụ: pcs, box, kg..." />
        </Form.Item>
        <Form.Item
          name="kind"
          label="Loại đơn vị"
          rules={[{ required: true, message: "Vui lòng chọn loại đơn vị." }]}
        >
          <Select
            options={unitKinds.map((k) => ({
              value: k.value,

              label: `${k.label} (${k.value})`,
            }))}
          />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea
            rows={4}
            placeholder="Nhập mô tả thêm về đơn vị tính..."
          />
        </Form.Item>
        {
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "ACTIVE", label: "Sử dụng" },

                { value: "INACTIVE", label: "Ngừng sử dụng" },
              ]}
            />
          </Form.Item>
        }
      </Form>
      {error && <Alert showIcon type="error" title={error} />}
    </Modal>
  )
}
