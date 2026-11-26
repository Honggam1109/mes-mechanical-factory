import { Button } from "antd"
import type { ButtonProps } from "antd"
import { ArrowLeftOutlined } from "@ant-design/icons"
import { AppConfig } from "../../app/config/theme"

export default function BackToListButton({ children = "Quay lại danh sách", style, ...props }: ButtonProps) {
  return <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: AppConfig.theme.light.colors.primary, ...style }} {...props}>{children}</Button>
}
