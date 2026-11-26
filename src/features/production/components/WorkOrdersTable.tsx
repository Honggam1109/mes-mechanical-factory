import { Button, Progress, Space, Typography } from "antd"

import { ScheduleOutlined } from "@ant-design/icons"

import DataTable from "../../../components/shared/DataTable"

import { navigate, useAuth } from "../../auth/AuthContext"

import type { Catalog } from "../../process-bom/lib/model"

import type { WorkOrder } from "../types"

import { hasAction, inScope } from "../lib/access"

import {
  formatTime,
  percent,
  productionState,
  workActuals,
  workContext,
  workStatus,
} from "../lib/model"

import StatusBadge from "./StatusBadge"

export default function WorkOrdersTable({
  rows,

  all,

  page = 1,

  size = 10,

  onPage,
}: {
  rows: WorkOrder[]

  all: Catalog

  page?: number

  size?: number

  onPage?: (page: number, size: number) => void
}) {
  const { auth } = useAuth(),
    state = productionState(all)

  const canView = (work: WorkOrder) =>
    hasAction(auth, "PRODUCTION_ASSIGNMENT", "VIEW") &&
    inScope(auth, "PRODUCTION_ASSIGNMENT", "VIEW", work, all)

  const open = (work: WorkOrder, view = false) =>
    navigate(
      `/workspace/production-assignments?record=${encodeURIComponent(work.id)}${
        view ? "&mode=view" : ""
      }`,
    )

  return (
    <DataTable
      rowKey="id"
      dataSource={rows}
      scroll={{ x: 1713 }}
      columns={[
        {
          title: "Mã WO",

          width: 126,

          render: (_, work) => (
            <Button
              type="link"
              disabled={!canView(work)}
              onClick={() => open(work)}
            >
              {work.code}
            </Button>
          ),
        },

        {
          title: "Lệnh sản xuất",

          width: 126,

          render: (_, work) => {
            const order = workContext(work, all).order

            return (
              <Button
                type="link"
                disabled={
                  !order ||
                  !hasAction(auth, "PRODUCTION_ORDER", "VIEW") ||
                  !inScope(auth, "PRODUCTION_ORDER", "VIEW", order, all)
                }
                onClick={() =>
                  navigate(
                    `/workspace/production-orders?record=${encodeURIComponent(work.orderId)}`,
                  )
                }
              >
                {order?.code || "—"}
              </Button>
            )
          },
        },

        {
          title: "Sản phẩm",

          width: 176,

          render: (_, work) => {
            const product = workContext(work, all).source?.product

            return (
              <>
                {product?.name}
                <br />
                <Typography.Text type="secondary">
                  {product?.code}
                </Typography.Text>
              </>
            )
          },
        },

        {
          title: "Thứ tự",

          width: 67,

          render: (_, work) => workContext(work, all).step?.order,
        },

        {
          title: "Công đoạn",

          width: 160,

          render: (_, work) => {
            const step = workContext(work, all).step

            return (
              <>
                {step?.name}
                <br />
                <Typography.Text type="secondary">{step?.code}</Typography.Text>
              </>
            )
          },
        },

        {
          title: "Trạm sản xuất",

          width: 126,

          render: (_, work) =>
            String(workContext(work, all).station?.name || "Chưa phân công"),
        },

        {
          title: "Đơn vị sản xuất",

          width: 134,

          render: (_, work) =>
            String(
              all.productionUnits.find(
                (unit) =>
                  unit.id === workContext(work, all).station?.productionUnit,
              )?.name || "—",
            ),
        },

        {
          title: "SL kế hoạch",

          width: 92,

          render: (_, work) => {
            const { order, source } = workContext(work, all)

            return `${order?.quantity || 0} ${source?.product.unit || ""}`
          },
        },

        {
          title: "Bắt đầu KH",

          width: 134,

          render: (_, work) => formatTime(workContext(work, all).step?.start),
        },

        {
          title: "Hoàn thành KH",

          width: 134,

          render: (_, work) => formatTime(workContext(work, all).step?.end),
        },

        {
          title: "Số ca",

          width: 67,

          render: (_, work) =>
            state.assignments.filter(
              (row) => row.workOrderId === work.id && row.status === "ACTIVE",
            ).length,
        },

        {
          title: "SL thực hiện",

          width: 71,

          render: (_, work) => workActuals(work.id, all).quantity,
        },

        {
          title: "Tiến độ",

          width: 118,

          render: (_, work) => (
            <Progress
              size="small"
              percent={Number(
                percent(
                  workActuals(work.id, all).quantity,

                  workContext(work, all).order?.quantity || 0,
                ).toFixed(1),
              )}
            />
          ),
        },

        {
          title: "Trạng thái",

          width: 126,

          render: (_, work) => <StatusBadge status={workStatus(work, all)} />,
        },

        {
          title: "Thao tác",

          width: 56,

          fixed: "right",

          render: (_, work) => (
            <Space>
              
              {hasAction(auth, "PRODUCTION_ASSIGNMENT", "ASSIGN") &&
                ["UNASSIGNED", "ASSIGNED"].includes(workStatus(work, all)) && (
                  <Button
                    type="text"
                    title="Phân công"
                    aria-label={`Phân công ${work.code}`}
                    icon={<ScheduleOutlined />}
                    disabled={
                      !canView(work) ||
                      !inScope(
                        auth,

                        "PRODUCTION_ASSIGNMENT",

                        "WRITE",

                        work,

                        all,
                      )
                    }
                    onClick={() => open(work)}
                  />
                )}
            </Space>
          ),
        },
      ]}
      pagination={
        onPage
          ? {
              total: rows.length,

              current: Math.min(
                page,

                Math.max(1, Math.ceil(rows.length / size)),
              ),

              pageSize: size,

              onChange: onPage,

              showTotal: (total, range) =>
                `Hiển thị ${range[0]}–${range[1]} trên ${total} WO`,
            }
          : { pageSize: 10, showTotal: (total) => `${total} WO` }
      }
    />
  )
}
