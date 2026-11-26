import type { WarehouseDocument, DocumentFilters } from "../types/document"
export function filterDocuments(rows: WarehouseDocument[], filters: DocumentFilters) {
  const code = filters.code?.trim().toLowerCase() ?? ""
  return rows.filter(row => (!code || row.code.toLowerCase().includes(code)) &&
    (!filters.type || row.type === filters.type) && (!filters.status || row.status === filters.status) &&
    (!filters.sourceWarehouse || row.sourceWarehouse === filters.sourceWarehouse) &&
    (!filters.destinationWarehouse || row.destinationWarehouse === filters.destinationWarehouse) &&
    (!filters.dateRange || (row.plannedDate >= filters.dateRange[0] && row.plannedDate <= filters.dateRange[1])))
}
