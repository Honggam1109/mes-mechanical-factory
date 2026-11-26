export type Value = Record<string, unknown> | string | number | boolean | string[] | Record<string, unknown>[]

export interface RecordData {
  id: string

  [key: string]: Value
}

export type Field = {
  key: string

  label: string

  kind?: "select" | "multi-select" | "computed" | "number" | "boolean" | "time" | "date" | "textarea" | "tags"

  required?: boolean

  options?: string[]

  ref?: string

  min?: number
}

export type Definition = {
  title: string

  prefix: string

  fields: Field[]

  filters: string[]

  columns: string[]

  details?: Field[]

  detailLabel?: string
}

const field = (
  key: string,

  label: string,

  extra: Partial<Field> = {},
): Field => ({ key, label, ...extra })

const code = field("code", "Mã", { required: true })

const name = field("name", "Tên", { required: true })

const status = field("status", "Trạng thái", {
  kind: "select",

  options: ["Hoạt động", "Không hoạt động"],

  required: true,
})

const description = field("description", "Mô tả", { kind: "textarea" })

const ref = (key: string, label: string, source: string, required = false) =>
  field(key, label, { kind: "select", ref: source, required })

const select = (key: string, label: string, options: string[]) =>
  field(key, label, { kind: "select", options })

const number = (key: string, label: string, min = 0) =>
  field(key, label, { kind: "number", min })

const standard = (
  title: string,

  prefix: string,

  extras: Field[],

  filters: string[],

  columns: string[],
): Definition => ({
  title,

  prefix,

  fields: [code, name, ...extras, status, description],

  filters,

  columns,
})

