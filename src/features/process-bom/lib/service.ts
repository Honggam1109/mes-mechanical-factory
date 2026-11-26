import { snapshot, updateRows } from "../../master-data/store"

import type { RecordData } from "../../master-data/config"

import {
  bomLines,
  orderedSteps,
  nextCode,
  text,
  validateBom,
  validateRoute,
  bomClosure,
  routeSteps,
  type Catalog,
} from "./model"

export type ConfigurationKind = "boms" | "routes"

export function configurationRecord(
  kind: ConfigurationKind,

  values: RecordData,

  all: Catalog,

  old?: RecordData,
): RecordData {
  const common = {
    id: old?.id || values.id || crypto.randomUUID(),

    code:
      old?.code ||
      values.code ||
      nextCode(all[kind], kind === "boms" ? "BOM" : "PROCESS"),

    product: text(
      kind === "routes"
        ? all.boms.find((bom) => bom.id === values.bom)?.product
        : values.product,
    ),

    status: text(values.status || "Hoạt động"),

    description: text(values.description).trim(),
  }

  return kind === "boms"
    ? {
        ...common,

        quantity: Number(values.quantity),

        details: bomLines(values).map((line) => ({
          material: text(line.material),

          quantity: Number(line.quantity),

          note: text(line.note).trim(),

          waste: Number(line.waste || 0),

          bom: text(line.bom),
        })),
      }
    : {
        ...common,

        name: text(values.name).trim(),

        bom: text(values.bom),

        quantity: Number(
          values.quantity ||
            all.boms.find((bom) => bom.id === values.bom)?.quantity ||
            1,
        ),

        unit: text(
          all.products.find(
            (product) =>
              product.id ===
              all.boms.find((bom) => bom.id === values.bom)?.product,
          )?.unit,
        ),

        version: text(old?.version || values.version || "1.0"),

        lifecycle: text(old?.lifecycle || values.lifecycle || "DRAFT"),

        operation: text(values.operation || orderedSteps(values)[0]?.operation),

        productionUnit: text(values.productionUnit),

        materials: Array.isArray(values.materials)
          ? values.materials.map(String)
          : bomLines(all.boms.find((bom) => bom.id === values.bom)).map(
              (line) => line.material,
            ),

        changeNote: text(values.changeNote).trim(),

        parentVersionId: text(old?.parentVersionId || values.parentVersionId),

        details: orderedSteps(values).map((step) => ({
          stepId: text(step.stepId) || crypto.randomUUID(),

          order: Number(step.order),

          operation: text(step.operation),

          note: text(step.note).trim(),
        })),
      }
}

export function saveConfiguration(
  kind: ConfigurationKind,

  values: RecordData,

  id?: string,
) {
  const all = snapshot(),
    old = all[kind].find((row) => row.id === id)

  if (id && !old) throw new Error("Không tìm thấy bản ghi cần sửa.")

  if (kind === "routes" && old && old.lifecycle !== "DRAFT")
    throw new Error(
      "Phiên bản đã áp dụng/lưu trữ được khóa sửa. Hãy tạo phiên bản mới.",
    )

  const record = configurationRecord(
    kind,

    {
      ...values,

      lifecycle: "DRAFT",

      id: id || crypto.randomUUID(),

      code:
        old?.code || nextCode(all[kind], kind === "boms" ? "BOM" : "PROCESS"),
    },

    all,

    old,
  )

  const errors = (kind === "boms" ? validateBom : validateRoute)(record, all)

  if (errors.length) throw new Error(errors.join("\n"))

  updateRows(
    kind,

    old
      ? all[kind].map((row) => (row.id === id ? record : row))
      : [record, ...all[kind]],
  )

  return record
}

export const saveBom = (values: RecordData, id?: string) =>
  saveConfiguration("boms", values, id)

export const saveRoute = (values: RecordData, id?: string) =>
  saveConfiguration("routes", values, id)

export function importConfigurations(
  kind: ConfigurationKind,

  values: RecordData[],
) {
  if (!values.length) throw new Error("File không có dữ liệu.")

  const all = snapshot(),
    records = values.map((value) =>
      configurationRecord(
        kind,
        { ...value, id: crypto.randomUUID(), lifecycle: "DRAFT" },
        all,
      ),
    ),
    staged = { ...all, [kind]: [...all[kind], ...records] }

  const errors = records.flatMap((record, index) =>
    (kind === "boms" ? validateBom : validateRoute)(record, staged, all).map(
      (error) => `Dòng ${index + 2}: ${error}`,
    ),
  )

  if (errors.length) throw new Error(errors.join("\n"))

  updateRows(kind, [...records, ...all[kind]])
}

export function newRouteVersion(id: string) {
  const all = snapshot(),
    old = all.routes.find((row) => row.id === id)

  if (!old) throw new Error("Không tìm thấy quy trình.")

  if (
    all.routes.some((row) => row.code === old.code && row.lifecycle === "DRAFT")
  )
    throw new Error("Quy trình đã có bản nháp. Hãy hoàn thiện bản nháp trước.")

  const version =
    Math.max(
      ...all.routes
        .filter((row) => row.code === old.code)
        .map((row) => Number.parseFloat(text(row.version)) || 1),
    ) + 1

  const { referenceSnapshot, appliedAt, archivedAt, ...source } =
    structuredClone(old)

  const record = {
    ...source,
    id: crypto.randomUUID(),
    version: `${version}.0`,
    lifecycle: "DRAFT",
    parentVersionId: old.id,
    changeNote: `Tạo từ V${old.version}`,
  }

  updateRows("routes", [record, ...all.routes])

  return record
}

export function transitionRoute(id: string, action: "APPLY" | "ARCHIVE") {
  const all = snapshot(),
    record = all.routes.find((row) => row.id === id)

  if (!record) throw new Error("Không tìm thấy phiên bản.")

  if (action === "ARCHIVE") {
    if (record.lifecycle !== "ACTIVE")
      throw new Error("Chỉ lưu trữ phiên bản đang áp dụng.")

    updateRows(
      "routes",
      all.routes.map((row) =>
        row.id === id
          ? {
              ...row,
              lifecycle: "ARCHIVED",
              archivedAt: new Date().toISOString(),
            }
          : row,
      ),
    )

    return
  }

  if (record.lifecycle !== "DRAFT") throw new Error("Chỉ áp dụng bản nháp.")

  const errors = validateRoute(record, all)

  for (const bom of bomClosure(text(record.bom), all))
    errors.push(...validateBom(bom, all))

  if (record.status !== "Hoạt động")
    errors.push("Chỉ áp dụng quy trình đang sử dụng.")

  if (errors.length) throw new Error([...new Set(errors)].join("\n"))

  const boms = bomClosure(text(record.bom), all),
    products = new Set(
      boms.flatMap((bom) => [
        text(bom.product),
        ...bomLines(bom).map((line) => line.material),
      ]),
    ),
    operations = new Set(routeSteps(record).map((step) => step.operation))

  const referenceSnapshot = structuredClone({
    boms,
    products: all.products.filter((row) => products.has(row.id)),
    operations: all.operations.filter((row) => operations.has(row.id)),
    productionUnits: all.productionUnits,
  })

  updateRows(
    "routes",
    all.routes.map((row) =>
      row.id === id
        ? {
            ...row,
            lifecycle: "ACTIVE",
            appliedAt: new Date().toISOString(),
            referenceSnapshot,
          }
        : row.code === record.code && row.lifecycle === "ACTIVE"
          ? {
              ...row,
              lifecycle: "ARCHIVED",
              archivedAt: new Date().toISOString(),
            }
          : row,
    ),
  )
}
