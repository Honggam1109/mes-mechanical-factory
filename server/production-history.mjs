/** Historical demo fixtures run through the same planning/assignment/execution
 * rules under a domain-local clock. No system clock or existing logs are changed. */
export function seedProductionHistory(domain, actors) {
  const { store, service, execution, withTime } = domain
  const { planner, leader, worker } = actors
  if (!planner || !leader || !worker)
    throw new Error("Thiếu tài khoản demo để tạo lịch sử.")
  const route = store
    .snapshot()
    .routes.find((row) => row.description === "demo-mo-route")
  if (!route) throw new Error("Chuẩn bị danh mục demo trước khi thêm lịch sử.")
  const now = new Date()
  let added = 0
  const batches = [
    { key: "H01", days: 7, quantity: 80 },
    { key: "H02", days: 5, quantity: 100, pause: true },
    { key: "H03", days: 4, quantity: 120 },
    { key: "H04", days: 2, quantity: 100, actual: 90, pause: true },
    { key: "H05", days: 1, quantity: 150 },
    { key: "H06", days: 3, quantity: 60, cancelled: true },
  ]
  for (const batch of batches) {
    const marker = `LỊCH SỬ DEMO · ${batch.key} · ${
      batch.cancelled
        ? "Lệnh hủy trước thực thi"
        : batch.actual
          ? "Hoàn thành thiếu 10 sản phẩm"
          : "Lô đã hoàn thành"
    }`
    if (store.snapshot().productionOrders.some((row) => row.note === marker))
      continue
    const day = new Date(now)
    day.setDate(day.getDate() - batch.days)
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
    const at = (time) => new Date(`${date}T${time}:00`).toISOString()
    const run = (time, callback) => withTime(at(time), callback)
    const steps = store
      .snapshot()
      .routes.find((row) => row.id === route.id).details
    const hour = (index, minute = "00") =>
      `${String(8 + index).padStart(2, "0")}:${minute}`
    const plans = steps.map((step, index) => ({
      stepId: step.stepId,
      start: at(hour(index)),
      end: at(hour(index + 1)),
      note: "Lịch sử demo",
    }))
    const order = run("07:30", () =>
      service.saveOrder(
        {
          productId: "demo-product",
          routeId: route.id,
          quantity: batch.quantity,
          priority: "Bình thường",
          start: plans[0].start,
          end: plans.at(-1).end,
          plans,
          note: marker,
        },
        planner,
      ),
    )
    const works = run("07:35", () => service.releaseOrder(order.id, planner))
    for (let index = 0; index < works.length; index++) {
      run("07:40", () =>
        service.assignStation(
          works[index].id,
          `demo-station-${index + 1}`,
          leader,
        ),
      )
      run("07:45", () =>
        service.saveAssignment(
          {
            workOrderId: works[index].id,
            employeeId: worker.employee.id,
            shiftId: "demo-shift-day",
            date,
            plannedStart: plans[index].start,
            plannedEnd: plans[index].end,
            quantity: batch.quantity,
            note: "Phân công mẫu lịch sử",
          },
          leader,
        ),
      )
    }
    if (batch.cancelled) {
      run("07:50", () => service.cancelOrder(order.id, planner))
    } else {
      const report = (index, time, kind, extra = {}) =>
        run(time, () =>
          execution.executeWork(
            {
              workOrderId: works[index].id,
              stationId: `demo-station-${index + 1}`,
              kind,
              note: "Nhật ký mẫu lịch sử",
              ...extra,
            },
            worker,
          ),
        )
      for (let index = 0; index < works.length; index++) {
        const actual =
          index === works.length - 1
            ? batch.actual || batch.quantity
            : batch.quantity
        const first = Math.floor(actual * 0.4)
        report(index, hour(index), "START")
        report(index, hour(index, "15"), "REPORT", { quantity: first })
        if (batch.pause && index === 0) {
          report(index, "08:20", "PAUSE", {
            reasonId: "demo-stop",
            machineId: "demo-machine-1",
          })
          report(index, "08:30", "RESUME")
        }
        report(index, hour(index, "40"), "REPORT", {
          quantity: actual - first,
        })
        report(index, hour(index, "50"), "COMPLETE", {
          note:
            actual < batch.quantity
              ? "Lịch sử demo: kết thúc lô, thiếu 10 sản phẩm do chờ phôi."
              : "Lịch sử demo: hoàn thành đủ sản lượng.",
        })
      }
    }
    added++
  }
  return { added, completed: 5, cancelled: 1 }
}
