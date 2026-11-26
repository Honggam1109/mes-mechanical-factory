import type { RecordData } from "./config"

type Catalog = Record<string, RecordData[]>

const normalize = (value: unknown) =>
  String(value ?? "")

    .trim()

    .toLocaleLowerCase("vi")

export const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : value ? [String(value)] : []

export function statusLabel(entity: string, status: unknown) {
  const active = status === "Hoạt động" || status === "ACTIVE"

  return entity === "employees"
    ? active
      ? "Đang làm việc"
      : "Ngừng làm việc"
    : entity === "units"
      ? active
        ? "Sử dụng"
        : "Ngừng sử dụng"
      : active
        ? "Hoạt động"
        : "Ngừng hoạt động"
}

export function validateLinkedRecord(
  entity: string,

  record: RecordData,

  all: Catalog,

  previous: Catalog = all,
): string[] {
  const errors: string[] = [],
    rows = all[entity] || [],
    old = previous[entity]?.find((row) => row.id === record.id)

  const duplicate = (
    key: string,

    within: (row: RecordData) => boolean = () => true,
  ) =>
    rows.some(
      (row) =>
        row.id !== record.id &&
        normalize(row[key]) === normalize(record[key]) &&
        within(row),
    )

  if (
    ["attributes", "units", "shifts", "warehouses"].includes(entity) &&
    duplicate("name")
  )
    errors.push("Tên đã tồn tại.")

  if (
    entity === "categories" &&
    duplicate(
      "name",

      (row) => normalize(row.parent) === normalize(record.parent),
    )
  )
    errors.push("Tên danh mục đã tồn tại trong cùng danh mục cha.")

  if (
    entity === "locations" &&
    duplicate(
      "name",

      (row) =>
        row.warehouse === record.warehouse &&
        normalize(row.parent) === normalize(record.parent),
    )
  )
    errors.push("Tên vị trí đã tồn tại trong cùng kho và vị trí cha.")

  if (
    entity === "units" &&
    record.label &&
    duplicate("label", (row) => row.kind === record.kind)
  )
    errors.push("Nhãn đơn vị đã tồn tại trong cùng loại đơn vị.")

  if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.email)))
    errors.push("Email không hợp lệ.")

  if (entity === "suppliers" && record.taxCode && duplicate("taxCode"))
    errors.push("Mã số thuế đã tồn tại.")

  if (entity === "stations") {
    const machineIds = ids(record.machineIds),
      previous = ids(old?.machineIds)

    if (!machineIds.length)
      errors.push("Vui lòng chọn ít nhất một máy cho trạm.")

    if (new Set(machineIds).size !== machineIds.length)
      errors.push("Danh sách máy không được trùng.")

    if (
      duplicate("name", (row) => row.productionUnit === record.productionUnit)
    )
      errors.push("Tên trạm đã tồn tại trong cùng đơn vị sản xuất.")

    for (const id of machineIds) {
      const machine = all.machines.find((row) => row.id === id)

      if (!machine || machine.productionUnit !== record.productionUnit)
        errors.push("Máy phải thuộc cùng đơn vị sản xuất với trạm.")

      if (
        machine?.status !== "Hoạt động" &&
        (!previous.includes(id) ||
          (old?.status !== "Hoạt động" && record.status === "Hoạt động"))
      )
        errors.push("Không được chọn máy đã ngừng hoạt động.")

      if (
        record.status === "Hoạt động" &&
        rows.some(
          (row) =>
            row.id !== record.id &&
            row.status === "Hoạt động" &&
            ids(row.machineIds).includes(id),
        )
      )
        errors.push(
          `Máy ${machine?.name || id} đã thuộc một trạm đang hoạt động.`,
        )
    }
  }

  if (
    entity === "machines" &&
    old?.productionUnit !== record.productionUnit &&
    (all.stations || []).some(
      (station) =>
        ids(station.machineIds).includes(record.id) &&
        station.productionUnit !== record.productionUnit,
    )
  )
    errors.push("Hãy gỡ máy khỏi các trạm trước khi chuyển đơn vị sản xuất.")

  if (entity === "locations") {
    if (
      rows.some(
        (row) =>
          row.id !== record.id &&
          normalize(row.code) === normalize(record.code),
      )
    )
      errors.push("Mã vị trí đã tồn tại.")

    if (
      old?.warehouse !== record.warehouse &&
      rows.some(
        (row) => row.parent === record.id && row.warehouse !== record.warehouse,
      )
    )
      errors.push("Không thể đổi kho khi các vị trí con vẫn thuộc kho cũ.")
  }

  const assignments = (all.assignments || []).filter(
    (row) =>
      ![
        "COMPLETED",

        "CANCELLED",

        "completed",

        "cancelled",

        "Hoàn thành",

        "Đã hủy",
      ].includes(String(row.status)) &&
      !(all.productionExecutions || []).some(
        (event) =>
          event.workOrderId === row.workOrderId && event.kind === "COMPLETE",
      ),
  )

  if (
    entity === "employees" &&
    old &&
    old.productionUnitId !== record.productionUnitId &&
    assignments.some(
      (row) => row.employeeId === record.id || row.employee === record.id,
    )
  )
    errors.push(
      "Nhân viên còn phân công hiệu lực, không thể chuyển đơn vị sản xuất.",
    )

  return errors
}

