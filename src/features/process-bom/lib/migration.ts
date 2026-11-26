import type { RecordData } from "../../master-data/config"

import {
  active,
  bomLines,
  orderedSteps,
  operationUnitIds,
  text,
  type Catalog,
} from "./model"

export function migrateProcessBom(all: Catalog, backup?: Catalog): Catalog {
  const operations = all.operations.map((row) => ({
    ...row,

    productionUnitIds: Array.isArray(row.productionUnitIds)
      ? row.productionUnitIds
      : all.productionUnits.some((unit) => unit.id === row.area)
        ? [text(row.area)]
        : [],
  }))

  const boms: RecordData[] = all.boms.map((row) => {
    const legacy = backup?.boms?.find((old) => old.id === row.id)

    return {
      ...row,

      details: bomLines(row).map((line) => {
        const old = bomLines(legacy).find(
          (item) => item.material === line.material,
        )

        return {
          ...line,

          waste: Number(line.waste ?? old?.waste ?? 0),

          bom: text(line.bom ?? old?.bom),
        }
      }),
    }
  })

  const codes = new Map<string, Set<string>>(),
    drafts = new Set<string>(),
    applied = new Set<string>()

  const routes = all.routes.map((row) => {
    const legacy = backup?.routes?.find((old) => old.id === row.id),
      candidates = boms.filter(
        (bom) => bom.product === row.product && active(bom),
      ),
      bom =
        boms.find((bom) => bom.id === (row.bom || legacy?.bom)) ||
        (candidates.length === 1 ? candidates[0] : undefined)

    const code = text(legacy?.code || row.code),
      versions = codes.get(code) || new Set<string>()

    let version = text(row.version || legacy?.version || "1.0")

    if (!/^\d+\.\d+$/.test(version))
      version = `${Math.floor(Number.parseFloat(version) || 1)}.0`

    while (versions.has(version))
      version = `${Math.floor(Number.parseFloat(version) || 1) + 1}.0`

    versions.add(version)

    codes.set(code, versions)

    let lifecycle = text(row.lifecycle || "DRAFT")

    if (lifecycle === "DRAFT") {
      if (drafts.has(code)) lifecycle = "ARCHIVED"
      else drafts.add(code)
    }

    if (lifecycle === "ACTIVE") {
      if (applied.has(code)) lifecycle = "ARCHIVED"
      else applied.add(code)
    }

    const steps = orderedSteps(row),
      operation = text(row.operation || steps[0]?.operation),
      primary = operations.find((item) => item.id === operation),
      unit = text(
        row.productionUnit ||
          (operationUnitIds(primary).includes(text(row.area))
            ? row.area
            : operationUnitIds(primary)[0]),
      )

    const product = text(bom?.product || row.product),
      quantity = Number(row.quantity || bom?.quantity || 1)

    const result: RecordData = {
      ...row,

      code,

      version,

      lifecycle,

      bom: bom?.id || "",

      product,

      quantity,

      operation,

      productionUnit: unit,

      materials: Array.isArray(row.materials)
        ? row.materials
        : bomLines(bom).map((line) => line.material),

      details: steps,

      changeNote: row.changeNote || "Chuyển dữ liệu từ cấu trúc trước",
    }

    if (
      ["ACTIVE", "ARCHIVED"].includes(lifecycle) &&
      !result.referenceSnapshot
    ) {
      result.referenceSnapshot = structuredClone({
        boms,

        products: all.products,

        operations,

        productionUnits: all.productionUnits,
      })

      result.appliedAt = row.effectiveDate || legacy?.effectiveDate || ""
    }

    return result
  })

  return { ...all, operations, boms, routes }
}
