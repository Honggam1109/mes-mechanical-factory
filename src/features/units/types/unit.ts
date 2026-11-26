export const unitKinds = [
  { value: "COUNT", label: "Số lượng", color: "blue" },

  { value: "MASS", label: "Khối lượng", color: "geekblue" },

  { value: "LENGTH", label: "Chiều dài", color: "purple" },

  { value: "AREA", label: "Diện tích", color: "orange" },

  { value: "VOLUME", label: "Thể tích", color: "cyan" },

  { value: "TIME", label: "Thời gian", color: "green" },
] as const

export type UnitKind = typeof unitKinds[number]["value"]

export interface UnitValues {
  name: string

  label: string

  kind: UnitKind

  description: string

  status: "ACTIVE" | "INACTIVE"
}

export interface Unit extends UnitValues {
  id: string
}

export interface UnitFilters {
  status?: "ACTIVE" | "INACTIVE"

  name?: string

  label?: string

  kind?: UnitKind
}
