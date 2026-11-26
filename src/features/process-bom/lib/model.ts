import type { RecordData } from "../../master-data/config"

export type Catalog = Record<string, RecordData[]>

export interface BomLine extends Record<string, unknown> {
  material: string

  quantity: number

  waste?: number

  bom?: string

  note: string
}

export interface RouteStep extends Record<string, unknown> {
  stepId: string

  order: number

  operation: string

  note: string
}

export const text = (value: unknown) => String(value ?? "")

export const active = (record?: RecordData) => record?.status === "Hoạt động"

export const bomLines = (record?: RecordData) =>
  (Array.isArray(record?.details) ? record.details : []) as BomLine[]

export const routeSteps = (record?: RecordData) =>
  (Array.isArray(record?.details) ? record.details : []) as RouteStep[]

export const operationUnitIds = (record?: RecordData): string[] =>
  Array.isArray(record?.productionUnitIds)
    ? record.productionUnitIds.map(String)
    : []

export const orderedSteps = (record?: RecordData) =>
  [...routeSteps(record)].sort((a, b) => Number(a.order) - Number(b.order))

export const componentProduct = (record: RecordData) =>
  ["Bán thành phẩm", "Linh kiện/Vật tư"].includes(
    text(record.category).replace(/\s*\/\s*/g, "/"),
  )

export function nextCode(rows: RecordData[], prefix: string) {
  const max = rows.reduce(
    (value, row) =>
      Math.max(
        value,

        Number(text(row.code).match(new RegExp(`^${prefix}-([0-9]+)$`))?.[1]) ||
          0,
      ),

    0,
  )

  return `${prefix}-${String(max + 1).padStart(4, "0")}`
}

function validateHeader(
  kind: "boms" | "routes",

  record: RecordData,

  all: Catalog,

  previousCatalog: Catalog,
) {
  const errors: string[] = []

  if (!text(record.code).trim()) errors.push("Mã là bắt buộc.")

  if (
    all[kind].some(
      (row) =>
        row.id !== record.id &&
        text(row.code).trim().toLowerCase() ===
          text(record.code).trim().toLowerCase() &&
        (kind !== "routes" || text(row.version) === text(record.version)),
    )
  )
    errors.push("Mã đã tồn tại.")

  if (!["Hoạt động", "Không hoạt động"].includes(text(record.status)))
    errors.push("Trạng thái không hợp lệ.")

  const product = all.products.find((row) => row.id === record.product)

  const previous = previousCatalog[kind].find((row) => row.id === record.id)

  if (
    !product ||
    (!active(product) &&
      (active(record) || previous?.product !== record.product))
  )
    errors.push("Vui lòng chọn sản phẩm đang hoạt động.")

  if (
    !product?.unit ||
    !all.units.some(
      (unit) =>
        [unit.name, unit.label].includes(product.unit) &&
        (active(unit) || !active(record)),
    )
  )
    errors.push(
      "Đơn vị tính sản phẩm chưa được khai báo hoặc đã ngừng sử dụng.",
    )

  return errors
}

export function validateOperation(
  record: RecordData,

  all: Catalog,

  previousCatalog: Catalog = all,
): string[] {
  const errors: string[] = [],
    ids = operationUnitIds(record)

  if (!text(record.code).trim()) errors.push("Mã công đoạn là bắt buộc.")

  if (!text(record.name).trim())
    errors.push("Tên công đoạn không được để trống.")

  if (!["Hoạt động", "Không hoạt động"].includes(text(record.status)))
    errors.push("Trạng thái công đoạn không hợp lệ.")

  if (
    all.operations.some(
      (row) =>
        row.id !== record.id &&
        text(row.code).trim().toLowerCase() ===
          text(record.code).trim().toLowerCase(),
    )
  )
    errors.push("Mã công đoạn đã tồn tại.")

  if (!ids.length)
    errors.push(
      "Công đoạn phải có ít nhất một Đơn vị sản xuất có thể thực hiện.",
    )

  if (new Set(ids).size !== ids.length)
    errors.push("Không được chọn trùng Đơn vị sản xuất.")

  const previous = previousCatalog.operations.find(
    (row) => row.id === record.id,
  )

  for (const id of ids)
    if (
      !all.productionUnits.some(
        (unit) =>
          unit.id === id &&
          (active(unit) || operationUnitIds(previous).includes(id)),
      )
    )
      errors.push("Đơn vị sản xuất không tồn tại hoặc đã ngừng hoạt động.")

  return [...new Set(errors)]
}

