import { useRef, useState } from "react"
import { Form, Input, Modal, message } from "antd"
import { request } from "./service"
export const passwordRule = {
  pattern: /^(?=.{8,50}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/,
  message: "Mật khẩu chưa đáp ứng yêu cầu bảo mật.",
}
export default function PasswordModal({
  userId,
  open,
  onClose,
  onSaved,
  self = false,
}: {
  userId?: string
  open: boolean
  onClose: () => void
  onSaved?: () => void
  self?: boolean
}) {
  const [form] = Form.useForm(),
    [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const save = async () => {
    if (pending.current) return
    pending.current = true
    try {
      const values = await form.validateFields()
      setSaving(true)
      await request(
        self ? "/auth/password" : `/users/${userId}/reset-password`,
        "POST",
        values,
      )
      message.success("Đã cập nhật mật khẩu.")
      form.resetFields()
      onSaved?.()
      onClose()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      pending.current = false
      setSaving(false)
    }
  }
  return (
    <Modal
      title={self ? "Đổi mật khẩu" : "Reset mật khẩu"}
      open={open}
      onCancel={() => {
        if (!saving) {
          form.resetFields()
          onClose()
        }
      }}
      onOk={() => void save()}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" disabled={saving} preserve={false}>
        {self && (
          <Form.Item
            name="currentPassword"
            label="Mật khẩu hiện tại"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu hiện tại." },
            ]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
        )}
        <Form.Item
          name="password"
          label="Mật khẩu mới"
          extra="8–50 ký tự, gồm chữ hoa, chữ thường, số và không khoảng trắng."
          rules={[
            { required: true, message: "Vui lòng nhập mật khẩu." },
            passwordRule,
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Xác nhận mật khẩu mới"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Vui lòng xác nhận mật khẩu." },
            ({ getFieldValue }) => ({
              validator: (_, value: string) =>
                value === getFieldValue("password")
                  ? Promise.resolve()
                  : Promise.reject(new Error("Xác nhận mật khẩu không khớp.")),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
