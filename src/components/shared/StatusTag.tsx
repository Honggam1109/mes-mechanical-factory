import { Tag } from "antd"
import type { TagProps } from "antd"

type Tone = "success" | "progress" | "waiting" | "neutral" | "danger"

function statusTone(label: string, color: TagProps["color"]): Tone {
  const text = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
  if (/huy|qua han|loi|bat thuong|thieu|chua co nhan vien|xung dot|khoa/.test(text)) return "danger"
  if (/nhap|ngung|khong hoat dong|khong su dung|luu tru|het hieu luc|chua den|khong co cong viec/.test(text)) return "neutral"
  if (/cho|tam dung|dang dung|chua phan cong/.test(text)) return "waiting"
  if (/dang thuc hien|dang chay|dang xu ly/.test(text)) return "progress"
  if (/hoat dong|hoan thanh|hoan tat|su dung|san sang|da ket thuc|da ap dung|dang ap dung/.test(text)) return "success"
  if (/success|green/.test(String(color))) return "success"
  if (/error|red|volcano/.test(String(color))) return "danger"
  if (/orange|gold|warning/.test(String(color))) return "waiting"
  if (/blue|cyan|processing/.test(String(color))) return "progress"
  return "neutral"
}

export default function StatusTag({ children, color, className = "", style, ...props }: TagProps) {
  const tone = statusTone(typeof children === "string" ? children : "", color)
  return <Tag {...props} className={`mes-status-tag mes-status-${tone} ${className}`} style={style}>
    <span className="mes-status-dot" aria-hidden="true" />{children}
  </Tag>
}
