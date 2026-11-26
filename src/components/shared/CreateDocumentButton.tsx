import AddButton from "./AddButton"
import { Dropdown } from "antd"
import { DownOutlined } from "@ant-design/icons"
interface DocumentTypeOption {
  value: string
  label: string
}
interface CreateDocumentButtonProps {
  types: DocumentTypeOption[]
  onSelect: (type: string) => void
  disabled?: boolean
  loading?: boolean
}
export default function CreateDocumentButton({ types, onSelect, disabled = false, loading = false }: CreateDocumentButtonProps) {
  return <Dropdown trigger={["click"]} disabled={disabled || loading} menu={{ items: types.map(type => ({ key: type.value, label: type.label })), onClick: ({ key }) => onSelect(key) }}>
    <AddButton disabled={disabled} loading={loading}>Tạo chứng từ <DownOutlined /></AddButton>
  </Dropdown>
}
