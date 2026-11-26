import StatusTag from "@/components/shared/StatusTag"
import { } from "antd"

import { orderLabels, workLabels } from "../lib/model"

export default function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { ...orderLabels, ...workLabels }

  const colors: Record<string, string> = {
    DRAFT: "default",

    RELEASED: "blue",

    UNASSIGNED: "default",

    ASSIGNED: "cyan",

    PAUSED: "orange",

    IN_PROGRESS: "processing",

    COMPLETED: "success",

    CANCELLED: "error",
  }

  return <StatusTag color={colors[status]}>{labels[status] || status}</StatusTag>
}
