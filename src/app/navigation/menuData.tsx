import React from "react"

import {
  DatabaseOutlined,
  DesktopOutlined,
  InboxOutlined,
  SettingOutlined,
  ShopOutlined,
  ToolOutlined,
} from "@ant-design/icons"

import { MENU_KEYS } from "./menuKeys"

import type { NavigationItem } from "./types"

export const menuGroups: NavigationItem[] = [
  {
    key: "sub-master-data",

    label: "DỮ LIỆU GỐC",

    icon: <DatabaseOutlined />,

    children: [
      {
        key: "sub-products",

        label: "Sản phẩm",

        icon: <InboxOutlined />,

        children: [
          { key: MENU_KEYS.PRODUCT_LIST, label: "Sản phẩm" },

          { key: MENU_KEYS.PRODUCT_TYPE, label: "Danh mục sản phẩm" },

          { key: MENU_KEYS.PRODUCT_ATTR, label: "Thuộc tính" },

          { key: MENU_KEYS.UNITS, label: "Đơn vị tính" },
        ],
      },

      {
        key: "sub-machines",

        label: "Máy móc & trạm",

        icon: <DesktopOutlined />,

        children: [
          { key: MENU_KEYS.MACHINE_LIST, label: "Máy móc" },

          { key: MENU_KEYS.PRODUCTION_STATIONS, label: "Trạm sản xuất" },

          { key: MENU_KEYS.STOP_REASONS, label: "Dừng máy" },
        ],
      },

      {
        key: "sub-production-config",

        label: "Quy trình BOM",

        icon: <ToolOutlined />,

        children: [
          { key: MENU_KEYS.PRODUCTION_OPERATIONS, label: "Công đoạn" },

          { key: MENU_KEYS.MATERIAL_BOMS, label: "Định mức BOM" },

          { key: MENU_KEYS.TECHNOLOGY_ROUTES, label: "Quy trình công nghệ" },
        ],
      },

      {
        key: "sub-warehouse-config",

        label: "Cấu hình kho",

        icon: <ShopOutlined />,

        children: [
          { key: MENU_KEYS.WAREHOUSE_LIST, label: "Kho hàng" },

          { key: MENU_KEYS.WAREHOUSE_LOCATIONS, label: "Vị trí kho" },
        ],
      },

      {
        key: "sub-organization",

        label: "Tổ chức",

        icon: <SettingOutlined />,

        children: [
          { key: MENU_KEYS.PRODUCTION_TEAMS, label: "Đơn vị sản xuất" },

          { key: MENU_KEYS.EMPLOYEES, label: "Nhân viên" },

          { key: MENU_KEYS.PRODUCTION_SHIFTS, label: "Ca làm việc" },

          { key: MENU_KEYS.SUPPLIERS, label: "Nhà cung cấp" },
        ],
      },
    ],
  },

  {
    key: "sub-production",

    label: "SẢN XUẤT",

    icon: <ToolOutlined />,

    children: [
      { key: MENU_KEYS.PRODUCTION_ORDERS, label: "Lệnh sản xuất" },

      { key: MENU_KEYS.PRODUCTION_ASSIGNMENTS, label: "Phân công sản xuất" },

      { key: MENU_KEYS.PRODUCTION, label: "Thực thi sản xuất" },

      {
        key: MENU_KEYS.PRODUCTION_PROGRESS,
        label: "Giám sát vận hành sản xuất",
      },
    ],
  },

  {
    key: "sub-warehouse",

    label: "KHO",

    icon: <ShopOutlined />,

    children: [
      { key: MENU_KEYS.WAREHOUSE_DOCUMENTS, label: "Lệnh chuyển hàng" },

    ],
  },

  {
    key: "sub-system",

    label: "HỆ THỐNG",

    icon: <SettingOutlined />,

    children: [
      { key: MENU_KEYS.USER_LIST, label: "Người dùng" },

      {
        key: "sub-permissions",

        label: "Vai trò & phân quyền",

        children: [
          { key: MENU_KEYS.ROLE_LIST, label: "Vai trò" },

          { key: MENU_KEYS.FUNC_PERMISSION, label: "Quyền chức năng" },

          { key: MENU_KEYS.DATA_PERMISSION, label: "Quyền dữ liệu" },
        ],
      },
    ],
  },
]
