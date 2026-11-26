import { productionState } from "../production/lib/model"

import { validateProductionCommit } from "../production/lib/integrity"

import type { ProductionState } from "../production/types"

import { migrateProcessBom } from "../process-bom/lib/migration"

import {
  active,
  bomLines,
  routeSteps,
  operationUnitIds,
  productionReferenced,
  validateBom,
  validateRoute,
  validateOperation,
} from "../process-bom/lib/model"

import { useSyncExternalStore } from "react"

import { productMockData } from "../products/mocks/products"

import { definitions } from "./config"

import { ids, validateLinkedRecord } from "./rules"

import type { RecordData } from "./config"

import { mockUnits } from "../units/mocks/units"

const row = (
  id: string,

  code: string,

  name: string,

  extras: Record<string, unknown> = {},
) =>
  ({
    id,

    code,

    name,

    status: "Hoạt động",

    description: "",

    ...extras,
  }) as RecordData

let data: Record<string, RecordData[]> = {
  products: productMockData.map(
    (item) => ({ ...item, id: item.key }) as unknown as RecordData,
  ),

  units: mockUnits.map((item) => ({
    ...item,

    code: item.name,

    status: item.status === "ACTIVE" ? "Hoạt động" : "Không hoạt động",
  })),

  categories: [
    row("cat1", "CAT-001", "Thành phẩm"),

    row("cat2", "CAT-002", "Linh kiện"),
  ],

  attributes: [
    row("att1", "ATT-001", "Màu sắc", {
      kind: "Danh sách chọn",

      values: ["Đỏ", "Đen", "Trắng"],
    }),

    row("att2", "ATT-002", "Chất liệu", { kind: "Nhập giá trị", values: [] }),
  ],

  areas: [
    row("area1", "AREA-001", "Xưởng gia công cơ khí", {
      kind: "Xưởng",

      inputWarehouse: "wh1",

      outputWarehouse: "wh2",
    }),
  ],

  productionUnits: [
    row("dept1", "PU-001", "Sản xuất"),

    row("area1", "PU-002", "Xưởng gia công cơ khí", { parent: "dept1" }),
  ],

  stations: [],

  suppliers: [],

  operations: [
    row("op1", "OP-001", "Tiện thô", {
      productionUnitIds: ["area1"],
    }),
  ],

  warehouses: [
    row("wh1", "WH-001", "Kho nguyên vật liệu", {
      kind: "Nguyên vật liệu",

      department: "dept1",

      productionUnitId: "dept1",
    }),

    row("wh2", "WH-002", "Kho thành phẩm", { kind: "Thành phẩm" }),
  ],

  locations: [
    row("loc1", "LOC-001", "Kệ A01", { warehouse: "wh1", kind: "Kệ" }),
  ],

  departments: [row("dept1", "DEPT-001", "Sản xuất")],

  grades: [row("grade1", "GRADE-001", "Bậc 1", { order: 1 })],

  employees: [
    row("emp1", "EMP-001", "Nguyễn Văn An", {
      department: "dept1",

      grade: "grade1",

      jobTitle: "Công nhân",
    }),
  ],

  machines: [
    row("mch1", "MCH-001", "Máy tiện CNC 01", {
      productionUnit: "area1",

      area: "area1",
    }),
  ],

  shifts: [
    row("shift1", "SHIFT-001", "Ca sáng", {
      start: "06:00",

      end: "14:00",

      overnight: false,

      breakMinutes: 30,
    }),

    row("shift2", "SHIFT-002", "Ca đêm", {
      start: "22:00",

      end: "06:00",

      overnight: true,

      breakMinutes: 30,
    }),
  ],

  stops: [
    row("stop1", "STOP-001", "Bảo trì định kỳ", {
      group: "Kế hoạch",

      countDowntime: true,
    }),
  ],

  productionOrders: [],

  workOrders: [],

  assignments: [],

  productionExecutions: [],

  routes: [],

  boms: [],
}

const listeners = new Set<() => void>()

// Preserve the units already used by the product catalogue, including older seeds.

