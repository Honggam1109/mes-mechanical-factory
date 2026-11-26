import { randomBytes, scryptSync } from "node:crypto"

export function provisionDemoAccounts(db) {
  if (db.prepare("SELECT 1 FROM migrations WHERE version=6").get()) return
  const now = new Date().toISOString()
  const audit = {
    createdAt: now,
    updatedAt: now,
    createdBy: "demo-setup",
    updatedBy: "demo-setup",
    status: "ACTIVE",
  }
  const roles = [
    [
      "DEMO_PLANNER",
      "Kế hoạch viên",
      "kehoach",
      "Lê Minh Kế",
      "demo-planner",
      null,
      {
        PRODUCTION_ORDER: [
          "VIEW",
          "CREATE",
          "UPDATE",
          "DELETE",
          "EXPORT",
          "RELEASE",
        ],
      },
      "ALL",
    ],
    [
      "DEMO_LEADER",
      "Tổ trưởng",
      "totruong",
      "Trần Văn Bình",
      "demo-leader",
      "demo-team-a",
      {
        PRODUCTION_ASSIGNMENT: ["VIEW", "ASSIGN"],
        PRODUCTION_MONITOR: ["VIEW"],
      },
      "PRODUCTION_TEAM",
    ],
    [
      "DEMO_WORKER",
      "Công nhân",
      "thucthi",
      "Nguyễn Văn An",
      "demo-worker",
      "demo-team-a",
      {
        PRODUCTION_EXECUTION: [
          "VIEW",
          "START",
          "EXECUTE",
          "PAUSE",
          "RESUME",
          "COMPLETE",
        ],
      },
      "SELF",
    ],
  ]
  db.exec("BEGIN IMMEDIATE")
  try {
    for (const [
      id,
      name,
      username,
      fullName,
      employeeId,
      team,
      permissions,
      scope,
    ] of roles) {
      // Never silently take over an existing username or reset a password.
      if (db.prepare("SELECT 1 FROM users WHERE username=?").get(username))
        continue
      db.prepare("INSERT INTO roles VALUES (?,?,?)").run(
        id,
        id,
        JSON.stringify({
          ...audit,
          id,
          code: id,
          name,
          description: "Vai trò demo MO → thực thi",
        }),
      )
      db.prepare("INSERT INTO employees VALUES (?,?)").run(
        employeeId,
        JSON.stringify({
          id: employeeId,
          code: employeeId.toUpperCase(),
          fullName,
          productionTeamId: team,
          productionTeamName: team ? "Tổ gia công cơ khí A" : "",
          productionUnitId: team || "",
          department: team || "",
          email: "",
          phone: "",
          status: "ACTIVE",
        }),
      )
      const salt = randomBytes(16).toString("hex")
      const hash = `${salt}:${scryptSync("Demo@123456", salt, 64).toString("hex")}`
      db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(
        id,
        username,
        hash,
        JSON.stringify({
          ...audit,
          id,
          username,
          fullName,
          employeeId,
          email: "",
        }),
      )
      db.prepare("INSERT INTO user_roles VALUES (?,?)").run(id, id)
      for (const [resource, actions] of Object.entries(permissions)) {
        const p = db
          .prepare("SELECT id FROM permissions WHERE code=?")
          .get(resource)
        if (!p) throw new Error(`Missing production permission: ${resource}`)
        db.prepare("INSERT INTO role_permissions VALUES (?,?)").run(id, p.id)
        for (const action of actions)
          db.prepare("INSERT INTO role_permission_actions VALUES (?,?,?)").run(
            id,
            p.id,
            action,
          )
        for (const accessType of resource === "PRODUCTION_MONITOR"
          ? ["VIEW"]
          : ["VIEW", "WRITE"]) {
          const dataId = `${id}_${resource}_${accessType}`
          db.prepare("INSERT INTO data_permissions VALUES (?,?,?)").run(
            dataId,
            dataId,
            JSON.stringify({
              ...audit,
              id: dataId,
              code: dataId,
              name: `${name} · ${resource} · ${accessType}`,
              resource,
              accessType,
              scope,
            }),
          )
          db.prepare("INSERT INTO role_data_permissions VALUES (?,?)").run(
            id,
            dataId,
          )
        }
      }
    }
    db.prepare("INSERT INTO migrations VALUES (6)").run()
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}
