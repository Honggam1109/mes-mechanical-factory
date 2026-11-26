import assert from "node:assert/strict"
import { createServer } from "node:http"
import { createSystem } from "../server/system.mjs"
const system = createSystem({
  filename: ":memory:",
  adminPassword: "Admin12345",
})
const server = createServer(system.handler)
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const root = `http://127.0.0.1:${server.address().port}/api`
let checks = 0
async function call(
  path,
  method = "GET",
  body = undefined,
  cookie = adminCookie,
  status = 200,
) {
  const response = await fetch(root + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const value = await response.json()
  assert.equal(response.status, status, JSON.stringify(value))
  checks++
  return { value, cookie: response.headers.get("set-cookie")?.split(";")[0] }
}
let adminCookie
try {
  adminCookie = (
    await call(
      "/auth/login",
      "POST",
      { username: "admin", password: "Admin12345" },
      undefined,
    )
  ).cookie
  assert.equal((await call("/employees")).value.items[0].department, "dept1")
  const input = {
    code: "EMP-002",
    fullName: "Nhân viên mới",
    department: "dept1",
    email: "new@example.com",
    phone: "0900000000",
    productionTeamId: "team-a",
    productionTeamName: "Tổ A",
    status: "ACTIVE",
  }
  const employee = (await call("/employees", "POST", input)).value
  assert.notEqual(employee.id, undefined)
  await call(
    "/employees",
    "POST",
    { ...input, code: "emp-002" },
    adminCookie,
    400,
  )
  await call(
    "/employees",
    "POST",
    { ...input, code: "EMP-003", email: "bad" },
    adminCookie,
    400,
  )
  await call(
    "/employees",
    "POST",
    { ...input, code: "EMP-003", fullName: "" },
    adminCookie,
    400,
  )
  await call(
    "/employees/import",
    "POST",
    { items: [{ ...input, code: "EMP-003" }, input] },
    adminCookie,
    400,
  )
  assert.equal(
    (await call("/employees")).value.items.length,
    2,
    "Import must roll back the entire batch",
  )
  const imported = (
    await call("/employees/import", "POST", {
      items: [
        { ...input, code: "EMP-003" },
        { ...input, code: "EMP-004" },
      ],
    })
  ).value.items
  assert.equal(imported.length, 2)
  await call("/employees/import", "POST", { items: [null] }, adminCookie, 400)
  const role = (
    await call("/roles", "POST", {
      code: "EMPLOYEE_SCOPE_TEST",
      name: "Scope",
      status: "ACTIVE",
    })
  ).value
  await call(`/roles/${role.id}/permissions`, "PUT", {
    permissions: { SYSTEM_USER: ["VIEW", "UPDATE"] },
  })
  const scope = (
    await call("/data-permissions", "POST", {
      code: "EMP_SELF",
      name: "Cá nhân",
      resource: "SYSTEM_USER",
      accessType: "VIEW",
      scope: "SELF",
    })
  ).value
  await call(`/roles/${role.id}/data-permissions`, "PUT", {
    dataPermissionIds: [scope.id],
  })
  const user = (
    await call("/users", "POST", {
      username: "employee2",
      password: "Worker123",
      confirmPassword: "Worker123",
      employeeId: employee.id,
      roleIds: [role.id],
      status: "ACTIVE",
    })
  ).value
  const cookie = (
    await call("/auth/login", "POST", {
      username: "employee2",
      password: "Worker123",
    })
  ).cookie
  await call(
    `/employees/${employee.id}`,
    "PUT",
    { productionTeamId: "forged-team" },
    cookie,
    403,
  )
  await call(`/employees/${employee.id}`, "DELETE", {}, adminCookie, 400)
  await call(
    `/employees/${employee.id}`,
    "PUT",
    { code: "CHANGED" },
    adminCookie,
    400,
  )
  await call(`/employees/${employee.id}`, "PUT", {
    fullName: "Tên đã cập nhật",
    email: "updated@example.com",
    productionTeamId: "team-b",
    productionTeamName: "Tổ B",
  })
  const auth = (await call("/auth/me", "GET", undefined, cookie)).value
  assert.equal(auth.employee.productionTeamId, "team-b")
  assert.equal(auth.user.fullName, "Tên đã cập nhật")
  assert.equal(auth.user.email, "updated@example.com")
  const details = (await call(`/users/${user.id}`)).value
  assert.equal(details.employee.productionTeamName, "Tổ B")
  const options = (await call("/system/options")).value
  assert.equal(
    options.employees.find((e) => e.id === employee.id).linkedUserId,
    user.id,
  )
  // SYSTEM_ROLE UPDATE alone still cannot alter the source of ownership.
  await call(`/roles/${role.id}/permissions`, "PUT", {
    permissions: { SYSTEM_USER: ["VIEW", "UPDATE"], SYSTEM_ROLE: ["UPDATE"] },
  })
  await call(
    `/employees/${employee.id}`,
    "PUT",
    { productionTeamId: "forged-team" },
    cookie,
    403,
  )
  await call(`/employees/${imported[0].id}`, "DELETE", {})
  assert.equal((await call("/employees")).value.items.length, 3)
  await call("/employees", "GET", undefined, "", 401)
  assert.ok(
    system.db
      .prepare(
        "SELECT count(*) AS count FROM audit_logs WHERE action LIKE '%employees%'",
      )
      .get().count >= 5,
  )
  console.log(
    `PASS: ${checks} Employee API checks: shared directory, validation, atomic import, linked-user protection, ownership authorization, profile propagation and audit`,
  )
} finally {
  await new Promise((resolve) => server.close(resolve))
  system.close()
}