for (const value of new Set(productMockData.map((product) => product.unit)))
  if (!data.units.some((unit) => [unit.name, unit.label].includes(value)))
    data.units.push(
      row(`unit-${value}`, value, value, { label: value, kind: "COUNT" }),
    )

const storageKey = "mes-linked-master-data-v1"

const persistedEntities = [
  "products",

  "units",

  "operations",

  "areas",

  "machines",

  "boms",

  "routes",

  "categories",

  "attributes",

  "productionUnits",

  "stations",

  "suppliers",

  "warehouses",

  "locations",

  "shifts",

  "stops",

  "productionOrders",

  "workOrders",

  "assignments",

  "productionExecutions",
]

export const isPersistentEntity = (entity: string) =>
  persistedEntities.includes(entity)

if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null")

    if (saved && [1, 2, 3].includes(saved.version))
      for (const entity of persistedEntities)
        if (
          Array.isArray(saved.data?.[entity]) &&
          saved.data[entity].every(
            (item: RecordData) => item && typeof item.id === "string",
          )
        )
          data[entity] = saved.data[entity]

    if (saved && saved.version < 3) {
      const legacy = JSON.parse(
        window.localStorage.getItem(`${storageKey}-legacy-bom-backup`) ||
          "null",
      )

      data = migrateProcessBom(data, legacy?.data)

      if (!window.localStorage.getItem(`${storageKey}-legacy-bom-backup`))
        window.localStorage.setItem(
          `${storageKey}-legacy-bom-backup`,

          JSON.stringify(saved),
        )
    }
  } catch {
    /* A missing or invalid browser cache uses the existing seeds. */
  }
}

// Migrate legacy area references without changing identifiers used by BOMs.

for (const machine of data.machines) machine.productionUnit ??= machine.area

for (const employee of data.employees)
  employee.productionUnitId ??= employee.department

data.areas = data.productionUnits

export const snapshot = () => data
let sharedMode = false

/** Replace a server-owned snapshot without writing browser cache. */
export function replaceSharedSnapshot(next: Record<string, RecordData[]>) {
  sharedMode = true
  data = { ...data, ...next }
  data.areas = data.productionUnits
  listeners.forEach((callback) => callback())
}

// Read commits made by other browser tabs without changing persisted data.

export function refreshMasterData() {
  if (sharedMode) return
  if (typeof window === "undefined") return

  const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null")

  if (!saved || saved.version !== 3) return

  const next = { ...data }

  let changed = false

  for (const entity of persistedEntities) {
    const rows = saved.data?.[entity]

    if (
      Array.isArray(rows) &&
      rows.every((item) => item && typeof item.id === "string") &&
      JSON.stringify(rows) !== JSON.stringify(data[entity])
    ) {
      next[entity] = rows
      changed = true
    }
  }

  if (changed) {
    next.areas = next.productionUnits
    commit(next, false)
  }
}

export function useMasterData() {
  return useSyncExternalStore((callback) => {
    listeners.add(callback)

    return () => listeners.delete(callback)
  }, snapshot)
}