export const definitions: Record<string, Definition> = {
  units: {
    title: "Đơn vị tính",

    prefix: "UNIT",

    fields: [
      name,

      field("label", "Nhãn đơn vị"),

      select("kind", "Loại đơn vị", [
        "COUNT",

        "MASS",

        "LENGTH",

        "AREA",

        "VOLUME",

        "TIME",
      ]),

      status,

      description,
    ],

    filters: ["name", "label", "kind"],

    columns: ["name", "label", "kind", "status"],
  },

  categories: standard(
    "Danh mục sản phẩm",

    "CAT",

    [ref("parent", "Danh mục cha", "categories")],

    ["code", "name", "status"],

    ["code", "name", "parent", "status"],
  ),

  attributes: {
    title: "Thuộc tính",

    prefix: "ATT",

    fields: [
      name,

      select("kind", "Loại", ["Nhập giá trị", "Danh sách chọn"]),

      field("values", "Giá trị", { kind: "tags" }),
    ],

    filters: ["name"],

    columns: ["name"],
  },

  areas: standard(
    "Mặt bằng sản xuất",

    "AREA",

    [
      select("kind", "Loại", ["Xưởng", "Khu vực", "Dây chuyền"]),

      ref("parent", "Khu vực cha", "areas"),

      ref("inputWarehouse", "Kho NVL đầu vào", "warehouses"),

      ref("outputWarehouse", "Kho sản phẩm đầu ra", "warehouses"),
    ],

    ["code", "name", "status"],

    ["code", "name", "parent", "status"],
  ),

  operations: standard(
    "Công đoạn",

    "OP",

    [
      field("productionUnitIds", "Đơn vị sản xuất có thể thực hiện", {
        kind: "multi-select",

        ref: "productionUnits",

        required: true,
      }),
    ],

    ["code", "name", "productionUnitIds", "status"],

    ["code", "name", "productionUnitIds", "description", "status"],
  ),

  boms: {
    title: "Định mức BOM",

    prefix: "BOM",

    fields: [
      code,

      ref("product", "Sản phẩm", "products", true),

      field("quantity", "Số lượng cơ sở", {
        kind: "number",

        min: 0.000001,

        required: true,
      }),

      status,

      description,
    ],

    filters: ["code", "product", "status"],

    columns: ["code", "product", "quantity", "status"],

    detailLabel: "Thành phần",

    details: [
      ref("material", "Thành phần", "products", true),

      field("quantity", "Số lượng định mức", {
        kind: "number",

        min: 0.000001,

        required: true,
      }),

      field("note", "Ghi chú"),
    ],
  },

  routes: {
    ...standard(
      "Quy trình công nghệ",

      "PROCESS",

      [ref("product", "Sản phẩm", "products", true)],

      ["code", "name", "product", "status"],

      ["code", "name", "product", "status"],
    ),

    detailLabel: "Công đoạn",

    details: [
      field("order", "Thứ tự", { kind: "number", min: 1, required: true }),

      ref("operation", "Công đoạn", "operations", true),

      field("note", "Ghi chú"),
    ],
  },

  shifts: standard(
    "Ca sản xuất",

    "SHIFT",

    [
      field("start", "Giờ bắt đầu", { kind: "time", required: true }),

      field("end", "Giờ kết thúc", { kind: "time", required: true }),

      field("overnight", "Qua ngày", { kind: "boolean" }),

      number("breakMinutes", "Thời gian nghỉ (phút)"),
    ],

    ["code", "name", "status"],

    ["code", "name", "start", "end", "overnight", "status"],
  ),

  warehouses: standard(
    "Kho hàng",

    "WH",

    [
      select("kind", "Loại kho", [
        "Nguyên vật liệu",

        "Bán thành phẩm",

        "Thành phẩm",

        "Khác",
      ]),

      ref("department", "Bộ phận quản lý", "departments"),

      ref("manager", "Người phụ trách", "employees"),

      field("location", "Địa điểm"),
    ],

    ["code", "name", "kind", "status"],

    ["code", "name", "kind", "department", "status"],
  ),

  locations: standard(
    "Vị trí",

    "LOC",

    [
      ref("warehouse", "Kho hàng", "warehouses", true),

      select("kind", "Loại vị trí", ["Khu vực", "Kệ", "Ô"]),

      ref("parent", "Vị trí cha", "locations"),
    ],

    ["warehouse", "code", "name", "status"],

    ["code", "name", "warehouse", "kind", "status"],
  ),

  employees: standard(
    "Nhân viên",

    "EMP",

    [
      ref("department", "Phòng ban", "departments", true),

      ref("grade", "Bậc thợ", "grades"),

      field("jobTitle", "Chức danh"),

      field("joinedDate", "Ngày vào làm", { kind: "date" }),

      field("contact", "Thông tin liên hệ"),

      field("email", "Email"),

      field("phone", "Số điện thoại"),

      field("productionTeamId", "Mã tổ sản xuất"),

      field("productionTeamName", "Tên tổ sản xuất"),
    ],

    ["code", "name", "department", "status"],

    ["code", "name", "department", "grade", "status"],
  ),

  departments: standard(
    "Phòng ban",

    "DEPT",

    [
      ref("parent", "Phòng ban cha", "departments"),

      ref("manager", "Trưởng bộ phận", "employees"),
    ],

    ["code", "name", "status"],

    ["code", "name", "parent", "manager", "status"],
  ),

  grades: standard(
    "Bậc thợ",

    "GRADE",

    [number("order", "Thứ tự cấp bậc", 1)],

    ["code", "name", "status"],

    ["code", "name", "order", "status"],
  ),

  machines: standard(
    "Danh sách máy móc",

    "MCH",

    [
      select("kind", "Loại đối tượng", ["Máy", "Trạm"]),

      field("group", "Nhóm máy"),

      ref("area", "Mặt bằng / khu vực", "areas", true),

      field("manufacturerCode", "Mã thiết bị nhà sản xuất"),
    ],

    ["code", "name", "kind", "area", "status"],

    ["code", "name", "kind", "area", "status"],
  ),

  stops: standard(
    "Nguyên nhân dừng",

    "STOP",

    [
      select("group", "Nhóm nguyên nhân", ["Kế hoạch", "Ngoài kế hoạch"]),

      field("countDowntime", "Có tính vào thời gian dừng", { kind: "boolean" }),
    ],

    ["code", "name", "group", "status"],

    ["code", "name", "group", "status"],
  ),
}

// Apply the current master-data specification while retaining legacy keys/URLs.

definitions.attributes.fields.push(status)

