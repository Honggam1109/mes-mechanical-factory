import { validateExecutionEvent } from "./execution"

import type { Catalog } from "../../process-bom/lib/model"

import {
  eligibleStations,
  productionState,
  validateAssignment,
  validateOrder,
  workActuals,
  orderSource,
} from "./model"

export function validateProductionCommit(previous: Catalog, next: Catalog) {
  const before = productionState(previous),
    after = productionState(next),
    errors: string[] = []

  for (const rows of [
    after.productionOrders,

    after.workOrders,

    after.assignments,

    after.productionExecutions,
  ])
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      errors.push("Định danh dữ liệu sản xuất không được trùng.")

  for (const rows of [after.productionOrders, after.workOrders])
    if (new Set(rows.map((row) => row.code.toLowerCase())).size !== rows.length)
      errors.push("Mã lệnh không được trùng.")

  for (const order of after.productionOrders) {
    const old = before.productionOrders.find((row) => row.id === order.id)

    if (old && old.code !== order.code)
      errors.push("Không được sửa mã lệnh sản xuất.")

    if (
      order.status === "DRAFT" &&
      JSON.stringify(order) !== JSON.stringify(old)
    )
      errors.push(...validateOrder(order, next))

    if (order.status !== "DRAFT" && order.status !== "CANCELLED") {
      const source = orderSource(order, next),
        works = after.workOrders.filter((work) => work.orderId === order.id)

      if (
        !order.sourceSnapshot ||
        !source ||
        works.length !== source.steps.length ||
        source.steps.some(
          (step) =>
            works.filter((work) => work.stepId === step.stepId).length !== 1,
        )
      )
        errors.push(
          "Phát hành phải chốt dữ liệu và sinh đúng một WO cho mỗi bước trong cùng giao dịch.",
        )
    }

    const works = after.workOrders.filter((work) => work.orderId === order.id),
      actuals = works.map((work) => workActuals(work.id, next))

    if (
      order.status === "COMPLETED" &&
      (!actuals.length || !actuals.every((row) => row.completed))
    )
      errors.push("Chỉ hoàn thành lệnh khi tất cả WO đã hoàn thành thực tế.")

    if (order.status === "IN_PROGRESS" && !actuals.some((row) => row.started))
      errors.push("Trạng thái Đang thực hiện phải đến từ dữ liệu thực thi.")

    if (
      ["DRAFT", "RELEASED", "CANCELLED"].includes(order.status) &&
      actuals.some((row) => row.started)
    )
      errors.push("Trạng thái lệnh không khớp dữ liệu thực thi.")

    if (old?.status === "DRAFT" && order.status === "RELEASED") {
      errors.push(
        ...validateOrder({ ...order, sourceSnapshot: undefined }, next),
      )

      if (
        JSON.stringify(order.sourceSnapshot) !==
        JSON.stringify(
          orderSource({ ...order, sourceSnapshot: undefined }, previous),
        )
      )
        errors.push(
          "Dữ liệu chốt phải khớp BOM và quy trình tại lúc phát hành.",
        )
    }

    if (old && old.status !== "DRAFT") {
      const immutable = (row: typeof order) => {
        const { status, updatedAt, cancelledAt, ...rest } = row

        return JSON.stringify(rest)
      }

      if (immutable(old) !== immutable(order))
        errors.push(
          "Lệnh đã phát hành không được sửa kế hoạch hoặc dữ liệu đã chốt.",
        )

      const transitions: Record<string, string[]> = {
        RELEASED: ["RELEASED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],

        IN_PROGRESS: ["IN_PROGRESS", "COMPLETED"],

        COMPLETED: ["COMPLETED"],

        CANCELLED: ["CANCELLED"],
      }

      if (!transitions[old.status]?.includes(order.status))
        errors.push("Chuyển trạng thái lệnh không hợp lệ.")
    }
  }

  if (
    before.productionOrders.some(
      (order) =>
        !after.productionOrders.some((row) => row.id === order.id) &&
        order.status !== "DRAFT",
    )
  )
    errors.push("Chỉ được xóa Lệnh sản xuất Nháp.")

  for (const work of after.workOrders) {
    const order = after.productionOrders.find(
        (order) => order.id === work.orderId,
      ),
      old = before.workOrders.find((row) => row.id === work.id)

    if (
      !order ||
      !order.sourceSnapshot?.steps.some((step) => step.stepId === work.stepId)
    )
      errors.push("WO không thuộc bước đã chốt của lệnh sản xuất.")

    if (
      old &&
      (old.code !== work.code ||
        old.orderId !== work.orderId ||
        old.stepId !== work.stepId)
    )
      errors.push("Không được sửa thông tin kế thừa của WO.")

    if (old?.stationId !== work.stationId && work.stationId) {
      if (
        workActuals(work.id, previous).started ||
        !eligibleStations(work, next).some((row) => row.id === work.stationId)
      )
        errors.push(
          "Không được đổi trạm sau thực thi hoặc chọn trạm không phù hợp.",
        )

      if (
        old?.stationId &&
        after.assignments.some(
          (row) => row.workOrderId === work.id && row.status === "ACTIVE",
        )
      )
        errors.push(
          "Đổi Trạm phải xóa phân công nhân sự cũ trong cùng giao dịch.",
        )
    }
  }

  if (
    before.workOrders.some(
      (work) => !after.workOrders.some((row) => row.id === work.id),
    )
  )
    errors.push("Không được xóa WO đã được phát hành.")

  for (const assignment of after.assignments) {
    const old = before.assignments.find((row) => row.id === assignment.id)

    if (
      assignment.status === "ACTIVE" &&
      JSON.stringify(assignment) !== JSON.stringify(old)
    )
      errors.push(...validateAssignment(assignment, next))
  }

  if (
    before.assignments.some(
      (row) =>
        (!after.assignments.some((next) => next.id === row.id) ||
          JSON.stringify(
            after.assignments.find((next) => next.id === row.id),
          ) !== JSON.stringify(row)) &&
        before.productionExecutions.some(
          (event) => event.assignmentId === row.id,
        ),
    )
  )
    errors.push("Không sửa/xóa phân công đã dùng trong nhật ký thực thi.")

  if (
    before.productionExecutions.some(
      (row) =>
        JSON.stringify(
          after.productionExecutions.find((next) => next.id === row.id),
        ) !== JSON.stringify(row),
    )
  )
    errors.push("Không được sửa/xóa dữ liệu thực thi đã ghi nhận.")

  // Validate appended events in sequence against the preceding committed state.

  let staged = previous

  for (const event of after.productionExecutions.filter(
    (row) => !before.productionExecutions.some((old) => old.id === row.id),
  )) {
    errors.push(...validateExecutionEvent(event, staged))

    staged = {
      ...staged,

      productionExecutions: [
        ...(staged.productionExecutions || []),

        event,
      ] as unknown as Catalog[string],
    }
  }

  return [...new Set(errors)]
}
