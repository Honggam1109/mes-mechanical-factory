import { Avatar, Descriptions, Modal, Tag } from "antd"
import { useAuth } from "../AuthContext"
export default function ProfileModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { auth } = useAuth()
  return (
    <Modal
      title="Thông tin tài khoản"
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <Avatar size={64} src={auth?.user.avatar}>
        {auth?.user.username.slice(0, 2).toUpperCase()}
      </Avatar>
      <Descriptions
        column={1}
        style={{ marginTop: 24 }}
        items={[
          {
            key: "username",
            label: "Tên đăng nhập",
            children: auth?.user.username,
          },
          {
            key: "fullName",
            label: "Họ và tên",
            children: auth?.user.fullName,
          },
          { key: "email", label: "Email", children: auth?.user.email || "—" },
          {
            key: "employee",
            label: "Nhân viên",
            children: auth?.employee?.code || "—",
          },
          {
            key: "roles",
            label: "Vai trò",
            children: auth?.roles.map((r) => <Tag key={r.id}>{r.name}</Tag>),
          },
        ]}
      />
    </Modal>
  )
}