export function validateProductReferences(
  record: RecordData,

  all: Catalog,
): string[] {
  const errors: string[] = [],
    old = all.products.find((row) => row.id === record.id),
    unit = all.units.find(
      (row) =>
        row.id === record.unitId || [row.name, row.label].includes(record.unit),
    )

  if (!String(record.name || "").trim())
    errors.push("Vui lòng nhập tên sản phẩm.")

  if (
    ![
      "Thành phẩm",

      "Bán thành phẩm",

      "Linh kiện / Vật tư",

      "Linh kiện/Vật tư",
    ].includes(String(record.category))
  )
    errors.push("Vui lòng chọn phân loại sản phẩm hợp lệ.")

  if (
    !unit ||
    (unit.status !== "Hoạt động" &&
      (!old || (old.unitId !== unit.id && old.unit !== record.unit)))
  )
    errors.push("Vui lòng chọn đơn vị tính đang sử dụng.")

  for (const [field, source, label] of [
    ["catalog", "categories", "Danh mục sản phẩm"],

    ["supplier", "suppliers", "Nhà cung cấp"],
  ] as const)
    if (
      record[field] &&
      !(all[source] || []).some(
        (row) =>
          row.id === record[field] &&
          (row.status === "Hoạt động" || old?.[field] === row.id),
      )
    )
      errors.push(`${label} không tồn tại hoặc đã ngừng hoạt động.`)

  if (
    record.price !== "" &&
    record.price !== undefined &&
    (!Number.isFinite(Number(record.price)) || Number(record.price) < 0)
  )
    errors.push("Giá cả không được âm.")

  const attributes = (record.attributes || []) as Record<string, unknown>[]

  if (
    new Set(attributes.map((attribute) => normalize(attribute.attributeName)))
      .size !== attributes.length
  )
    errors.push("Không được khai báo cùng thuộc tính nhiều lần.")

  for (const attribute of attributes) {
    const definition = all.attributes.find(
        (row) => row.name === attribute.attributeName,
      ),
      previous = ((old?.attributes || []) as Record<string, unknown>[]).find(
        (row) => row.attributeName === attribute.attributeName,
      )

    if (!definition || (definition.status !== "Hoạt động" && !previous))
      errors.push("Thuộc tính không tồn tại hoặc đã ngừng hoạt động.")
    else if (
      definition.kind === "Danh sách chọn" &&
      !ids(definition.values).includes(String(attribute.attributeValue))
    )
      errors.push(
        `Giá trị thuộc tính ${definition.name} không thuộc danh sách đã cấu hình.`,
      )
  }

  return errors
}