export function updateRows(entity: string, rows: RecordData[]) {
  if (
    [
      "productionOrders",

      "workOrders",

      "assignments",

      "productionExecutions",
    ].includes(entity)
  )
    throw new Error(
      "Dữ liệu sản xuất phải cập nhật qua nghiệp vụ lệnh/phân công.",
    )

  if (entity === "machines")
    rows = rows.map((machine) => {
      const old = data.machines.find((row) => row.id === machine.id)

      const productionUnit =
        old &&
        machine.area !== old.area &&
        machine.productionUnit === old.productionUnit
          ? machine.area
          : machine.productionUnit

      return { ...machine, productionUnit, area: productionUnit }
    })

  if (entity === "stations")
    for (const station of rows) {
      const old = data.stations.find((row) => row.id === station.id)

      if (
        old &&
        old.productionUnit !== station.productionUnit &&
        productionState(data).workOrders.some(
          (work) => work.stationId === station.id,
        )
      )
        throw new Error(
          "Trạm đã được phân cho WO, không được chuyển đơn vị sản xuất.",
        )
    }

  const staged = { ...data, [entity]: rows }

  if (
    ["stations", "machines", "productionUnits", "suppliers"].includes(entity)
  ) {
    for (const record of rows) {
      if (
        JSON.stringify(record) ===
        JSON.stringify(data[entity]?.find((old) => old.id === record.id))
      )
        continue

      const issues = validateRecord(entity, record, staged)

      if (issues.length) throw new Error(issues.join("\n"))
    }
  }

  if (entity === "machines")
    rows = rows.map((machine) => ({ ...machine, area: machine.productionUnit }))

  if (persistedEntities.includes(entity))
    for (const previous of data[entity] ?? []) {
      const next = rows.find((item) => item.id === previous.id)

      if (!next && isReferenced(entity, previous.id))
        throw new Error("Bản ghi đang được tham chiếu, không thể xóa.")

      if (
        entity === "products" &&
        next &&
        next.unit !== previous.unit &&
        isReferenced(entity, previous.id)
      )
        throw new Error(
          "Sản phẩm đã được dùng trong BOM/quy trình, không thể đổi đơn vị tính.",
        )

      if (
        entity === "units" &&
        next &&
        (next.label !== previous.label || next.name !== previous.name) &&
        isReferenced(entity, previous.id)
      )
        throw new Error(
          "Đơn vị đang được dùng bởi sản phẩm, không thể đổi tên/nhãn.",
        )

      if (
        entity === "boms" &&
        next &&
        next.product !== previous.product &&
        (data.routes.some((route) => route.bom === previous.id) ||
          data.boms.some((bom) =>
            bomLines(bom).some((line) => line.bom === previous.id),
          ))
      )
        throw new Error(
          "BOM đã được tham chiếu, không được đổi sản phẩm đầu ra.",
        )

      if (
        entity === "routes" &&
        ["ACTIVE", "ARCHIVED"].includes(String(previous.lifecycle))
      ) {
        if (!next) throw new Error("Không xóa phiên bản đã áp dụng/lưu trữ.")

        const strip = (row: RecordData) => {
          const { lifecycle, archivedAt, ...rest } = row

          return JSON.stringify(rest)
        }

        if (
          strip(next) !== strip(previous) ||
          (next.lifecycle !== previous.lifecycle &&
            !(previous.lifecycle === "ACTIVE" && next.lifecycle === "ARCHIVED"))
        )
          throw new Error("Phiên bản đã áp dụng/lưu trữ được khóa sửa.")
      }

      if (
        ["boms", "routes", "operations"].includes(entity) &&
        next &&
        next.code !== previous.code
      )
        throw new Error("Không được chỉnh sửa mã hệ thống đã sinh.")

      if (
        ["boms", "routes"].includes(entity) &&
        next &&
        next.product !== previous.product &&
        productionReferenced(entity as "boms" | "routes", previous.id, data)
      )
        throw new Error(
          "Đã phát sinh dữ liệu sản xuất, không được đổi sản phẩm áp dụng.",
        )
    }

  if (["boms", "routes", "operations"].includes(entity)) {
    if (new Set(rows.map((row) => row.id)).size !== rows.length)
      throw new Error("Định danh bản ghi không được trùng.")

    const validator =
      entity === "boms"
        ? validateBom
        : entity === "routes"
          ? validateRoute
          : validateOperation

    for (const record of rows) {
      if (
        JSON.stringify(record) ===
        JSON.stringify(data[entity]?.find((old) => old.id === record.id))
      )
        continue

      if (
        entity === "routes" &&
        ["ACTIVE", "ARCHIVED"].includes(String(record.lifecycle))
      ) {
        const previous = data.routes.find((row) => row.id === record.id)

        if (
          previous &&
          ["ACTIVE", "ARCHIVED"].includes(String(previous.lifecycle))
        )
          continue

        if (!record.referenceSnapshot || !record.appliedAt)
          throw new Error("Áp dụng phiên bản bằng thao tác Áp dụng.")
      }

      const issues = validator(record, staged, data)

      if (issues.length) throw new Error(issues.join("\n"))
    }
  }

  // Active master configurations must remain usable when a source is disabled.

  if (
    entity === "operations" &&
    data.routes.some(
      (route) =>
        route.lifecycle === "DRAFT" &&
        active(route) &&
        routeSteps(route).some(
          (step) =>
            !active(rows.find((operation) => operation.id === step.operation)),
        ),
    )
  )
    throw new Error(
      "Công đoạn đang dùng trong quy trình Hoạt động. Hãy ngừng quy trình trước.",
    )

  if (entity === "products") {
    const used = new Set([
      ...data.boms

        .filter(active)

        .flatMap((bom) => [
          String(bom.product),

          ...bomLines(bom).map((line) => line.material),
        ]),

      ...data.routes.filter(active).map((route) => String(route.product)),
    ])

    const invalid = data.boms

      .filter(active)

      .flatMap((bom) => validateBom(bom, staged, data))

    if (invalid.length) throw new Error(invalid.join("\n"))

    if (rows.some((row) => used.has(row.id) && !active(row)))
      throw new Error(
        "Sản phẩm đang dùng trong BOM/quy trình Hoạt động. Hãy ngừng cấu hình trước.",
      )
  }

  const next = { ...data, [entity]: rows }

  if (entity === "productionUnits") next.areas = rows

  commit(next, persistedEntities.includes(entity))
  if (
    sharedMode &&
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    persistedEntities.includes(entity) &&
    ![
      "productionOrders",
      "workOrders",
      "assignments",
      "productionExecutions",
    ].includes(entity)
  )
    window.dispatchEvent(
      new CustomEvent("mes:catalog-change", { detail: { entity, rows } }),
    )
}