export function validateBom(
  record: RecordData,

  all: Catalog,

  previousCatalog: Catalog = all,
): string[] {
  const errors = validateHeader("boms", record, all, previousCatalog),
    lines = bomLines(record)

  if (!Number.isFinite(Number(record.quantity)) || Number(record.quantity) <= 0)
    errors.push("Số lượng cơ sở phải lớn hơn 0.")

  if (!lines.length) errors.push("BOM phải có ít nhất một thành phần.")

  if (new Set(lines.map((line) => line.material)).size !== lines.length)
    errors.push("Không được thêm trùng thành phần trong một BOM.")

  for (const [index, line] of lines.entries()) {
    const product = all.products.find((row) => row.id === line.material)

    if (!active(product))
      errors.push(
        `Dòng ${index + 1}: thành phần không tồn tại hoặc đã ngừng hoạt động.`,
      )

    if (product && !componentProduct(product))
      errors.push(
        `Dòng ${index + 1}: chỉ chọn Bán thành phẩm hoặc Linh kiện/Vật tư.`,
      )

    if (line.material === record.product)
      errors.push(
        `Dòng ${index + 1}: không được chọn chính sản phẩm đang lập BOM.`,
      )

    if (!product?.unit)
      errors.push(
        `Dòng ${index + 1}: thành phần chưa có đơn vị tính tại danh mục Sản phẩm.`,
      )

    if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)
      errors.push(`Dòng ${index + 1}: số lượng định mức phải lớn hơn 0.`)
  }

  for (const [index, line] of lines.entries()) {
    if (
      !Number.isFinite(Number(line.waste || 0)) ||
      Number(line.waste || 0) < 0 ||
      Number(line.waste || 0) > 100
    )
      errors.push(`Dòng ${index + 1}: hao hụt phải từ 0 đến 100%.`)

    if (line.bom) {
      const child = all.boms.find((bom) => bom.id === line.bom)

      if (
        !child ||
        child.product !== line.material ||
        (!active(child) && active(record))
      )
        errors.push(
          `Dòng ${index + 1}: BOM con phải phù hợp thành phần và đang hoạt động.`,
        )
    }
  }

  const catalogue = {
    ...all,

    boms: [...all.boms.filter((row) => row.id !== record.id), record],
  }

  const visit = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return true

    const bom = catalogue.boms.find((row) => row.id === id)

    return (
      !!bom &&
      bomLines(bom).some(
        (line) => !!line.bom && visit(line.bom, new Set(path).add(id)),
      )
    )
  }

  if (visit(record.id, new Set()))
    errors.push("BOM tạo vòng lặp. Hãy kiểm tra BOM con.")

  return [...new Set(errors)]
}

export function validateRoute(
  record: RecordData,

  all: Catalog,

  previousCatalog: Catalog = all,
): string[] {
  const errors = validateHeader("routes", record, all, previousCatalog),
    steps = routeSteps(record)

  if (!text(record.name).trim())
    errors.push("Tên quy trình không được để trống.")

  const bom = all.boms.find((row) => row.id === record.bom)

  if (!bom || !active(bom))
    errors.push("Vui lòng chọn định mức BOM đang hoạt động.")

  if (bom && bom.product !== record.product)
    errors.push("Sản phẩm của quy trình phải khớp BOM.")

  if (!Number.isFinite(Number(record.quantity)) || Number(record.quantity) <= 0)
    errors.push("Sản lượng chuẩn phải lớn hơn 0.")

  if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(text(record.lifecycle)))
    errors.push("Trạng thái phiên bản không hợp lệ.")

  if (!/^\d+\.\d+$/.test(text(record.version)))
    errors.push("Phiên bản không hợp lệ.")

  if (!steps.length) errors.push("Quy trình phải có ít nhất một công đoạn.")

  if (new Set(steps.map((step) => Number(step.order))).size !== steps.length)
    errors.push("Thứ tự công đoạn không được trùng.")

  for (const [index, step] of steps.entries()) {
    if (!Number.isInteger(Number(step.order)) || Number(step.order) <= 0)
      errors.push(`Dòng ${index + 1}: thứ tự phải là số nguyên dương.`)

    if (!active(all.operations.find((row) => row.id === step.operation)))
      errors.push(
        `Dòng ${index + 1}: công đoạn không tồn tại hoặc đã ngừng hoạt động.`,
      )
  }

  if (
    all.routes.some(
      (row) =>
        row.id !== record.id &&
        row.code === record.code &&
        row.product !== record.product,
    )
  )
    errors.push(
      "Các phiên bản cùng mã quy trình phải thuộc cùng sản phẩm. Hãy tạo quy trình mới cho sản phẩm khác.",
    )

  const primary = all.operations.find((row) => row.id === record.operation)

  if (
    !primary ||
    !active(primary) ||
    !steps.some((step) => step.operation === record.operation)
  )
    errors.push(
      "Công đoạn chính phải nằm trong danh sách công đoạn và đang hoạt động.",
    )

  if (
    !operationUnitIds(primary).includes(text(record.productionUnit)) ||
    !active(
      all.productionUnits.find((unit) => unit.id === record.productionUnit),
    )
  )
    errors.push(
      "Đơn vị sản xuất phải đang hoạt động và có khả năng thực hiện công đoạn chính.",
    )

  const materials = Array.isArray(record.materials)
    ? record.materials.map(String)
    : []

  if (
    new Set(materials).size !== materials.length ||
    materials.some((id) => !bomLines(bom).some((line) => line.material === id))
  )
    errors.push("Vật tư tiêu hao phải thuộc BOM đã chọn và không được trùng.")

  if (
    all.routes.some(
      (row) =>
        row.id !== record.id &&
        row.code === record.code &&
        row.lifecycle === record.lifecycle &&
        ["DRAFT", "ACTIVE"].includes(text(record.lifecycle)),
    )
  )
    errors.push(
      record.lifecycle === "DRAFT"
        ? "Quy trình đã có một bản nháp."
        : "Mỗi mã quy trình chỉ có một phiên bản đang áp dụng.",
    )

  return [...new Set(errors)]
}

