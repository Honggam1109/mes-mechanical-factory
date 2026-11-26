import assert from "node:assert/strict"

import { createServer } from "node:http"

import { createSystem } from "../server/system.mjs"

import { mkdtempSync, rmSync } from "node:fs"

import { tmpdir } from "node:os"

import { join } from "node:path"

const folder = mkdtempSync(join(tmpdir(), "mes-system-")),
  filename = join(folder, "system.sqlite")

const system = createSystem({ filename, adminPassword: "Admin12345" })

const server = createServer(system.handler)

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

const base = `http://127.0.0.1:${server.address().port}/api`

let checks = 0

async function call(
  path,

  { method = "GET", body, cookie, expected = 200 } = {},
) {
  const response = await fetch(base + path, {
    method,

    headers: {
      "Content-Type": "application/json",

      ...(cookie ? { cookie } : {}),
    },

    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = await response.json()

  assert.equal(
    response.status,

    expected,

    `${method} ${path}: ${JSON.stringify(data)}`,
  )

  checks++

  return {
    data,

    cookie: response.headers.get("set-cookie")?.split(";")[0],

    headers: response.headers,
  }
}

try {
  await call("/users", { expected: 401 })

  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",

        body: { username: "admin", password: "wrong" },

        expected: 401,
      })
    ).data.message,

    "Tên đăng nhập hoặc mật khẩu không đúng",
  )

  const login = await call("/auth/login", {
      method: "POST",

      body: { username: "admin", password: "Admin12345", remember: true },
    }),
    cookie = login.cookie,
    adminId = login.data.user.id

  assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/)

  assert.match(login.headers.get("set-cookie"), /Max-Age=/)

  assert.ok(!JSON.stringify(login.data).includes("password"))

  assert.ok(login.data.permissions.PRODUCTION_ORDER.includes("RELEASE"))

  assert.ok(login.data.permissions.PRODUCTION_ASSIGNMENT.includes("ASSIGN"))

  assert.equal(login.data.dataScopes["PRODUCTION_ORDER:WRITE"], "ALL")

  assert.equal(login.data.roles.length, 1)

  assert.equal(login.data.dataScopes["SYSTEM_USER:WRITE"], "ALL")

  const roles = (await call("/roles?pageSize=100", { cookie })).data.items

  assert.equal(roles.length, 6)

  const create = async (kind, body, expected = 200) =>
    (await call(`/${kind}`, { cookie, method: "POST", body, expected })).data

  const update = async (kind, id, body, expected = 200) =>
    (await call(`/${kind}/${id}`, { cookie, method: "PUT", body, expected }))
      .data

  const assign = async (id, operation, body, expected = 200) =>
    (
      await call(`/roles/${id}/${operation}`, {
        cookie,

        method: "PUT",

        body,

        expected,
      })
    ).data

  const userInput = {
    username: "worker1",

    password: "Worker123",

    confirmPassword: "Worker123",

    email: "worker@example.com",

    roleIds: ["PRODUCTION_WORKER"],

    status: "ACTIVE",

    employeeId: "emp1",
  }

  const user = await create("users", userInput)

  assert.deepEqual(user.roleIds, ["PRODUCTION_WORKER"])

  assert.equal(user.employee.code, "EMP-001")

  await create(
    "users",

    { ...userInput, username: "WORKER1", employeeId: "" },

    400,
  )

  await create("users", { ...userInput, username: "worker2" }, 400)

  await create(
    "users",

    {
      ...userInput,

      username: "worker2",

      employeeId: "",

      password: "weak",

      confirmPassword: "weak",
    },

    400,
  )

  await create(
    "users",

    {
      ...userInput,

      username: "worker2",

      employeeId: "",

      confirmPassword: "Different123",
    },

    400,
  )

  await create(
    "users",

    { ...userInput, username: "worker2", employeeId: "", roleIds: [] },

    400,
  )

  await update("users", user.id, { username: "changed" }, 400)

  const workerCookie = (
    await call("/auth/login", {
      method: "POST",

      body: { username: "worker1", password: "Worker123" },
    })
  ).cookie

  await call("/users", { cookie: workerCookie, expected: 403 })

  await call(`/users/${user.id}`, {
    cookie: workerCookie,

    method: "PUT",

    body: { roleIds: ["ADMIN"] },

    expected: 403,
  })

  await call(`/users/${adminId}/status`, {
    cookie,

    method: "PATCH",

    body: { status: "INACTIVE" },

    expected: 400,
  })

  await update("roles", "ADMIN", { status: "INACTIVE" }, 400)

  await assign("ADMIN", "permissions", { permissions: {} }, 400)

  await assign("ADMIN", "data-permissions", { dataPermissionIds: [] }, 400)

  const team = await create("roles", {
    code: "TEAM_TEST",

    name: "Nhóm kiểm thử",

    status: "ACTIVE",
  })

  await assign(
    team.id,

    "permissions",

    { permissions: { SYSTEM_USER: ["VIEW", "BOGUS"] } },

    400,
  )

  await assign(team.id, "permissions", {
    permissions: { SYSTEM_USER: ["VIEW", "UPDATE"] },
  })

  const selfView = await create("data-permissions", {
    code: "USER_SELF_VIEW",

    name: "Cá nhân",

    resource: "SYSTEM_USER",

    accessType: "VIEW",

    scope: "SELF",

    status: "ACTIVE",
  })

  const selfWrite = await create("data-permissions", {
    code: "USER_SELF_WRITE",

    name: "Cá nhân",

    resource: "SYSTEM_USER",

    accessType: "WRITE",

    scope: "SELF",

    status: "ACTIVE",
  })

  await assign(team.id, "data-permissions", {
    dataPermissionIds: [selfView.id, selfWrite.id],
  })

  await call(`/users/${user.id}/roles`, {
    cookie,

    method: "PUT",

    body: { roleIds: ["PRODUCTION_WORKER", team.id] },
  })

  const me = (await call("/auth/me", { cookie: workerCookie })).data

  assert.deepEqual(me.permissions.SYSTEM_USER.sort(), ["UPDATE", "VIEW"])

  assert.equal(me.roles.length, 2)

  const scoped = (
    await call("/users?employeeId=forged&productionTeamId=forged&scope=ALL", {
      cookie: workerCookie,
    })
  ).data

  assert.equal(scoped.total, 1)

  assert.equal(scoped.items[0].id, user.id)

  await call(`/users/${adminId}`, { cookie: workerCookie, expected: 403 })

  await call(`/users/${adminId}`, {
    cookie: workerCookie,

    method: "PUT",

    body: { employeeId: "emp1" },

    expected: 403,
  })

  await call(`/users/${user.id}/status`, {
    cookie: workerCookie,

    method: "PATCH",

    body: { status: "INACTIVE" },

    expected: 403,
  })

  const teamView = await create("data-permissions", {
    code: "USER_TEAM_VIEW",

    name: "Tổ sản xuất",

    resource: "SYSTEM_USER",

    accessType: "VIEW",

    scope: "PRODUCTION_TEAM",

    status: "ACTIVE",
  })

  await assign(team.id, "data-permissions", {
    dataPermissionIds: [teamView.id, selfWrite.id],
  })

  assert.equal(
    (await call("/users", { cookie: workerCookie })).data.total,

    0,

    "No team must fail closed",
  )

  const employee = system.db

    .prepare("SELECT document FROM employees WHERE id=?")

    .get("emp1")

  system.db.prepare("UPDATE employees SET document=? WHERE id=?").run(
    JSON.stringify({
      ...JSON.parse(employee.document),

      productionTeamId: "team1",
    }),

    "emp1",
  )

  assert.equal((await call("/users", { cookie: workerCookie })).data.total, 1)

  await assign(team.id, "data-permissions", {
    dataPermissionIds: [
      selfView.id,

      teamView.id,

      "SYSTEM_USER_VIEW_ALL",

      selfWrite.id,
    ],
  })

  assert.equal(
    (await call("/auth/me", { cookie: workerCookie })).data.dataScopes[
      "SYSTEM_USER:VIEW"
    ],

    "ALL",
  )

  assert.equal((await call("/users", { cookie: workerCookie })).data.total, 2)

  await call(`/users/${user.id}/reset-password`, {
    cookie: workerCookie,

    method: "POST",

    body: { password: "Newpass123", confirmPassword: "Newpass123" },

    expected: 403,
  })

  await call(`/users/${user.id}/reset-password`, {
    cookie,

    method: "POST",

    body: { password: "Newpass123", confirmPassword: "Newpass123" },
  })

  await call("/auth/me", { cookie: workerCookie, expected: 401 })

  await call("/auth/login", {
    method: "POST",

    body: { username: "worker1", password: "Worker123" },

    expected: 401,
  })

  const newCookie = (
    await call("/auth/login", {
      method: "POST",

      body: { username: "worker1", password: "Newpass123" },
    })
  ).cookie

  await call(`/users/${user.id}/status`, {
    cookie,

    method: "PATCH",

    body: { status: "INACTIVE" },
  })

  await call("/auth/me", { cookie: newCookie, expected: 401 })

  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",

        body: { username: "worker1", password: "Newpass123" },

        expected: 403,
      })
    ).data.message,

    "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị hệ thống",
  )

  await call(`/users/${user.id}/status`, {
    cookie,

    method: "PATCH",

    body: { status: "ACTIVE" },
  })

  await assign(team.id, "users", { userIds: [] })

  assert.deepEqual((await call(`/users/${user.id}`, { cookie })).data.roleIds, [
    "PRODUCTION_WORKER",
  ])

  const custom = await create("permissions", {
    code: "TEST_PRODUCTION_ASSIGNMENT",

    name: "Phân công",

    module: "PRODUCTION",

    route: "/production/assignments",

    actions: ["VIEW", "EXECUTE"],

    status: "ACTIVE",
  })

  await assign(team.id, "permissions", {
    permissions: { SYSTEM_USER: ["VIEW"], [custom.id]: ["EXECUTE"] },
  })

  await call(`/users/${user.id}/roles`, {
    cookie,

    method: "PUT",

    body: { roleIds: [team.id] },
  })

  const auth = system.effective(user.id)

  auth.dataScopes["PRODUCTION_ASSIGNMENT:VIEW"] = "SELF"

  assert.deepEqual(
    system.applyDataScope(auth, "PRODUCTION_ASSIGNMENT", "VIEW", [
      { assigneeId: "emp1" },

      { assigneeId: "other" },
    ]),

    [{ assigneeId: "emp1" }],
  )

  auth.dataScopes["PRODUCTION_ASSIGNMENT:VIEW"] = "PRODUCTION_TEAM"

  assert.equal(
    system.applyDataScope(auth, "PRODUCTION_ASSIGNMENT", "VIEW", [
      { productionTeamId: "team1" },

      { productionTeamId: "team2" },
    ]).length,

    1,
  )

  await update("permissions", custom.id, { actions: ["VIEW"] })

  assert.equal(
    system.effective(user.id).permissions.TEST_PRODUCTION_ASSIGNMENT,

    undefined,
  )

  await create(
    "data-permissions",

    {
      code: "INVALID_SCOPE",

      name: "Sai",

      resource: "SYSTEM_USER",

      accessType: "VIEW",

      scope: "CUSTOM",
    },

    400,
  )

  await call("/auth/password", {
    cookie,

    method: "POST",

    body: {
      currentPassword: "wrong",

      password: "AdminNew123",

      confirmPassword: "AdminNew123",
    },

    expected: 400,
  })

  await call("/auth/password", {
    cookie,

    method: "POST",

    body: {
      currentPassword: "Admin12345",

      password: "AdminNew123",

      confirmPassword: "AdminNew123",
    },
  })

  await call("/auth/logout", { cookie, method: "POST", body: {} })

  await call("/auth/me", { cookie, expected: 401 })

  const serialized = system.db

    .prepare("SELECT password_hash, document FROM users")

    .all()

  assert.ok(
    serialized.every(
      (row) =>
        !row.document.includes("password") && row.password_hash.includes(":"),
    ),
  )

  assert.ok(
    system.db.prepare("SELECT count(*) as count FROM audit_logs").get().count >
      10,
  )

  system.close()

  const reopened = createSystem({ filename })

  assert.equal(
    reopened.db.prepare("SELECT count(*) as count FROM users").get().count,

    2,
  )

  reopened.close()

  console.log(
    `PASS: ${checks} System API checks: authentication, validation, assignments, active roles, union/subset actions, scopes, direct API 401/403, final admin rollback, session revocation, password hashing, audit and persistence`,
  )
} finally {
  await new Promise((resolve) => server.close(resolve))

  try {
    system.close()
  } catch {}

  rmSync(folder, { recursive: true, force: true })
}
