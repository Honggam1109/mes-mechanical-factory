import MonitoringPage from "../../features/production/pages/MonitoringPage"

import ExecutionPage from "../../features/production/pages/ExecutionPage"

import OrdersPage from "../../features/production/pages/OrdersPage"

import AssignmentsPage from "../../features/production/pages/AssignmentsPage"

import WarehouseDocumentsPage from "../../features/warehouse-documents/pages/WarehouseDocumentsPage"

import MasterDataPage from "../../features/master-data/MasterDataPage"

import type { ReactNode } from "react"

import { Empty } from "antd"

import DashboardOverview from "../../features/products/pages/ProductOverviewPage"

import ProductModule from "../../features/products/pages/ProductsPage"

import SystemPage from "../../features/system/SystemPage"

import UnitsPage from "../../features/units/pages/UnitsPage"

import ProcessBomPage from "../../features/process-bom/pages/ProcessBomPage"

import { MENU_KEYS } from "./menuKeys"

import { getMenuLabel } from "./menuUtils"

import type { ScreenKey } from "./types"

export function renderWorkspaceScreen(
  key: ScreenKey,

  onNavigate: (key: string) => void,
): ReactNode {
  switch (key) {
    case MENU_KEYS.PRODUCTION_PROGRESS:
      return <MonitoringPage />

    case MENU_KEYS.PRODUCTION:
      return <ExecutionPage />

    case MENU_KEYS.PRODUCTION_ORDERS:
      return <OrdersPage />

    case MENU_KEYS.PRODUCTION_ASSIGNMENTS:
      return <AssignmentsPage />

    case MENU_KEYS.PRODUCT_OVERVIEW:
      return <DashboardOverview setActiveKey={onNavigate} />

    case MENU_KEYS.PRODUCT_LIST:
      return <ProductModule />

    case MENU_KEYS.UNITS:
      return <UnitsPage />

    case MENU_KEYS.PRODUCT_TYPE:
      return <MasterDataPage entity="categories" />

    case MENU_KEYS.PRODUCT_ATTR:
      return <MasterDataPage entity="attributes" />

    case MENU_KEYS.PRODUCTION_AREAS:
      return <MasterDataPage entity="areas" />

    case MENU_KEYS.PRODUCTION_OPERATIONS:
      return <MasterDataPage entity="operations" />

    case MENU_KEYS.TECHNOLOGY_ROUTES:
      return <ProcessBomPage kind="routes" />

    case MENU_KEYS.MATERIAL_BOMS:
      return <ProcessBomPage kind="boms" />

    case MENU_KEYS.PRODUCTION_SHIFTS:
      return <MasterDataPage entity="shifts" />

    case MENU_KEYS.WAREHOUSE_LIST:
      return <MasterDataPage entity="warehouses" />

    case MENU_KEYS.WAREHOUSE_LOCATIONS:
      return <MasterDataPage entity="locations" />

    case MENU_KEYS.EMPLOYEES:
      return <MasterDataPage entity="employees" />

    case MENU_KEYS.DEPARTMENTS:
      return <MasterDataPage entity="departments" />

    case MENU_KEYS.WORKER_GRADES:
      return <MasterDataPage entity="grades" />

    case MENU_KEYS.PRODUCTION_STATIONS:
      return <MasterDataPage entity="stations" />

    case MENU_KEYS.PRODUCTION_TEAMS:
      return <MasterDataPage entity="productionUnits" />

    case MENU_KEYS.SUPPLIERS:
      return <MasterDataPage entity="suppliers" />

    case MENU_KEYS.MACHINE_LIST:
      return <MasterDataPage entity="machines" />

    case MENU_KEYS.STOP_REASONS:
      return <MasterDataPage entity="stops" />

    case MENU_KEYS.WAREHOUSE_DOCUMENTS:
      return <WarehouseDocumentsPage />

    case MENU_KEYS.USER_LIST:
      return <SystemPage kind="users" />

    case MENU_KEYS.ROLE_LIST:
      return <SystemPage kind="roles" />

    case MENU_KEYS.FUNC_PERMISSION:
      return <SystemPage kind="permissions" />

    case MENU_KEYS.DATA_PERMISSION:
      return <SystemPage kind="data-permissions" />

    default:
      return (
        <div
          style={{
            display: "flex",

            height: "100%",

            justifyContent: "center",

            alignItems: "center",
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 16, color: "#8c8c8c", fontWeight: 500 }}>
                {getMenuLabel(key) || "Chức năng"}
                <br />
                <span style={{ fontSize: 14, fontWeight: 400 }}>
                  Chức năng đang phát triển
                </span>
              </span>
            }
          />
        </div>
      )
  }
}
