import assert from "node:assert/strict"

import { createServer } from "node:http"

import { createSystem } from "../server/system.mjs"

const system = createSystem({
    filename: ":memory:",

    adminPassword: "Admin12345",
  }),
  server = createServer(system.handler)

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

const root = `http://127.0.0.1:${server.address().port}/api`

let admin

async function call(
  path,

  method = "GET",

  body,

  cookie = admin,

  expected = 200,
) {
  const response = await fetch(root + path, {
    method,

    headers: {
      "Content-Type": "application/json",

      ...(cookie ? { cookie } : {}),
    },

    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const value = await response.json()

  assert.equal(response.status, expected, JSON.stringify(value))

  return { value, cookie: response.headers.get("set-cookie")?.split(";")[0] }
}

try {
  admin = (
    await call("/auth/login", "POST", {
      username: "admin",

      password: "Admin12345",
    })
  ).cookie

  const role = (
    await call("/roles", "POST", {
      code: "EXECUTOR_TEST",

      name: "Người thực thi",

      description: "",

      status: "ACTIVE",
    })
  ).value

  await call(`/roles/${role.id}/permissions`, "PUT", {
    permissions: { PRODUCTION_MONITOR: ["VIEW"] },
  })

  await call(`/roles/${role.id}/data-permissions`, "PUT", {
    dataPermissionIds: ["PRODUCTION_MONITOR_VIEW_ALL"],
  })

  await call("/employees", "POST", {
    code: "EMP-TEST",

    fullName: "Nhân viên đơn vị khác",

    department: "different-unit",

    status: "ACTIVE",
  })

  await call("/users", "POST", {
    username: "planner",

    password: "Planner123",

    confirmPassword: "Planner123",

    employeeId: "emp1",

    roleIds: [role.id],

    status: "ACTIVE",
  })

  const planner = (
    await call("/auth/login", "POST", {
      username: "planner",

      password: "Planner123",
    })
  ).cookie

  const me = (await call("/auth/me", "GET", undefined, planner)).value

  assert.equal(me.permissions.SYSTEM_USER, undefined)

  assert.ok(me.permissions.PRODUCTION_MONITOR.includes("VIEW"))

  assert.equal(
    (await call("/employees", "GET", undefined, planner)).value.items.length,

    2,
  )

  await call(
    "/employees/emp1",

    "PUT",

    { fullName: "Không được sửa" },

    planner,

    403,
  )

  const self = (
    await call("/data-permissions", "POST", {
      code: "EXEC_SELF_TEST",

      name: "Chỉ bản thân",

      resource: "PRODUCTION_MONITOR",

      accessType: "VIEW",

      scope: "SELF",

      status: "ACTIVE",
    })
  ).value

  await call(`/roles/${role.id}/data-permissions`, "PUT", {
    dataPermissionIds: [self.id],
  })

  assert.deepEqual(
    (await call("/employees", "GET", undefined, planner)).value.items.map(
      (row) => row.id,
    ),

    ["emp1"],
  )

  const team = (
    await call("/data-permissions", "POST", {
      code: "EXEC_TEAM_TEST",

      name: "Cùng đơn vị",

      resource: "PRODUCTION_MONITOR",

      accessType: "VIEW",

      scope: "PRODUCTION_TEAM",

      status: "ACTIVE",
    })
  ).value

  await call(`/roles/${role.id}/data-permissions`, "PUT", {
    dataPermissionIds: [team.id],
  })

  assert.deepEqual(
    (await call("/employees", "GET", undefined, planner)).value.items.map(
      (row) => row.id,
    ),

    ["emp1"],
  )

  await call(`/roles/${role.id}/data-permissions`, "PUT", {
    dataPermissionIds: [],
  })

  assert.equal(
    (await call("/employees", "GET", undefined, planner)).value.items.length,

    0,
  )

  await call(`/roles/${role.id}/permissions`, "PUT", { permissions: {} })

  await call("/employees", "GET", undefined, planner, 403)

  console.log(
    "PASS: Monitoring permissions, read-only viewer directory access without System privileges, employee write denial and ALL/SELF/team/missing scope enforcement",
  )
} finally {
  await new Promise((resolve) => server.close(resolve))

  system.close()
}
