import StatusTag from "@/components/shared/StatusTag"
import { Button, Descriptions, Progress, Space, Typography } from "antd"

import { navigate, useAuth } from "../../auth/AuthContext"

import type { Catalog } from "../../process-bom/lib/model"

import type { WorkOrder } from "../types"

import { hasAction, inScope } from "../lib/access"

import {
  formatTime,
  percent,
  workActuals,
  workContext,
  workStatus,
} from "../lib/model"

import {
  deadlineLabel,
  monitorColors,
  monitorLabels,
  monitorWorkState,
} from "../lib/monitor"

import StatusBadge from "./StatusBadge"

export default function MonitorWork({
  work,

  all,

  now,

  onOpen,

  compact = false,
}: {
  work: WorkOrder

  all: Catalog

  now: Date

  onOpen?: (id: string) => void

  compact?: boolean
}) {
  const { auth } = useAuth(),
    { order, source, step } = workContext(work, all),
    actual = workActuals(work.id, all),
    due = Number(new Date(step?.end || "")) - now.getTime(),
    status = monitorWorkState(work, all, now)

  const canViewWork =
    hasAction(auth, "PRODUCTION_ASSIGNMENT", "VIEW") &&
    inScope(auth, "PRODUCTION_ASSIGNMENT", "VIEW", work, all)

  const amount = `${actual.quantity.toLocaleString("vi-VN")} / ${order?.quantity.toLocaleString("vi-VN")} ${source?.product.unit || ""}`

  return (
    <>
      <Space wrap>
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() =>
            onOpen
              ? onOpen(work.id)
              : navigate(
                  `/workspace/production-assignments?record=${work.id}&mode=view`,
                )
          }
          disabled={!onOpen && !canViewWork}
        >
          {work.code}
        </Button>
        {compact ? (
          <span>{order?.code}</span>
        ) : (
          <Button
            type="link"
            disabled={
              !order ||
              !hasAction(auth, "PRODUCTION_ORDER", "VIEW") ||
              !inScope(auth, "PRODUCTION_ORDER", "VIEW", order, all)
            }
            onClick={() =>
              navigate(
                `/workspace/production-orders?record=${work.orderId}&mode=view`,
              )
            }
          >
            {order?.code}
          </Button>
        )}
        {!compact && (
          <>
            <StatusBadge status={workStatus(work, all)} />
            {status !== workStatus(work, all) && (
              <StatusTag color={monitorColors[status]}>{monitorLabels[status]}</StatusTag>
            )}
          </>
        )}
      </Space>
      <Typography.Paragraph style={{ marginBottom: 6, fontWeight: 500 }}>
        {source?.product.name}
      </Typography.Paragraph>
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        {step?.order} · {step?.name}
      </Typography.Paragraph>
      <span>{amount}</span>
      <Progress
        percent={Number(
          percent(actual.quantity, order?.quantity || 0).toFixed(1),
        )}
        size="small"
      />
      {compact ? (
        <>
          <div>Bắt đầu KH: {formatTime(step?.start)}</div>
          <div>Hoàn thành KH: {formatTime(step?.end)}</div>
          {actual.start && (
            <div>Bắt đầu thực tế: {formatTime(actual.start)}</div>
          )}
          <Typography.Text
            type={
              due < 0 ? "danger" : due <= 30 * 60000 ? "warning" : "secondary"
            }
          >
            {deadlineLabel(step?.end, now)}
          </Typography.Text>
        </>
      ) : (
        <Descriptions
          size="small"
          column={{ xs: 1, md: 2 }}
          style={{ marginTop: 12 }}
          items={[
            {
              key: "start",

              label: "Bắt đầu kế hoạch",

              children: formatTime(step?.start),
            },

            {
              key: "end",

              label: "Hoàn thành kế hoạch",

              children: formatTime(step?.end),
            },

            {
              key: "actual",

              label: "Bắt đầu thực tế",

              children: formatTime(actual.start),
            },

            {
              key: "deadline",

              label: "Thời gian còn lại",

              children: actual.completed
                ? `Đã hoàn thành lúc ${formatTime(actual.end)}`
                : workStatus(work, all) === "CANCELLED"
                  ? "Đã hủy"
                  : deadlineLabel(step?.end, now),
            },
          ]}
        />
      )}
    </>
  )
}
