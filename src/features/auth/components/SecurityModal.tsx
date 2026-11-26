import PasswordModal from "../../system/PasswordModal"
export default function SecurityModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return <PasswordModal open={open} onClose={onClose} self />
}
