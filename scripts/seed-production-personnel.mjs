// Add the personnel referenced by the production sample. Existing employee records are never edited.

const root = process.env.MES_SEED_URL || "http://127.0.0.1:3001/api"

let cookie = ""

async function request(path, method = "GET", body) {
  const response = await fetch(root + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok)
    throw new Error(`Seed request failed (${response.status}) at ${path}`)

  if (path === "/auth/login")
    cookie = response.headers.get("set-cookie")?.split(";")[0] || ""

  return response.json()
}

if (!process.env.MES_SEED_PASSWORD)
  throw new Error("Set MES_SEED_PASSWORD before running this script")

await request("/auth/login", "POST", {
  username: process.env.MES_SEED_USER || "admin",
  password: process.env.MES_SEED_PASSWORD,
})

const { items } = await request("/employees")

const names = [
  "Nguyễn Văn Minh",
  "Trần Quốc Huy",
  "Lê Thành Nam",
  "Phạm Đức Anh",
  "Hoàng Văn Long",
  "Đỗ Quang Tuấn",
  "Bùi Minh Hải",
  "Vũ Đức Thành",
]

let created = 0

for (const [index, fullName] of names.entries()) {
  const code = `EMP-SX-${String(index + 1).padStart(3, "0")}`

  if (items.some((employee) => employee.code === code)) continue

  await request("/employees", "POST", {
    code,
    fullName,
    productionUnitId: "dept1",
    department: "dept1",
    jobTitle: "Nhân viên sản xuất",
    status: "ACTIVE",
  })

  created++
}

await request("/auth/logout", "POST", {})

console.log(
  `Production personnel ready: ${created} added, ${names.length - created} already present.`,
)
