import StatusTag from "@/components/shared/StatusTag"
import { Space, Typography, theme } from "antd"
import { CheckOutlined, RightOutlined } from "@ant-design/icons"
import { documentStatuses, documentTypes } from "../config/documentOptions"

interface Props {
  code: string
  type: string
  status?: string
  confirmedAt?: string
}

export default function DocumentStatusHeader({ code, type, status, confirmedAt }: Props) {
  const { token } = theme.useToken()
  const current = documentStatuses.find(item => item.value === status)
  const stages = documentStatuses.filter(item => item.value !== "cancelled")
  const active = stages.findIndex(item => item.value === status)
  return <section aria-label="Trạng thái chứng từ">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: token.marginSM, marginBottom: token.margin }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0, marginBottom: 4 }}>Chứng từ {documentTypes.find(item => item.value === type)?.label.toLowerCase()}</Typography.Title>
        <Typography.Text type="secondary">{code}</Typography.Text>
      </div>
      <StatusTag color={current?.color} style={{ margin: 0, border: "none", padding: "4px 12px", borderRadius: token.borderRadius }}>{current?.label ?? "Chưa lưu"}</StatusTag>
    </div>
    <div style={{ background: token.colorFillAlter, borderRadius: token.borderRadiusLG, padding: "12px 16px" }}>
      {status === "cancelled" ? <Typography.Text type="danger">Chứng từ đã hủy</Typography.Text> : <ol style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", margin: 0, padding: 0, listStyle: "none" }}>
        {stages.map((stage, index) => {
          const selected = index === active
          const done = active > index
          const color = selected ? token.colorPrimary : done ? token.colorTextSecondary : token.colorTextTertiary
          return <li key={stage.value} aria-current={selected ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {index > 0 && <RightOutlined aria-hidden style={{ fontSize: 9, color: token.colorTextQuaternary }} />}
            <Space size={8} style={{ fontSize: token.fontSizeSM, color, fontWeight: selected ? 600 : 400 }}>
              {done ? <CheckOutlined style={{ fontSize: 11 }} /> : <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />}
              {stage.label}
            </Space>
          </li>
        })}
      </ol>}
    </div>
    {confirmedAt && <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM, marginTop: token.marginSM }}>Xác nhận lúc {new Date(confirmedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Typography.Text>}
  </section>
}