definitions.attributes.filters = ["name", "kind", "status"]

definitions.attributes.columns = ["name", "kind", "status"]

definitions.categories.columns = [
  "code",

  "name",

  "parent",

  "description",

  "status",
]

definitions.suppliers = standard(
  "Nhà cung cấp",

  "SUP",

  [
    field("taxCode", "Mã số thuế"),

    field("contactName", "Người liên hệ"),

    field("phone", "Số điện thoại"),

    field("email", "Email"),

    field("address", "Địa chỉ", { kind: "textarea" }),
  ],

  ["code", "name", "taxCode", "phone", "status"],

  ["code", "name", "taxCode", "contactName", "phone", "status"],
)

definitions.productionUnits = standard(
  "Đơn vị sản xuất",

  "PU",

  [
    ref("parent", "Đơn vị cha", "productionUnits"),

    ref("manager", "Người phụ trách", "employees"),

    field("employeeCount", "Số nhân viên", { kind: "computed" }),

    field("stationCount", "Số trạm", { kind: "computed" }),
  ],

  ["code", "name", "parent", "status"],

  ["code", "name", "parent", "employeeCount", "stationCount", "status"],
)

definitions.machines = standard(
  "Máy móc",

  "MCH",

  [
    field("group", "Nhóm máy"),

    ref("productionUnit", "Đơn vị sản xuất", "productionUnits", true),

    field("manufacturerCode", "Mã thiết bị nhà sản xuất"),

    field("stationCount", "Số trạm đang sử dụng", { kind: "computed" }),
  ],

  ["code", "name", "group", "productionUnit", "manufacturerCode", "status"],

  [
    "code",

    "name",

    "group",

    "productionUnit",

    "manufacturerCode",

    "stationCount",

    "status",
  ],
)

definitions.stations = standard(
  "Trạm sản xuất",

  "STATION",

  [
    ref("productionUnit", "Đơn vị sản xuất", "productionUnits", true),

    field("machineIds", "Máy móc", {
      kind: "multi-select",

      ref: "machines",

      required: true,
    }),

    field("machineCount", "Số lượng máy", { kind: "computed" }),
  ],

  ["code", "name", "productionUnit", "machineIds", "status"],

  ["code", "name", "productionUnit", "machineCount", "machineIds", "status"],
)

definitions.employees = standard(
  "Nhân viên",

  "EMP",

  [
    ref("productionUnitId", "Đơn vị sản xuất", "productionUnits", true),

    field("jobTitle", "Chức danh/Vị trí công việc"),

    field("joinedDate", "Ngày vào làm", { kind: "date" }),

    field("phone", "Số điện thoại"),

    field("email", "Email"),
  ],

  ["code", "name", "productionUnitId", "jobTitle", "status"],

  ["code", "name", "productionUnitId", "jobTitle", "phone", "status"],
)

definitions.shifts.fields = definitions.shifts.fields.filter(
  (f) => f.key !== "overnight",
)

definitions.shifts.columns = [
  "code",

  "name",

  "start",

  "end",

  "duration",

  "status",
]

definitions.shifts.fields.push(
  field("duration", "Thời lượng làm việc", { kind: "computed" }),
)

definitions.warehouses = standard(
  "Kho hàng",

  "WH",

  [
    select("kind", "Loại kho", [
      "Nguyên vật liệu",

      "Bán thành phẩm",

      "Thành phẩm",

      "Khác",
    ]),
  ],

  ["code", "name", "kind", "status"],

  ["code", "name", "kind", "description", "status"],
)

definitions.warehouses.fields.find((f) => f.key === "kind")!.required = true

definitions.locations.title = "Vị trí kho"

definitions.locations.filters = ["warehouse", "code", "name", "kind", "status"]

definitions.locations.fields.find((f) => f.key === "kind")!.required = true

definitions.units.filters.push("status")

// Labels specific to the operation catalogue; keep shared field definitions immutable.

definitions.operations.fields = definitions.operations.fields.map((field) =>
  field.key === "code"
    ? { ...field, label: "Mã công đoạn" }
    : field.key === "name"
      ? { ...field, label: "Tên công đoạn" }
      : field,
)