function commit(next: Record<string, RecordData[]>, persist = true) {
  if (persist && typeof window !== "undefined")
    window.localStorage.setItem(
      storageKey,

      JSON.stringify({
        version: 3,

        data: Object.fromEntries(
          persistedEntities.map((key) => [key, next[key]]),
        ),
      }),
    )

  data = next

  listeners.forEach((callback) => callback())
}

export function commitProduction(
  transform: (
    state: ProductionState,

    all: Record<string, RecordData[]>,
  ) => ProductionState,
) {
  const state = transform(structuredClone(productionState(data)), data)

  const next = {
    ...data,

    productionOrders: state.productionOrders as unknown as RecordData[],

    workOrders: state.workOrders as unknown as RecordData[],

    assignments: state.assignments as unknown as RecordData[],

    productionExecutions: state.productionExecutions as unknown as RecordData[],
  }

  const issues = validateProductionCommit(data, next)

  if (issues.length) throw new Error(issues.join("\n"))

  commit(next)
}

export function validateRecord(
  entity: string,

  record: RecordData,

  all = data,
): string[] {
  if (entity === "boms") return validateBom(record, all, data)

  if (entity === "routes") return validateRoute(record, all, data)

  if (entity === "operations") return validateOperation(record, all, data)

  const definition = definitions[entity]

  const errors: string[] = []

  for (const f of definition.fields) {
    if (f.kind === "computed") continue

    const value = record[f.key]

    if (
      entity === "attributes" &&
      f.key === "values" &&
      record.kind !== "Danh sách chọn"
    )
      continue

    if (f.required && (value == null || String(value).trim() === ""))
      errors.push(`${f.label} là bắt buộc.`)

    if (
      value != null &&
      value !== "" &&
      f.kind === "number" &&
      (!Number.isFinite(Number(value)) ||
        Number(value) < (f.min ?? 0) ||
        (["order", "breakMinutes"].includes(f.key) &&
          !Number.isInteger(Number(value))))
    )
      errors.push(`${f.label} không hợp lệ.`)

    if (
      f.kind === "select" &&
      value &&
      f.options &&
      !f.options.includes(String(value))
    )
      errors.push(`${f.label} không hợp lệ.`)

    if (
      f.ref &&
      f.kind !== "multi-select" &&
      value &&
      !all[f.ref]?.some(
        (item) =>
          item.id === value &&
          (item.status === "Hoạt động" ||
            data[entity]?.find((old) => old.id === record.id)?.[f.key] ===
              value),
      )
    )
      errors.push(`${f.label} không tồn tại hoặc đã ngừng hoạt động.`)

    if (
      f.kind === "date" &&
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ||
        Number.isNaN(Date.parse(String(value))) ||
        new Date(String(value)).toISOString().slice(0, 10) !== value)
    )
      errors.push(`${f.label} không hợp lệ.`)
  }

  if (
    (all[entity] ?? []).some(
      (item) =>
        item.id !== record.id &&
        record.code &&
        String(item.code).toLowerCase() === String(record.code).toLowerCase() &&
        (entity !== "locations" || item.warehouse === record.warehouse) &&
        (!["routes", "boms"].includes(entity) ||
          item.version === record.version),
    )
  )
    errors.push("Mã bản ghi / phiên bản đã tồn tại.")

  if (record.parent) {
    const seen = new Set([record.id])

    let parent = String(record.parent)

    while (parent) {
      if (seen.has(parent)) {
        errors.push("Danh mục cha tạo vòng lặp.")

        break
      }

      seen.add(parent)

      parent = String(
        all[entity]?.find((item) => item.id === parent)?.parent ?? "",
      )
    }

    if (
      entity === "locations" &&
      all.locations.find((item) => item.id === record.parent)?.warehouse !==
        record.warehouse
    )
      errors.push("Vị trí cha phải thuộc cùng kho.")
  }

  if (entity === "attributes") {
    const values = (record.values as string[] ?? []).map((value) =>
      value.trim(),
    )

    if (!String(record.kind ?? "")) errors.push("Loại là bắt buộc.")

    if (
      record.kind === "Danh sách chọn" &&
      (!values.length ||
        values.some((value) => !value) ||
        new Set(values.map((value) => value.toLowerCase())).size !==
          values.length)
    )
      errors.push("Danh sách chọn cần giá trị không rỗng, không trùng.")

    if (
      all.attributes.some(
        (item) =>
          item.id !== record.id &&
          String(item.name).toLowerCase() ===
            String(record.name).trim().toLowerCase(),
      )
    )
      errors.push("Tên thuộc tính đã tồn tại.")
  }

  if (entity === "shifts") {
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(record.start)) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(record.end)) ||
      record.start === record.end
    )
      errors.push("Giờ bắt đầu và kết thúc phải hợp lệ và khác nhau.")
    else {
      const minutes = (value: ValueLike) =>
        String(value)

          .split(":")

          .reduce((hours, part) => hours * 60 + Number(part), 0)

      const duration =
        (minutes(record.end) - minutes(record.start) + 1440) % 1440

      if (Number(record.breakMinutes ?? 0) >= duration)
        errors.push("Thời gian nghỉ phải nhỏ hơn thời lượng ca.")
    }
  }

  if (definition.details) {
    const details = record.details as Record<string, unknown>[] ?? []

    if (!details.length)
      errors.push(
        `Cần ít nhất một dòng ${definition.detailLabel?.toLowerCase()}.`,
      )

    const unique = entity === "routes" ? "order" : "material"

    if (new Set(details.map((item) => item[unique])).size !== details.length)
      errors.push("Dòng chi tiết bị trùng.")

    for (const [index, detail] of details.entries())
      for (const f of definition.details) {
        const value = detail[f.key]

        if (f.required && (value == null || value === ""))
          errors.push(`Dòng ${index + 1}: ${f.label} là bắt buộc.`)

        if (
          f.kind === "number" &&
          value != null &&
          value !== "" &&
          (!Number.isFinite(Number(value)) ||
            Number(value) < (f.min ?? 0) ||
            (f.key === "order" && !Number.isInteger(Number(value))) ||
            (f.key === "waste" && Number(value) > 100))
        )
          errors.push(`Dòng ${index + 1}: ${f.label} không hợp lệ.`)

        if (
          f.ref &&
          value &&
          !all[f.ref]?.some(
            (item) => item.id === value && item.status === "Hoạt động",
          )
        )
          errors.push(
            `Dòng ${index + 1}: ${f.label} không hợp lệ hoặc đã ngừng hoạt động.`,
          )

        if (
          entity === "boms" &&
          f.key === "material" &&
          value === record.product
        )
          errors.push("Vật tư không được trùng sản phẩm đầu ra.")
      }

    if (entity === "boms") {
      const boms = [...all.boms.filter((item) => item.id !== record.id), record]

      const visit = (product: string, path: Set<string>): boolean => {
        if (path.has(product)) return true

        const next = new Set(path).add(product)

        return boms

          .filter((item) => item.product === product)

          .some((item) =>
            ((item.details ?? []) as Record<string, unknown>[]).some((detail) =>
              visit(String(detail.material), next),
            ),
          )
      }

      if (visit(String(record.product), new Set()))
        errors.push("Định mức vật tư tạo vòng lặp.")
    }
  }

  return [
    ...new Set([...errors, ...validateLinkedRecord(entity, record, all, data)]),
  ]
}