export function productionReferenced(
  kind: "boms" | "routes",

  id: string,

  all: Catalog,
) {
  const keys =
    kind === "boms"
      ? ["bom", "bomId"]
      : ["route", "routeId", "process", "processId", "technologyRouteId"]

  const contains = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(contains)

    if (!value || typeof value !== "object") return false

    return Object.entries(value).some(
      ([key, item]) =>
        (keys.includes(key) &&
          (item === id ||
            (!!item &&
              typeof item === "object" &&
              (item as { id?: unknown }).id === id))) ||
        (typeof item === "object" && contains(item)),
    )
  }

  return [
    "orders",

    "productionOrders",

    "assignments",

    "productionAssignments",

    "executions",

    "productionExecutions",
  ].some((entity) => (all[entity] || []).some(contains))
}

export const lifecycleLabel = (value: unknown) =>
  value === "ACTIVE"
    ? "Đang áp dụng"
    : value === "ARCHIVED"
      ? "Lưu trữ"
      : "Bản nháp"

export const applied = (row: RecordData) => row.lifecycle === "ACTIVE"

export function routeCatalog(route: RecordData, all: Catalog): Catalog {
  const frozen = route.referenceSnapshot as unknown as Catalog | undefined

  return frozen && ["ACTIVE", "ARCHIVED"].includes(text(route.lifecycle))
    ? { ...all, ...frozen }
    : all
}

export function bomClosure(
  id: string,

  all: Catalog,

  path = new Set<string>(),
): RecordData[] {
  if (path.has(id)) return []

  const bom = all.boms.find((row) => row.id === id)

  if (!bom) return []

  const next = new Set(path).add(id)

  return [
    bom,

    ...bomLines(bom).flatMap((line) =>
      line.bom ? bomClosure(line.bom, all, next) : [],
    ),
  ]
}

export function consumption(route: RecordData, all: Catalog) {
  const catalog = routeCatalog(route, all),
    bom = catalog.boms.find((row) => row.id === route.bom),
    selected = Array.isArray(route.materials) ? route.materials.map(String) : []

  return bomLines(bom)

    .filter((line) => selected.includes(line.material))

    .map((line) => {
      const quantity =
        (Number(line.quantity) * Number(route.quantity || 1)) /
        Number(bom?.quantity || 1)

      return {
        ...line,

        quantity,

        total: quantity * (1 + Number(line.waste || 0) / 100),

        product: catalog.products.find(
          (product) => product.id === line.material,
        ),
      }
    })
}

export interface BomNode {
  key: string

  title: string

  product: string

  bom?: string

  quantity: number

  unit: string

  waste: number

  note: string

  children?: BomNode[]
}

export function buildBomTree(
  record: RecordData,

  all: Catalog,

  quantity = Number(record.quantity || 1),
): BomNode {
  const walk = (
    bom: RecordData,

    amount: number,

    key: string,

    path: Set<string>,
  ): BomNode => {
    const product = all.products.find((row) => row.id === bom.product)

    const node: BomNode = {
      key,

      title: `${text(product?.code)} · ${text(product?.name)}`,

      product: text(bom.product),

      bom: bom.id,

      quantity: amount,

      unit: text(product?.unit),

      waste: 0,

      note: text(bom.description),
    }

    if (path.has(bom.id)) return { ...node, note: "Vòng lặp BOM" }

    node.children = bomLines(bom).map((line, index) => {
      const child = all.boms.find((row) => row.id === line.bom),
        material = all.products.find((row) => row.id === line.material),
        used =
          (amount / Number(bom.quantity || 1)) *
          Number(line.quantity) *
          (1 + Number(line.waste || 0) / 100),
        childKey = `${key}/${index}`

      return child
        ? {
            ...walk(child, used, childKey, new Set(path).add(bom.id)),

            waste: Number(line.waste || 0),

            note: line.note,
          }
        : {
            key: childKey,

            title: `${text(material?.code)} · ${text(material?.name)}`,

            product: line.material,

            quantity: used,

            unit: text(material?.unit),

            waste: Number(line.waste || 0),

            note: line.note,
          }
    })

    return node
  }

  return walk(record, quantity, record.id, new Set())
}
