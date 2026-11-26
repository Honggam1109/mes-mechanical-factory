import { forwardRef } from "react"
import type { ComponentRef } from "react"
import { Button } from "antd"
import type { ButtonProps } from "antd"
import { PlusOutlined } from "@ant-design/icons"

export type AddButtonProps = Omit<ButtonProps, "type" | "icon" | "danger">

const AddButton = forwardRef<ComponentRef<typeof Button>, AddButtonProps>(function AddButton({ children = "Thêm mới", ...props }, ref) {
  return <Button {...props} ref={ref} type="primary" icon={<PlusOutlined />}>{children}</Button>
})
export default AddButton
