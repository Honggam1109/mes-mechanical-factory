import { DatabaseSync } from "node:sqlite"

import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto"

import { readFileSync, mkdirSync } from "node:fs"

import { dirname } from "node:path"
import { provisionDemoAccounts } from "./demo-accounts.mjs"
import { createProduction } from "./production.mjs"
process.env.TZ ||= "Asia/Ho_Chi_Minh"

export const ACTIONS = [
  "VIEW",

  "CREATE",

  "UPDATE",

  "DELETE",

  "EXPORT",

  "RELEASE",

  "ASSIGN",

  "EXECUTE",

  "START",

  "PAUSE",

  "RESUME",

  "COMPLETE",

  "RESET_PASSWORD",

  "LOCK",
]

const resources = {
  users: "SYSTEM_USER",

  roles: "SYSTEM_ROLE",

  permissions: "SYSTEM_PERMISSION",

  "data-permissions": "SYSTEM_DATA_PERMISSION",
}

const tables = {
  users: "users",

  roles: "roles",

  permissions: "permissions",

  "data-permissions": "data_permissions",

  employees: "employees",
}

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status })
}

const hashToken = (token) => createHash("sha256").update(token).digest("hex")

export const validPassword = (value) =>
  typeof value === "string" &&
  /^(?=.{8,50}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S+$/.test(value)

function passwordHash(password) {
  const salt = randomBytes(16).toString("hex")

  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`
}

function verify(password, hash) {
  const [salt, digest] = hash.split(":")

  return (
    typeof password === "string" &&
    password.length <= 50 &&
    timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, "hex"))
  )
}

export function createSystem({
  filename = process.env.MES_DB || "server/data/mes.sqlite",

  adminPassword = process.env.MES_ADMIN_PASSWORD,

  adminUsername = process.env.MES_ADMIN_USERNAME || "admin",
  demoAccounts = filename === (process.env.MES_DB || "server/data/mes.sqlite"),
} = {}) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true })

  const db = new DatabaseSync(filename)

  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"))

  const all = (kind) =>
    db.prepare(`SELECT * FROM ${tables[kind]}`)

      .all()

      .map((row) => ({ ...JSON.parse(row.document), id: row.id }))

  const get = (kind, id) =>
    all(kind).find((row) => row.id === id) ||
    fail("Không tìm thấy bản ghi.", 404)

  const relation = (table, column, id, value) =>
    db.prepare(`SELECT ${value} FROM ${table} WHERE ${column} = ?`)

      .all(id)

      .map((row) => row[value])

  const enrich = (kind, row) =>
    kind === "users"
      ? {
          ...row,

          roleIds: relation("user_roles", "user_id", row.id, "role_id"),

          employee:
            all("employees").find((e) => e.id === row.employeeId) || null,
        }
      : kind === "roles"
        ? {
            ...row,

            userIds: relation("user_roles", "role_id", row.id, "user_id"),

            userCount: relation("user_roles", "role_id", row.id, "user_id")
              .length,

            permissions: db

              .prepare(
                "SELECT permission_id, action FROM role_permission_actions WHERE role_id=?",
              )

              .all(row.id)

              .reduce((out, item) => {
                ;(out[item.permission_id] ||= []).push(item.action)

                return out
              }, {}),

            dataPermissionIds: relation(
              "role_data_permissions",

              "role_id",

              row.id,

              "data_permission_id",
            ),
          }
        : row

  const write = (kind, row, hash) => {
    if (kind === "users")
      db.prepare(
        "INSERT INTO users VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document, password_hash=excluded.password_hash",
      ).run(
        row.id,

        row.username,

        hash ||
          db.prepare("SELECT password_hash FROM users WHERE id=?").get(row.id)
            ?.password_hash,

        JSON.stringify(row),
      )
    else if (kind === "employees")
      db.prepare("INSERT OR REPLACE INTO employees VALUES (?,?)").run(
        row.id,

        JSON.stringify(row),
      )
    else
      db.prepare(
        `INSERT INTO ${tables[kind]} VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document`,
      ).run(row.id, row.code, JSON.stringify(row))
  }

  const transaction = (callback) => {
    db.exec("BEGIN IMMEDIATE")

    try {
      const result = callback()

      db.exec("COMMIT")

      return result
    } catch (error) {
      db.exec("ROLLBACK")

      throw error
    }
  }

  const replace = (table, column, id, other, ids) => {
    db.prepare(`DELETE FROM ${table} WHERE ${column}=?`).run(id)

    for (const value of new Set(ids))
      db.prepare(`INSERT INTO ${table} (${column},${other}) VALUES (?,?)`).run(
        id,

        value,
      )
  }

  function effective(id) {
    const user = enrich("users", get("users", id))

    const roles = all("roles")

      .filter((r) => r.status === "ACTIVE" && user.roleIds.includes(r.id))

      .map((r) => enrich("roles", r))

    const permissions = {},
      dataScopes = {}

    for (const role of roles) {
      for (const permission of all("permissions").filter(
        (p) => p.status === "ACTIVE",
      ))
        for (const action of role.permissions[permission.id] || [])
          if (permission.actions.includes(action))
            permissions[permission.code] = [
              ...new Set([...(permissions[permission.code] || []), action]),
            ]

      for (const scope of all("data-permissions").filter(
        (p) => p.status === "ACTIVE" && role.dataPermissionIds.includes(p.id),
      )) {
        const key = `${scope.resource}:${scope.accessType}`,
          ranks = { SELF: 1, PRODUCTION_TEAM: 2, ALL: 3 }

        if (!dataScopes[key] || ranks[scope.scope] > ranks[dataScopes[key]])
          dataScopes[key] = scope.scope
      }
    }

    return { user, employee: user.employee, roles, permissions, dataScopes }
  }

  const can = (auth, resource, action) =>
    !!auth.permissions[resource]?.includes(action)

  const guard = (auth, resource, action) => {
    if (!can(auth, resource, action))
      fail("Bạn không có quyền thực hiện thao tác này.", 403)
  }

  // Explicit mapping per resource. Never accept ownership field names from the client.

  function applyDataScope(auth, resource, accessType, rows) {
    const scope = auth.dataScopes[`${resource}:${accessType}`]

    if (scope === "ALL") return rows

    const ownership = {
      SYSTEM_USER: (row) => ({
        userId: row.id,

        employeeId: row.employeeId,

        teamId: all("employees").find((e) => e.id === row.employeeId)
          ?.productionTeamId,
      }),

      PRODUCTION_ORDER: (row) => ({
        userId: row.createdBy,

        employeeId: row.employeeId,

        teamId: row.productionTeamId,
      }),

      PRODUCTION_MONITOR: (row) => ({
        userId: row.userId,
        employeeId: row.assigneeId,
        teamId: row.productionTeamId,
      }),

      PRODUCTION_EXECUTION: (row) => ({
        userId: row.userId,

        employeeId: row.assigneeId,

        teamId: row.productionTeamId,
      }),

      PRODUCTION_ASSIGNMENT: (row) => ({
        userId: row.userId,

        employeeId: row.assigneeId,

        teamId: row.productionTeamId,
      }),
    }[resource]

    if (!ownership) return []

    return rows.filter((row) => {
      const owner = ownership(row)

      return scope === "PRODUCTION_TEAM"
        ? !!auth.employee?.productionTeamId &&
            owner.teamId === auth.employee.productionTeamId
        : scope === "SELF" &&
            (owner.userId === auth.user.id ||
              (!!auth.employee && owner.employeeId === auth.employee.id))
    })
  }

  const checkUserScope = (auth, id, access) => {
    if (!applyDataScope(auth, "SYSTEM_USER", access, [get("users", id)]).length)
      fail("Bạn không có quyền thực hiện thao tác này.", 403)
  }

  function invariants() {
    const active = all("users").filter((u) => u.status === "ACTIVE"),
      linked = new Set()

    for (const user of active) {
      if (
        !relation("user_roles", "user_id", user.id, "role_id").some(
          (id) => get("roles", id).status === "ACTIVE",
        )
      )
        fail("Vui lòng chọn ít nhất một vai trò.")

      if (user.employeeId) {
        if (linked.has(user.employeeId))
          fail("Nhân viên đã được cấp tài khoản.")

        linked.add(user.employeeId)
      }
    }

    if (
      !active.some(
        (user) =>
          [
            "SYSTEM_USER",

            "SYSTEM_ROLE",

            "SYSTEM_PERMISSION",

            "SYSTEM_DATA_PERMISSION",
          ].every((resource) =>
            ["VIEW", "CREATE", "UPDATE"].every((action) =>
              can(effective(user.id), resource, action),
            ),
          ) &&
          can(effective(user.id), "SYSTEM_USER", "LOCK") &&
          can(effective(user.id), "SYSTEM_USER", "RESET_PASSWORD") &&
          effective(user.id).dataScopes["SYSTEM_USER:WRITE"] === "ALL",
      )
    )
      fail("Không thể khóa tài khoản quản trị cuối cùng của hệ thống.")
  }

  if (!all("users").length)
    transaction(() => {
      const password =
        adminPassword || randomBytes(18).toString("base64url") + "Aa1"

      if (!validPassword(password))
        fail("MES_ADMIN_PASSWORD không đáp ứng policy.")

      const now = new Date().toISOString(),
        audit = {
          createdAt: now,

          updatedAt: now,

          createdBy: "seed",

          updatedBy: "seed",
        }

      for (const [kind, code] of Object.entries(resources)) {
        const actions =
          kind === "users"
            ? ["VIEW", "CREATE", "UPDATE", "LOCK", "RESET_PASSWORD"]
            : ["VIEW", "CREATE", "UPDATE"]

        write("permissions", {
          id: code,

          code,

          name: {
            users: "Người dùng",

            roles: "Vai trò",

            permissions: "Quyền chức năng",

            "data-permissions": "Quyền dữ liệu",
          }[kind],

          module: "SYSTEM",

          route: `/system/${kind}`,

          actions,

          status: "ACTIVE",

          ...audit,
        })

        for (const action of actions)
          db.prepare("INSERT INTO permission_actions VALUES (?,?)").run(
            code,

            action,
          )
      }

      for (const code of [
        "ADMIN",

        "PRODUCTION_MANAGER",

        "TEAM_LEADER",

        "PRODUCTION_WORKER",

        "WAREHOUSE_STAFF",

        "QUALITY_STAFF",
      ])
        write("roles", {
          id: code,

          code,

          name: code,

          description: "",

          status: "ACTIVE",

          ...audit,
        })

      for (const p of all("permissions")) {
        db.prepare("INSERT INTO role_permissions VALUES (?,?)").run(
          "ADMIN",

          p.id,
        )

        for (const action of p.actions)
          db.prepare("INSERT INTO role_permission_actions VALUES (?,?,?)").run(
            "ADMIN",

            p.id,

            action,
          )
      }

      for (const accessType of ["VIEW", "WRITE"]) {
        const id = `SYSTEM_USER_${accessType}_ALL`

        write("data-permissions", {
          id,

          code: id,

          name: `Người dùng – ${accessType} – Toàn bộ`,

          resource: "SYSTEM_USER",

          accessType,

          scope: "ALL",

          status: "ACTIVE",

          ...audit,
        })

        db.prepare("INSERT INTO role_data_permissions VALUES (?,?)").run(
          "ADMIN",

          id,
        )
      }

      write("employees", {
        id: "emp1",

        code: "EMP-001",

        fullName: "Nguyễn Văn An",

        productionTeamId: null,

        productionTeamName: "",

        email: "",

        phone: "",

        department: "dept1",

        grade: "grade1",

        jobTitle: "Công nhân",

        status: "ACTIVE",
      })

      write(
        "users",

        {
          id: randomUUID(),

          username: adminUsername,

          fullName: "Quản trị hệ thống",

          email: "",

          status: "ACTIVE",

          ...audit,
        },

        passwordHash(password),
      )

      const user = all("users")[0]

      db.prepare("INSERT INTO user_roles VALUES (?,?)").run(user.id, "ADMIN")

      if (!adminPassword)
        console.info(
          `MES initial admin: ${adminUsername} / ${password} (set MES_ADMIN_PASSWORD before first start to choose a password)`,
        )
    })

  if (!db.prepare("SELECT version FROM migrations WHERE version=2").get())
    transaction(() => {
      const seed = all("employees").find(
        (e) => e.id === "emp1" && e.code === "EMP-001",
      )

      if (seed && !seed.department)
        write("employees", {
          ...seed,

          department: "dept1",

          grade: "grade1",

          jobTitle: "Công nhân",

          status: seed.status || "ACTIVE",
        })

      db.prepare("INSERT INTO migrations VALUES (2)").run()
    })

  if (!db.prepare("SELECT version FROM migrations WHERE version=3").get())
    transaction(() => {
      const now = new Date().toISOString(),
        audit = {
          createdAt: now,

          updatedAt: now,

          createdBy: "seed",

          updatedBy: "seed",
        }

      for (const item of [
        {
          code: "PRODUCTION_ORDER",

          name: "Lệnh sản xuất",

          route: "/workspace/production-orders",

          actions: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "RELEASE"],
        },

        {
          code: "PRODUCTION_ASSIGNMENT",

          name: "Phân công sản xuất",

          route: "/workspace/production-assignments",

          actions: ["VIEW", "ASSIGN"],
        },
      ]) {
        let permission = all("permissions").find(
          (row) => row.code === item.code,
        )

        if (!permission) {
          permission = {
            ...item,

            id: item.code,

            module: "PRODUCTION",

            status: "ACTIVE",

            ...audit,
          }

          write("permissions", permission)

          for (const action of item.actions)
            db.prepare("INSERT INTO permission_actions VALUES (?,?)").run(
              permission.id,

              action,
            )
        }

        if (all("roles").some((role) => role.id === "ADMIN")) {
          db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(
            "ADMIN",

            permission.id,
          )

          for (const action of permission.actions)
            db.prepare(
              "INSERT OR IGNORE INTO role_permission_actions VALUES (?,?,?)",
            ).run("ADMIN", permission.id, action)

          for (const accessType of ["VIEW", "WRITE"]) {
            const code = `${item.code}_${accessType}_ALL`

            let scope = all("data-permissions").find((row) => row.code === code)

            if (!scope) {
              scope = {
                id: code,

                code,

                name: `${item.name} – ${accessType} – Toàn bộ`,

                resource: item.code,

                accessType,

                scope: "ALL",

                status: "ACTIVE",

                ...audit,
              }

              write("data-permissions", scope)
            }

            db.prepare(
              "INSERT OR IGNORE INTO role_data_permissions VALUES (?,?)",
            ).run("ADMIN", scope.id)
          }
        }
      }

      db.prepare("INSERT INTO migrations VALUES (3)").run()
    })

  if (!db.prepare("SELECT version FROM migrations WHERE version=4").get())
    transaction(() => {
      const now = new Date().toISOString(),
        audit = {
          createdAt: now,

          updatedAt: now,

          createdBy: "seed",

          updatedBy: "seed",
        }

      for (const item of [
        {
          code: "PRODUCTION_EXECUTION",

          name: "Thực thi sản xuất",

          route: "/workspace/production",

          actions: ["VIEW", "START", "EXECUTE", "PAUSE", "RESUME", "COMPLETE"],
        },
      ]) {
        let permission = all("permissions").find(
          (row) => row.code === item.code,
        )

        if (!permission) {
          permission = {
            ...item,

            id: item.code,

            module: "PRODUCTION",

            status: "ACTIVE",

            ...audit,
          }

          write("permissions", permission)

          for (const action of item.actions)
            db.prepare("INSERT INTO permission_actions VALUES (?,?)").run(
              permission.id,

              action,
            )
        }

        if (all("roles").some((role) => role.id === "ADMIN")) {
          db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(
            "ADMIN",

            permission.id,
          )

          for (const action of permission.actions)
            db.prepare(
              "INSERT OR IGNORE INTO role_permission_actions VALUES (?,?,?)",
            ).run("ADMIN", permission.id, action)

          for (const accessType of ["VIEW", "WRITE"]) {
            const code = `${item.code}_${accessType}_ALL`

            let scope = all("data-permissions").find((row) => row.code === code)

            if (!scope) {
              scope = {
                id: code,

                code,

                name: `${item.name} – ${accessType} – Toàn bộ`,

                resource: item.code,

                accessType,

                scope: "ALL",

                status: "ACTIVE",

                ...audit,
              }

              write("data-permissions", scope)
            }

            db.prepare(
              "INSERT OR IGNORE INTO role_data_permissions VALUES (?,?)",
            ).run("ADMIN", scope.id)
          }
        }
      }

      db.prepare("INSERT INTO migrations VALUES (4)").run()
    })

  if (!db.prepare("SELECT version FROM migrations WHERE version=5").get())
    transaction(() => {
      const now = new Date().toISOString(),
        audit = {
          createdAt: now,

          updatedAt: now,

          createdBy: "seed",

          updatedBy: "seed",
        }

      for (const item of [
        {
          code: "PRODUCTION_MONITOR",
          name: "Giám sát vận hành sản xuất",
          route: "/workspace/production-progress",
          actions: ["VIEW"],
        },
      ]) {
        let permission = all("permissions").find(
          (row) => row.code === item.code,
        )

        if (!permission) {
          permission = {
            ...item,

            id: item.code,

            module: "PRODUCTION",

            status: "ACTIVE",

            ...audit,
          }

          write("permissions", permission)

          for (const action of item.actions)
            db.prepare("INSERT INTO permission_actions VALUES (?,?)").run(
              permission.id,

              action,
            )
        }

        if (all("roles").some((role) => role.id === "ADMIN")) {
          db.prepare("INSERT OR IGNORE INTO role_permissions VALUES (?,?)").run(
            "ADMIN",

            permission.id,
          )

          for (const action of permission.actions)
            db.prepare(
              "INSERT OR IGNORE INTO role_permission_actions VALUES (?,?,?)",
            ).run("ADMIN", permission.id, action)

          for (const accessType of ["VIEW"]) {
            const code = `${item.code}_${accessType}_ALL`

            let scope = all("data-permissions").find((row) => row.code === code)

            if (!scope) {
              scope = {
                id: code,

                code,

                name: `${item.name} – ${accessType} – Toàn bộ`,

                resource: item.code,

                accessType,

                scope: "ALL",

                status: "ACTIVE",

                ...audit,
              }

              write("data-permissions", scope)
            }

            db.prepare(
              "INSERT OR IGNORE INTO role_data_permissions VALUES (?,?)",
            ).run("ADMIN", scope.id)
          }
        }
      }

      db.prepare("INSERT INTO migrations VALUES (5)").run()
    })

  function validate(kind, input, previous, auth) {
    const row = {
      id: previous?.id || randomUUID(),

      createdAt: previous?.createdAt || new Date().toISOString(),

      createdBy: previous?.createdBy || auth.user.id,

      updatedAt: new Date().toISOString(),

      updatedBy: auth.user.id,
    }

    const fields =
      kind === "users"
        ? ["username", "email", "avatar", "employeeId", "status"]
        : kind === "roles"
          ? ["code", "name", "description", "status"]
          : kind === "permissions"
            ? ["code", "name", "module", "route", "actions", "status"]
            : ["code", "name", "resource", "accessType", "scope", "status"]

    for (const key of fields)
      row[key] =
        input[key] ?? previous?.[key] ?? (key === "status" ? "ACTIVE" : "")

    for (const key of fields.filter((key) => key !== "actions"))
      if (typeof row[key] !== "string") fail("Kiểu dữ liệu không hợp lệ.")

    if (!["ACTIVE", "INACTIVE"].includes(row.status))
      fail("Trạng thái không hợp lệ.")

    if (kind === "users") {
      if (!row.username) fail("Vui lòng nhập tên đăng nhập.")

      if (!/^\S{4,50}$/.test(row.username))
        fail("Tên đăng nhập phải có 4–50 ký tự, không khoảng trắng.")

      if (previous && row.username !== previous.username)
        fail("Không được sửa tên đăng nhập.")

      if (
        all("users").some(
          (u) =>
            u.id !== row.id &&
            u.username.toLowerCase() === row.username.toLowerCase(),
        )
      )
        fail("Tên đăng nhập đã tồn tại.")

      if (!previous && !validPassword(input.password))
        fail("Mật khẩu chưa đáp ứng yêu cầu bảo mật.")

      if (!previous && input.password !== input.confirmPassword)
        fail("Xác nhận mật khẩu không khớp.")

      const employee = row.employeeId ? get("employees", row.employeeId) : null

      row.fullName = employee?.fullName || previous?.fullName || row.username

      row.email = employee?.email || row.email

      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
        fail("Email không hợp lệ.")

      if (
        row.avatar &&
        (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
          row.avatar,
        ) ||
          row.avatar.length > 2800000)
      )
        fail("Ảnh phải là PNG/JPEG/WebP, tối đa 2 MB.")

      if (previous && row.status !== previous.status)
        guard(auth, "SYSTEM_USER", "LOCK")
    } else {
      if (!/^[A-Z][A-Z0-9_]{1,99}$/.test(row.code) || !String(row.name).trim())
        fail("Mã viết hoa/snake_case và tên là bắt buộc.")

      if (previous && row.code !== previous.code)
        fail("Không được sửa mã sau khi tạo.")

      if (
        all(kind).some(
          (r) =>
            r.id !== row.id && r.code.toLowerCase() === row.code.toLowerCase(),
        )
      )
        fail("Mã đã tồn tại.")

      if (
        kind === "permissions" &&
        (![
          "MASTER_DATA",

          "PRODUCTION",

          "WAREHOUSE",

          "QUALITY",

          "SYSTEM",
        ].includes(row.module) ||
          !/^\/[a-zA-Z0-9/_:-]*$/.test(row.route) ||
          !Array.isArray(row.actions) ||
          !row.actions.length ||
          row.actions.some((a) => !ACTIONS.includes(a)))
      )
        fail("Module, route hoặc actions không hợp lệ.")

      if (
        kind === "data-permissions" &&
        (!all("permissions").some(
          (p) => p.code === row.resource && p.status === "ACTIVE",
        ) ||
          !["VIEW", "WRITE"].includes(row.accessType) ||
          !["ALL", "PRODUCTION_TEAM", "SELF"].includes(row.scope))
      )
        fail("Tài nguyên, loại truy cập hoặc phạm vi không hợp lệ.")
    }

    return row
  }

  function assignRoles(id, ids) {
    if (
      !Array.isArray(ids) ||
      ids.some((role) => get("roles", role).status !== "ACTIVE")
    )
      fail("Chỉ được gán vai trò đang hoạt động.")

    replace("user_roles", "user_id", id, "role_id", ids)
  }

  // Demo users are additive; existing administrators and passwords are preserved.
  if (demoAccounts) provisionDemoAccounts(db)
  let production
  const getProduction = () => {
    if (!production) {
      const next = createProduction(db, effective)
      const admin = all("users")
        .map((row) => effective(row.id))
        .find(
          (auth) =>
            auth.permissions.SYSTEM_USER?.includes("UPDATE") &&
            auth.dataScopes["SYSTEM_USER:WRITE"] === "ALL",
        )
      if (admin) {
        const revision = next.snapshot(admin).revision
        next.mutate(admin, {
          command: "prepareDemo",
          args: [true],
          revision,
          requestId: "demo-reference-setup-v2",
        })
        if (demoAccounts)
          next.mutate(admin, {
            command: "prepareHistory",
            args: [],
            revision: next.snapshot(admin).revision,
            requestId: "demo-history-setup-v1",
          })
      }
      production = next
    }
    return production
  }
  const attempts = new Map()

  async function handler(
    req,

    res,

    next = () => {
      res.statusCode = 404

      res.end()
    },
  ) {
    const url = new URL(req.url, "http://localhost")

    if (!url.pathname.startsWith("/api/")) return next()

    res.setHeader("Content-Type", "application/json; charset=utf-8")

    res.setHeader("Cache-Control", "no-store")

    const send = (value, status = 200) => {
      res.statusCode = status

      res.end(JSON.stringify(value))
    }

    try {
      const method = req.method || "GET"

      if (!["GET", "HEAD"].includes(method)) {
        const origin = req.headers.origin

        if (origin && new URL(origin).host !== req.headers.host)
          fail("Origin không hợp lệ.", 403)

        if (!(req.headers["content-type"] || "").includes("application/json"))
          fail("Yêu cầu application/json.", 415)
      }

      let body = {}

      if (!["GET", "HEAD"].includes(method)) {
        let raw = ""

        for await (const chunk of req) {
          raw += chunk

          if (Buffer.byteLength(raw) > 3000000) fail("Dữ liệu quá lớn.", 413)
        }

        try {
          body = JSON.parse(raw || "{}")
        } catch {
          fail("JSON không hợp lệ.")
        }

        if (!body || Array.isArray(body) || typeof body !== "object")
          fail("JSON không hợp lệ.")
      }

      const cookie = Object.fromEntries(
        (req.headers.cookie || "").split(";").map((p) => p.trim().split("=")),
      )

      const token = cookie.mes_session || "",
        tokenHash = hashToken(token)

      const session = db

        .prepare("SELECT * FROM sessions WHERE token_hash=? AND expires_at>?")

        .get(tokenHash, Date.now())

      const cookieValue = (value, maxAge) =>
        `mes_session=${value}; HttpOnly; SameSite=Strict; Path=/${
          maxAge ? `; Max-Age=${maxAge}` : ""
        }${process.env.NODE_ENV === "production" ? "; Secure" : ""}`

      if (url.pathname === "/api/auth/login" && method === "POST") {
        const key = req.socket.remoteAddress,
          attempt = attempts.get(key)

        if (attempt?.until > Date.now() && attempt.count >= 10)
          fail("Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.", 429)

        const row = db

          .prepare("SELECT * FROM users WHERE username=?")

          .get(String(body.username || ""))

        if (!row || !verify(body.password, row.password_hash)) {
          attempts.set(key, {
            count: (attempt?.until > Date.now() ? attempt.count : 0) + 1,

            until: Date.now() + 60000,
          })

          fail("Tên đăng nhập hoặc mật khẩu không đúng", 401)
        }

        const user = get("users", row.id)

        if (user.status !== "ACTIVE")
          fail("Tài khoản đã bị khóa. Vui lòng liên hệ quản trị hệ thống", 403)

        attempts.delete(key)

        const token = randomBytes(32).toString("hex"),
          seconds = body.remember ? 30 * 86400 : 8 * 3600

        db.prepare("DELETE FROM sessions WHERE expires_at<?").run(Date.now())

        db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
          hashToken(token),

          user.id,

          Date.now() + seconds * 1000,
        )

        write("users", { ...user, lastLoginAt: new Date().toISOString() })

        res.setHeader(
          "Set-Cookie",

          cookieValue(token, body.remember ? seconds : undefined),
        )

        return send(effective(user.id))
      }

      if (url.pathname === "/api/auth/logout" && method === "POST") {
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash)

        res.setHeader("Set-Cookie", cookieValue("", -1))

        return send({ ok: true })
      }

      if (!session || get("users", session.user_id).status !== "ACTIVE")
        fail("Phiên đăng nhập đã hết hạn.", 401)

      const auth = effective(session.user_id)

      if (url.pathname === "/api/production/snapshot" && method === "GET")
        return send(getProduction().snapshot(auth))

      if (url.pathname === "/api/production/command" && method === "POST")
        return send(getProduction().mutate(auth, body))

      if (url.pathname === "/api/auth/me" && method === "GET") return send(auth)

      if (url.pathname === "/api/system/options" && method === "GET") {
        if (
          !Object.values(resources).some(
            (r) =>
              can(auth, r, "VIEW") ||
              can(auth, r, "CREATE") ||
              can(auth, r, "UPDATE"),
          )
        )
          fail("Bạn không có quyền thực hiện thao tác này.", 403)

        const userEditor =
          can(auth, "SYSTEM_USER", "CREATE") ||
          can(auth, "SYSTEM_USER", "UPDATE")

        return send({
          roles:
            can(auth, "SYSTEM_ROLE", "VIEW") ||
            userEditor ||
            can(auth, "SYSTEM_USER", "VIEW")
              ? all("roles").map((r) => ({
                  id: r.id,

                  code: r.code,

                  name: r.name,

                  status: r.status,
                }))
              : [],

          permissions:
            can(auth, "SYSTEM_PERMISSION", "VIEW") ||
            can(auth, "SYSTEM_DATA_PERMISSION", "CREATE") ||
            can(auth, "SYSTEM_DATA_PERMISSION", "UPDATE")
              ? all("permissions")
              : [],

          dataPermissions: can(auth, "SYSTEM_DATA_PERMISSION", "VIEW")
            ? all("data-permissions")
            : [],

          employees: userEditor
            ? all("employees").map((e) => ({
                ...e,

                linkedUserId: all("users").find(
                  (u) => u.status === "ACTIVE" && u.employeeId === e.id,
                )?.id,
              }))
            : [],

          users: can(auth, "SYSTEM_USER", "VIEW")
            ? applyDataScope(auth, "SYSTEM_USER", "VIEW", all("users")).map(
                (u) => enrich("users", u),
              )
            : [],
        })
      }

      if (url.pathname === "/api/auth/password" && method === "POST") {
        if (
          !verify(
            body.currentPassword,

            db

              .prepare("SELECT password_hash FROM users WHERE id=?")

              .get(auth.user.id).password_hash,
          )
        )
          fail("Mật khẩu hiện tại không đúng.")

        if (!validPassword(body.password))
          fail("Mật khẩu chưa đáp ứng yêu cầu bảo mật.")

        if (body.password !== body.confirmPassword)
          fail("Xác nhận mật khẩu không khớp.")

        write("users", get("users", auth.user.id), passwordHash(body.password))

        db.prepare(
          "DELETE FROM sessions WHERE user_id=? AND token_hash<>?",
        ).run(auth.user.id, tokenHash)

        return send({ ok: true })
      }

      const [, , kind, id, operation, ...extra] = url.pathname.split("/")

      if (!tables[kind] || extra.length) fail("Không tìm thấy API.", 404)

      if (kind === "employees") {
        if (
          !["VIEW", "CREATE", "UPDATE"].some((action) =>
            can(auth, "SYSTEM_USER", action),
          ) &&
          !can(auth, "PRODUCTION_ASSIGNMENT", "VIEW") &&
          !can(auth, "PRODUCTION_EXECUTION", "VIEW") &&
          !can(auth, "PRODUCTION_MONITOR", "VIEW")
        )
          fail("Bạn không có quyền thực hiện thao tác này.", 403)

        if (method === "GET" && !id) {
          const directoryAccess = ["VIEW", "CREATE", "UPDATE"].some((action) =>
              can(auth, "SYSTEM_USER", action),
            ),
            scope = [
              "PRODUCTION_ASSIGNMENT",
              "PRODUCTION_EXECUTION",
              "PRODUCTION_MONITOR",
            ]

              .filter((resource) => can(auth, resource, "VIEW"))

              .map((resource) => auth.dataScopes[`${resource}:VIEW`])

              .filter((scope) =>
                ["ALL", "PRODUCTION_TEAM", "SELF"].includes(scope),
              )

              .sort(
                (a, b) =>
                  ["ALL", "PRODUCTION_TEAM", "SELF"].indexOf(a) -
                  ["ALL", "PRODUCTION_TEAM", "SELF"].indexOf(b),
              )[0],
            unit =
              auth.employee?.productionUnitId ||
              all("employees").find((row) => row.id === auth.employee?.id)
                ?.department

          const employees = all("employees")

          return send({
            items:
              directoryAccess || scope === "ALL"
                ? employees
                : scope === "PRODUCTION_TEAM" && unit
                  ? employees.filter(
                      (row) =>
                        (row.productionUnitId || row.department) === unit,
                    )
                  : scope === "SELF"
                    ? employees.filter((row) => row.id === auth.employee?.id)
                    : [],
          })
        }

        // Employee ownership determines data scopes. Only administrators of both

        // users and roles with unrestricted write scope may change that source.

        guard(auth, "SYSTEM_USER", "UPDATE")

        guard(auth, "SYSTEM_ROLE", "UPDATE")

        if (auth.dataScopes["SYSTEM_USER:WRITE"] !== "ALL")
          fail("Bạn không có quyền thực hiện thao tác này.", 403)

        const result = transaction(() => {
          const saveEmployee = (input, previous) => {
            if (!input || typeof input !== "object" || Array.isArray(input))
              fail("Dữ liệu nhân viên không hợp lệ.")

            const row = { id: previous?.id || randomUUID() }

            for (const key of [
              "code",

              "fullName",

              "productionUnitId",

              "department",

              "grade",

              "jobTitle",

              "joinedDate",

              "contact",

              "description",

              "email",

              "phone",

              "productionTeamId",

              "productionTeamName",

              "status",
            ]) {
              const value =
                input[key] ??
                previous?.[key] ??
                (key === "status" ? "ACTIVE" : "")

              if (typeof value !== "string" || value.length > 1000)
                fail("Dữ liệu nhân viên không hợp lệ.")

              row[key] = value.trim()
            }

            row.productionUnitId ||= row.department

            row.department = row.productionUnitId

            if (
              !row.code ||
              !row.fullName ||
              !row.department ||
              !["ACTIVE", "INACTIVE"].includes(row.status)
            )
              fail("Mã, tên, phòng ban và trạng thái nhân viên là bắt buộc.")

            if (previous && row.code !== previous.code)
              fail("Không được sửa mã nhân viên.")

            if (
              all("employees").some(
                (e) =>
                  e.id !== row.id &&
                  e.code.toLowerCase() === row.code.toLowerCase(),
              )
            )
              fail("Mã nhân viên đã tồn tại.")

            if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
              fail("Email không hợp lệ.")

            row.createdAt = previous?.createdAt || new Date().toISOString()

            row.createdBy = previous?.createdBy || auth.user.id

            row.updatedAt = new Date().toISOString()

            row.updatedBy = auth.user.id

            write("employees", row)

            for (const user of all("users").filter(
              (u) => u.employeeId === row.id,
            ))
              write("users", {
                ...user,

                fullName: row.fullName,

                email: row.email || user.email,

                updatedAt: row.updatedAt,

                updatedBy: auth.user.id,
              })

            db.prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)").run(
              randomUUID(),

              auth.user.id,

              `${method}:employees`,

              row.id,

              row.updatedAt,
            )

            return row
          }

          if (method === "POST" && id === "import" && !operation) {
            if (
              !Array.isArray(body.items) ||
              !body.items.length ||
              body.items.length > 5000
            )
              fail("Danh sách import không hợp lệ.")

            return { items: body.items.map((item) => saveEmployee(item, null)) }
          }

          if (operation) fail("Không tìm thấy API.", 404)

          if (method === "DELETE" && id) {
            get("employees", id)

            if (all("users").some((user) => user.employeeId === id))
              fail(
                "Nhân viên đã liên kết tài khoản, không thể xóa. Hãy ngừng hoạt động.",
              )

            db.prepare("DELETE FROM employees WHERE id=?").run(id)

            db.prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)").run(
              randomUUID(),

              auth.user.id,

              "DELETE:employees",

              id,

              new Date().toISOString(),
            )

            return { ok: true }
          }

          if (method === "POST" && !id) return saveEmployee(body, null)

          if (method === "PUT" && id)
            return saveEmployee(body, get("employees", id))

          fail("Không tìm thấy API.", 404)
        })

        return send(result)
      }

      const resource = resources[kind],
        action =
          method === "GET"
            ? "VIEW"
            : method === "POST" && !id
              ? "CREATE"
              : operation === "status"
                ? "LOCK"
                : operation === "reset-password"
                  ? "RESET_PASSWORD"
                  : "UPDATE"

      guard(auth, resource, action)

      if (kind === "users" && id)
        checkUserScope(auth, id, method === "GET" ? "VIEW" : "WRITE")

      if (method === "GET") {
        if (operation) fail("Không tìm thấy API.", 404)

        if (id) return send(enrich(kind, get(kind, id)))

        let items = all(kind).map((row) => enrich(kind, row))

        if (kind === "users")
          items = applyDataScope(auth, resource, "VIEW", items)

        for (const field of [
          "username",

          "fullName",

          "email",

          "status",

          "roleId",

          "keyword",
        ]) {
          const value = url.searchParams.get(field)

          if (!value) continue

          items = items.filter((row) =>
            field === "roleId"
              ? row.roleIds?.includes(value)
              : field === "status"
                ? row.status === value
                : field === "keyword"
                  ? `${row.code} ${row.name}`

                      .toLowerCase()

                      .includes(value.toLowerCase())
                  : String(row[field] || "")

                      .toLowerCase()

                      .includes(value.toLowerCase()),
          )
        }

        const total = items.length,
          page = Math.max(1, Number(url.searchParams.get("page")) || 1),
          pageSize = Math.min(
            1000,

            Math.max(1, Number(url.searchParams.get("pageSize")) || 10),
          )

        return send({
          items: items.slice((page - 1) * pageSize, page * pageSize),

          total,

          page,

          pageSize,
        })
      }

      const result = transaction(() => {
        const previous = id ? get(kind, id) : null

        if (
          kind === "users" &&
          operation === "reset-password" &&
          method === "POST"
        ) {
          if (!validPassword(body.password))
            fail("Mật khẩu chưa đáp ứng yêu cầu bảo mật.")

          if (body.password !== body.confirmPassword)
            fail("Xác nhận mật khẩu không khớp.")

          write(
            kind,

            {
              ...previous,

              updatedAt: new Date().toISOString(),

              updatedBy: auth.user.id,
            },

            passwordHash(body.password),
          )

          db.prepare("DELETE FROM sessions WHERE user_id=?").run(id)
        } else if (
          kind === "users" &&
          operation === "roles" &&
          method === "PUT"
        )
          assignRoles(id, body.roleIds)
        else if (
          kind === "users" &&
          operation === "status" &&
          method === "PATCH"
        ) {
          const row = validate(kind, { status: body.status }, previous, auth)

          write(kind, row)

          if (row.status === "INACTIVE")
            db.prepare("DELETE FROM sessions WHERE user_id=?").run(id)
        } else if (kind === "roles" && operation && method === "PUT") {
          if (operation === "users") {
            guard(auth, "SYSTEM_USER", "UPDATE")

            if (!Array.isArray(body.userIds))
              fail("Danh sách người dùng không hợp lệ.")

            const old = relation("user_roles", "role_id", id, "user_id"),
              affected = [...new Set([...old, ...body.userIds])]

            for (const userId of affected) {
              get("users", userId)

              checkUserScope(auth, userId, "WRITE")
            }

            if (
              previous.status !== "ACTIVE" &&
              body.userIds.some((u) => !old.includes(u))
            )
              fail("Chỉ được gán vai trò đang hoạt động.")

            replace("user_roles", "role_id", id, "user_id", body.userIds)
          } else if (operation === "permissions") {
            guard(auth, "SYSTEM_PERMISSION", "VIEW")

            if (!body.permissions || typeof body.permissions !== "object")
              fail("Danh sách quyền không hợp lệ.")

            db.prepare(
              "DELETE FROM role_permission_actions WHERE role_id=?",
            ).run(id)

            db.prepare("DELETE FROM role_permissions WHERE role_id=?").run(id)

            for (const [permissionId, actions] of Object.entries(
              body.permissions,
            )) {
              const p = get("permissions", permissionId)

              if (
                p.status !== "ACTIVE" ||
                !Array.isArray(actions) ||
                actions.some((a) => !p.actions.includes(a))
              )
                fail("Action không thuộc tài nguyên đang hoạt động.")

              if (actions.length) {
                db.prepare("INSERT INTO role_permissions VALUES (?,?)").run(
                  id,

                  permissionId,
                )

                for (const action of new Set(actions))
                  db.prepare(
                    "INSERT INTO role_permission_actions VALUES (?,?,?)",
                  ).run(id, permissionId, action)
              }
            }
          } else if (operation === "data-permissions") {
            guard(auth, "SYSTEM_DATA_PERMISSION", "VIEW")

            if (
              !Array.isArray(body.dataPermissionIds) ||
              body.dataPermissionIds.some(
                (p) => get("data-permissions", p).status !== "ACTIVE",
              )
            )
              fail("Quyền dữ liệu không hợp lệ.")

            replace(
              "role_data_permissions",

              "role_id",

              id,

              "data_permission_id",

              body.dataPermissionIds,
            )
          } else fail("Không tìm thấy API.", 404)
        } else if (
          !operation &&
          ((!id && method === "POST") ||
            (id && ["PUT", "PATCH"].includes(method)))
        ) {
          const row = validate(kind, body, previous, auth)

          if (
            kind === "users" &&
            !applyDataScope(auth, resource, "WRITE", [row]).length
          )
            fail("Bạn không có quyền thực hiện thao tác này.", 403)

          write(
            kind,

            row,

            kind === "users" && !id ? passwordHash(body.password) : undefined,
          )

          if (kind === "users") {
            if (!id || body.roleIds !== undefined)
              assignRoles(row.id, body.roleIds)

            if (row.status === "INACTIVE")
              db.prepare("DELETE FROM sessions WHERE user_id=?").run(row.id)
          }

          if (kind === "permissions") {
            const removed = (previous?.actions || []).filter(
              (a) => !row.actions.includes(a),
            )

            for (const action of removed) {
              db.prepare(
                "DELETE FROM role_permission_actions WHERE permission_id=? AND action=?",
              ).run(row.id, action)

              db.prepare(
                "DELETE FROM permission_actions WHERE permission_id=? AND action=?",
              ).run(row.id, action)
            }

            for (const action of row.actions)
              db.prepare(
                "INSERT OR IGNORE INTO permission_actions VALUES (?,?)",
              ).run(row.id, action)
          }

          invariants()

          db.prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)").run(
            randomUUID(),

            auth.user.id,

            `${method}:${kind}`,

            row.id,

            new Date().toISOString(),
          )

          return enrich(kind, row)
        } else fail("Không tìm thấy API.", 404)

        invariants()

        db.prepare("INSERT INTO audit_logs VALUES (?,?,?,?,?)").run(
          randomUUID(),

          auth.user.id,

          `${method}:${kind}:${operation}`,

          id,

          new Date().toISOString(),
        )

        return enrich(kind, get(kind, id))
      })

      return send(result)
    } catch (error) {
      const status = error.status || 500

      if (status === 500) console.error(error)

      send(
        {
          message:
            status === 500 ? "Lỗi hệ thống. Vui lòng thử lại." : error.message,
        },

        status,
      )
    }
  }

  return { handler, db, effective, applyDataScope, close: () => db.close() }
}