type ValueLike = unknown

export function isReferenced(entity: string, id: string) {
  const state = productionState(data)

  if (
    entity === "stops" &&
    state.productionExecutions.some((row) => row.reasonId === id)
  )
    return true

  if (
    entity === "machines" &&
    state.productionExecutions.some((row) => row.machineId === id)
  )
    return true

  if (
    entity === "products" &&
    state.productionOrders.some((order) => order.productId === id)
  )
    return true

  if (
    entity === "stations" &&
    state.workOrders.some((work) => work.stationId === id)
  )
    return true

  if (
    entity === "employees" &&
    state.assignments.some((row) => row.employeeId === id)
  )
    return true

  if (
    entity === "shifts" &&
    state.assignments.some((row) => row.shiftId === id)
  )
    return true

  if (
    entity === "productionUnits" &&
    state.productionOrders.some((order) =>
      order.sourceSnapshot?.steps.some((step) =>
        step.allowedUnitIds.includes(id),
      ),
    )
  )
    return true

  if (
    entity === "operations" &&
    state.productionOrders.some((order) =>
      order.sourceSnapshot?.steps.some((step) => step.operationId === id),
    )
  )
    return true

  if (
    entity === "boms" &&
    (data.routes.some((route) => route.bom === id) ||
      data.boms.some((bom) => bomLines(bom).some((line) => line.bom === id)))
  )
    return true

  if (
    entity === "routes" &&
    data.routes.some((route) => route.parentVersionId === id)
  )
    return true

  if (entity === "productionUnits" && isReferenced("areas", id)) return true

  if (
    (entity === "boms" || entity === "routes") &&
    productionReferenced(entity, id, data)
  )
    return true

  if (
    entity === "products" &&
    data.routes.some((route) => route.product === id)
  )
    return true

  if (entity === "units") {
    const unit = data.units.find((item) => item.id === id)

    if (
      unit &&
      data.products.some((product) =>
        [unit.name, unit.label].some(
          (value) =>
            String(value).toLowerCase() === String(product.unit).toLowerCase(),
        ),
      )
    )
      return true
  }

  if (
    entity === "suppliers" &&
    data.products.some((record) => record.supplier === id)
  )
    return true

  if (
    entity === "categories" &&
    data.products.some((record) => record.catalog === id)
  )
    return true

  if (
    entity === "attributes" &&
    data.products.some((record) =>
      (record.attributes as (string | { attributeName: string })[] ?? []).some(
        (value) =>
          (typeof value === "string" ? value : value.attributeName) ===
          String(data.attributes.find((item) => item.id === id)?.name),
      ),
    )
  )
    return true

  if (
    entity === "products" &&
    data.boms.some((record) => record.product === id)
  )
    return true

  return Object.entries(definitions).some(([source, definition]) =>
    (data[source] ?? []).some(
      (record) =>
        definition.fields.some(
          (f) =>
            f.ref === entity &&
            (record[f.key] === id ||
              (f.kind === "multi-select" && ids(record[f.key]).includes(id))),
        ) ||
        definition.details?.some(
          (f) =>
            f.ref === entity &&
            ((record.details ?? []) as Record<string, unknown>[]).some(
              (detail) => detail[f.key] === id,
            ),
        ),
    ),
  )
}
