import type { ReactNode } from "react"
import type { ButtonProps } from "antd"
import BackToListButton from "./BackToListButton"
import FormToolbar from "./FormToolbar"
import type { FormToolbarProps } from "./FormToolbar"
import { AppConfig } from "../../app/config/theme"

interface FormHeaderProps extends FormToolbarProps {
  actions?: ReactNode
  onBack: () => void
  backLabel?: ReactNode
  backButtonProps?: ButtonProps
  variant?: "standard" | "account"
}
export default function FormHeader({ actions, onBack, backLabel, backButtonProps, variant = "standard", ...toolbar }: FormHeaderProps) {
  const account = variant === "account"
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
    marginBottom: account ? 32 : 24, paddingBottom: account ? undefined : 16,
    borderBottom: account ? undefined : `1px solid ${AppConfig.theme.light.colors.borderColor}` }}>
    <BackToListButton onClick={onBack} {...backButtonProps}>{backLabel}</BackToListButton>
    {actions !== undefined ? actions : <FormToolbar {...toolbar} />}
  </div>
}
