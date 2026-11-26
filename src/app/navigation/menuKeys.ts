export const MENU_KEYS = {
  PRODUCTION_STATIONS: "master-stations",
  UNITS: "master-units",
  NG_CODES: "master-ng-codes",
  WAREHOUSE_RACKS: "warehouse-racks",
  SUPPLIERS: "master-suppliers",
  PRODUCTION_TEAMS: "master-production-teams",
  PRODUCTION_ORDERS: "production-orders",
  PRODUCTION_ASSIGNMENTS: "production-assignments",
  PRODUCTION_PROGRESS: "production-progress",
  INSPECTION_TYPE: "quality-types",
  INSPECTION_TEAM: "quality-teams",
  // Nhóm Báo cáo
  KPI_REPORT: "report-kpi",
  DETAIL_REPORT: "report-detail",

  // Nhóm Dữ liệu gốc -> Sản phẩm
  PRODUCT_OVERVIEW: "overview",
  PRODUCT_LIST: "products-list",
  PRODUCT_TYPE: "products-type",
  PRODUCT_ATTR: "products-attribute",
  PRODUCTION_AREAS: "master-areas",
  PRODUCTION_OPERATIONS: "master-operations",
  TECHNOLOGY_ROUTES: "master-routes",
  MATERIAL_BOMS: "master-boms",
  PRODUCTION_SHIFTS: "master-shifts",
  EMPLOYEES: "master-employees",
  DEPARTMENTS: "master-departments",
  WORKER_GRADES: "master-grades",
  STOP_REASONS: "master-stops",

  // Nhóm Dữ liệu gốc -> Máy móc
  MACHINE_LIST: "machines-list",

  WAREHOUSE_LIST: "warehouse-list",
  WAREHOUSE_LOCATIONS: "warehouse-locations",
  PRODUCTION: "production",
  STOCKTAKE: "warehouse-stocktake",
  INVENTORY_LOOKUP: "warehouse-inventory",
  WAREHOUSE_DOCUMENTS: "warehouse-transfers",
  TRANSFER_ORDERS: "warehouse-transfers", // Compatibility key for existing workspace tabs
  WAREHOUSE_EXECUTION: "warehouse-execution",
  INSPECTION_FREQUENCY: "quality-frequency",
  INSPECTION_METHOD: "quality-methods",
  INSPECTION_CHARACTERISTIC: "quality-characteristics",
  INSPECTION_PLAN: "quality-plans",
  INSPECTION_TICKET: "quality-tickets",

  // Nhóm Dữ liệu hệ thống (System)
  USER_LIST: "sys-users",                  // Người dùng
  MODULE_LIST: "sys-modules",              // Phân hệ
  RESOURCE_LIST: "sys-resources",          // Tài nguyên
  ROLE_LIST: "sys-roles",                  // Vai trò
  FUNC_PERMISSION: "sys-func-permissions", // Quyền chức năng
  DATA_PERMISSION: "sys-data-permissions", // Quyền dữ liệu
} as const
