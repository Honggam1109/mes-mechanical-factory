import type { WarehouseDocument } from "../types/document"
import { documentStatuses, documentTypes } from "../config/documentOptions"
export const mockDocuments: WarehouseDocument[] = Array.from({ length: 24 }, (_, index) => ({
  id: String(index + 1), code: `WH-${String(index + 1).padStart(5, "0")}`,
  type: documentTypes[index % documentTypes.length].value,
  status: documentStatuses[index % documentStatuses.length].value,
  plannedDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
  requiredAt: `2026-10-${String(index + 1).padStart(2, "0")}T${index % 2 ? "14:00" : "08:00"}`,
  sourceWarehouse: index % 2 ? "production" : "raw", destinationWarehouse: index % 2 ? "finished" : "production",
}))
