import assert from "node:assert/strict"
import { createServer } from "node:http"
import { createSystem } from "../server/system.mjs"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const folder = mkdtempSync(join(tmpdir(), "mes-production-backend-"))
const filename = join(folder, "demo.sqlite")
const system = createSystem({
  filename,
  adminPassword: "Admin@123456",
  demoAccounts: true,
})
const server = createServer(system.handler)
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const base = `http://127.0.0.1:${server.address().port}/api`
async function call(path, cookie, body, expected = 200) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`)
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] }
}
const login = async (username) =>
  (
    await call("/auth/login", null, {
      username,
      password: username === "admin" ? "Admin@123456" : "Demo@123456",
    })
  ).cookie
const snap = async (cookie) => (await call("/production/snapshot", cookie)).data
async function command(cookie, name, args, expected = 200) {
  const { revision } = await snap(cookie)
  return (
    await call(
      "/production/command",
      cookie,
      { command: name, args, revision, requestId: crypto.randomUUID() },
      expected,
    )
  ).data.result
}
try {
  const admin = await login("admin"),
    planner = await login("kehoach"),
    leader = await login("totruong"),
    worker = await login("thucthi")
  await call("/production/snapshot", null, undefined, 401)
  const metadata = await command(admin, "prepareDemo", [false])
  const historical = (await snap(admin)).data
  const historyOrders = historical.productionOrders.filter((row) =>
    row.note.startsWith("LỊCH SỬ DEMO"),
  )
  assert.equal(historyOrders.length, 6)
  assert.equal(
    historyOrders.filter((row) => row.status === "COMPLETED").length,
    5,
  )
  assert.equal(
    historyOrders.filter((row) => row.status === "CANCELLED").length,
    1,
  )
  assert.ok(
    historyOrders.every(
      (row) =>
        row.createdBy === "DEMO_PLANNER" &&
        new Date(row.createdAt) < new Date(),
    ),
  )
  const historyWorkIds = new Set(
    historical.workOrders
      .filter((row) => historyOrders.some((order) => order.id === row.orderId))
      .map((row) => row.id),
  )
  const historicalEvents = historical.productionExecutions.filter((row) =>
    historyWorkIds.has(row.workOrderId),
  )
  assert.equal(historicalEvents.length, 124)
  assert.equal(historicalEvents.filter((row) => row.kind === "PAUSE").length, 2)
  assert.ok(
    historicalEvents.every(
      (row) =>
        row.createdBy === "DEMO_WORKER" &&
        row.employeeId === "demo-worker" &&
        new Date(row.at) < new Date(),
    ),
  )
  assert.equal(
    historical.assignments
      .filter((row) => historyWorkIds.has(row.workOrderId))
      .every((row) => row.createdBy === "DEMO_LEADER"),
    true,
  )
  assert.equal((await command(admin, "prepareHistory", [])).added, 0)
  assert.equal(
    (await snap(admin)).data.productionExecutions.length,
    historical.productionExecutions.length,
  )
  assert.equal(
    (await snap(worker)).data.productionOrders.filter((row) =>
      row.note.startsWith("LỊCH SỬ DEMO"),
    ).length,
    5,
  )
  await command(worker, "prepareHistory", [], 403)
  const otherTeamOrder = (await snap(admin)).data.productionOrders.find(
    (item) => item.note === "demo-out-of-scope",
  )
  assert.ok(otherTeamOrder)
  assert.ok(
    !(await snap(leader)).data.productionOrders.some(
      (item) => item.id === otherTeamOrder.id,
    ),
  )
  assert.ok(
    !(await snap(worker)).data.productionOrders.some(
      (item) => item.id === otherTeamOrder.id,
    ),
  )
  const otherWork = (await snap(admin)).data.workOrders.find(
    (item) => item.orderId === otherTeamOrder.id,
  )
  await command(leader, "assignStation", [otherWork.id, "demo-station-1"], 403)
  const row = await command(planner, "saveOrder", [
    {
      productId: metadata.productId,
      routeId: metadata.routeId,
      quantity: 100,
      priority: "Bình thường",
      note: "Backend demo",
      start: metadata.plans[0].start,
      end: metadata.plans.at(-1).end,
      plans: metadata.plans,
    },
  ])
  assert.equal(
    (await snap(leader)).data.productionOrders.some(
      (item) => item.id === row.id,
    ),
    true,
  )
  assert.equal(
    (await snap(worker)).data.productionOrders.some(
      (item) => item.id === row.id,
    ),
    false,
  )
  await command(worker, "releaseOrder", [row.id], 403)
  const works = await command(planner, "releaseOrder", [row.id])
  assert.equal(works.length, 6)
  await command(planner, "releaseOrder", [row.id], 400)
  await command(planner, "assignStation", [works[0].id, "demo-station-1"], 403)
  for (let i = 0; i < works.length; i++) {
    await command(leader, "assignStation", [
      works[i].id,
      `demo-station-${i + 1}`,
    ])
    await command(leader, "saveAssignment", [
      {
        workOrderId: works[i].id,
        employeeId: "demo-worker",
        shiftId: metadata.shiftId,
        date: metadata.date,
        plannedStart: metadata.plans[i].start,
        plannedEnd: metadata.plans[i].end,
        note: "Demo",
        quantity: 100,
      },
    ])
  }
  // A worker cannot inherit the entire team's execution authority.
  const workerAccount = system.db
    .prepare("SELECT document FROM users WHERE username='thucthi'")
    .get()
  const original = JSON.parse(workerAccount.document)
  system.db
    .prepare("UPDATE users SET document=? WHERE id=?")
    .run(
      JSON.stringify({ ...original, employeeId: "demo-leader" }),
      original.id,
    )
  const unauthorizedRevision = (await snap(worker)).revision
  await call(
    "/production/command",
    worker,
    {
      command: "executeWork",
      args: [
        {
          workOrderId: works[0].id,
          stationId: "demo-station-1",
          kind: "START",
        },
      ],
      revision: unauthorizedRevision,
      requestId: crypto.randomUUID(),
    },
    403,
  )
  system.db
    .prepare("UPDATE users SET document=? WHERE id=?")
    .run(JSON.stringify(original), original.id)
  const event = (index, kind, extra = {}) => ({
    workOrderId: works[index].id,
    stationId: `demo-station-${index + 1}`,
    kind,
    ...extra,
  })
  await command(leader, "executeWork", [event(0, "START")], 403)
  await command(worker, "executeWork", [event(1, "START")], 400)
  await command(worker, "executeWork", [event(0, "START")])
  const stale = await snap(worker)
  await command(worker, "executeWork", [event(0, "REPORT", { quantity: 40 })])
  await call(
    "/production/command",
    worker,
    {
      command: "executeWork",
      args: [event(0, "REPORT", { quantity: 999 })],
      revision: stale.revision,
      requestId: crypto.randomUUID(),
    },
    409,
  )
  await command(worker, "executeWork", [
    event(0, "PAUSE", { reasonId: "demo-stop" }),
  ])
  await command(
    worker,
    "executeWork",
    [event(0, "REPORT", { quantity: 60 })],
    400,
  )
  await command(worker, "executeWork", [event(0, "RESUME")])
  await command(worker, "executeWork", [event(0, "REPORT", { quantity: 60 })])
  await command(worker, "executeWork", [event(0, "COMPLETE")])
  await command(worker, "executeWork", [event(1, "START")]) // early, predecessor completed
  const revision = (await snap(worker)).revision
  const body = {
    command: "executeWork",
    args: [event(1, "REPORT", { quantity: 100 })],
    revision,
    requestId: crypto.randomUUID(),
  }
  await call("/production/command", worker, body)
  await call("/production/command", worker, body) // idempotent retry, no double output
  await command(worker, "executeWork", [event(1, "COMPLETE")])
  for (let index = 2; index < works.length; index++) {
    await command(worker, "executeWork", [event(index, "START")])
    await command(worker, "executeWork", [
      event(index, "REPORT", { quantity: 100 }),
    ])
    await command(worker, "executeWork", [event(index, "COMPLETE")])
  }
  const final = await snap(planner)
  assert.equal(
    final.data.productionOrders.find((item) => item.id === row.id).status,
    "COMPLETED",
  )
  assert.equal(
    final.data.productionExecutions
      .filter(
        (item) => item.workOrderId === works[1].id && item.kind === "REPORT",
      )
      .reduce((sum, item) => sum + item.quantity, 0),
    100,
  )
  await command(worker, "updateCatalog", ["stops", []], 403)
  assert.ok(
    system.db
      .prepare(
        "SELECT count(*) AS n FROM audit_logs WHERE action LIKE 'PRODUCTION:%'",
      )
      .get().n > 10,
  )
  const reopened = createSystem({
    filename,
    adminPassword: "Ignored@123",
    demoAccounts: true,
  })
  const stored = JSON.parse(
    reopened.db
      .prepare("SELECT document FROM production_state WHERE id=1")
      .get().document,
  )
  assert.equal(
    stored.productionOrders.find((item) => item.id === row.id).status,
    "COMPLETED",
  )
  assert.equal(
    reopened.db
      .prepare("SELECT count(*) AS n FROM users WHERE username='thucthi'")
      .get().n,
    1,
  )
  reopened.close()
  console.log(
    "PASS: four independent sessions, server RBAC, shared MO/WO, timed assignments, early sequential start, pause/report/resume, completion, revision conflicts, idempotency and audit",
  )
} finally {
  await new Promise((resolve) => server.close(resolve))
  system.close()
  rmSync(folder, { recursive: true, force: true })
}
