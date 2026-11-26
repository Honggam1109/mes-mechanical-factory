import {
  unitKinds,
  type Unit,
  type UnitFilters,
  type UnitValues,
} from "../types/unit"

export function filterUnits(rows: Unit[], filters: UnitFilters) {
  return rows.filter(
    (row) =>
      (!filters.name ||
        row.name

          .toLocaleLowerCase("vi")

          .includes(filters.name.trim().toLocaleLowerCase("vi"))) &&
      (!filters.label ||
        row.label

          .toLocaleLowerCase("vi")

          .includes(filters.label.trim().toLocaleLowerCase("vi"))) &&
      (!filters.kind || row.kind === filters.kind) &&
      (!filters.status || row.status === filters.status),
  )
}

export function saveUnit(
  rows: Unit[],

  values: UnitValues,

  id?: string,
): Unit[] {
  const next = {
    ...values,

    name: values.name.trim(),

    label: values.label.trim(),

    description: values.description.trim(),

    id: id || crypto.randomUUID(),
  }

  if (!next.name) throw new Error("Vui lòng nhập tên đơn vị.")

  if (!unitKinds.some((kind) => kind.value === next.kind))
    throw new Error("Vui lòng chọn loại đơn vị hợp lệ.")

  if (!["ACTIVE", "INACTIVE"].includes(next.status))
    throw new Error("Trạng thái không hợp lệ.")

  if (
    rows.some(
      (row) =>
        row.id !== id &&
        row.name.toLocaleLowerCase("vi") === next.name.toLocaleLowerCase("vi"),
    )
  )
    throw new Error("Tên đơn vị đã tồn tại.")

  if (id && !rows.some((row) => row.id === id))
    throw new Error("Đơn vị tính không còn tồn tại. Vui lòng tải lại.")

  return id ? rows.map((row) => (row.id === id ? next : row)) : [next, ...rows]
}

export function importUnits(rows: Unit[], values: UnitValues[]): Unit[] {
  return values.reduce((next, value) => saveUnit(next, value), rows)
}
