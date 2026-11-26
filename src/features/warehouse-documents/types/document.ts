export interface WarehouseDocument {
  lines?: DocumentLine[]
  confirmedAt?: string
  id: string
  code: string
  type: string
  status: string
  plannedDate: string
  requiredAt: string
  sourceWarehouse: string
  destinationWarehouse: string
}
export interface DocumentFilters {
  code?: string
  type?: string
  status?: string
  dateRange?: [string, string]
  sourceWarehouse?: string
  destinationWarehouse?: string
}

export interface DocumentLine {
  productId: string
  quantity: number
}
export type DocumentValues = Pick<WarehouseDocument, "plannedDate" | "requiredAt" | "sourceWarehouse" | "destinationWarehouse">
