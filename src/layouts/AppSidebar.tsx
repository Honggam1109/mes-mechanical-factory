import { productionResources } from "../features/production/lib/access"

import { canOpenScreen } from "../app/navigation/access"

// src/layouts/AppSidebar.tsx

import React, { useState, useEffect } from "react"

import { Layout, Menu } from "antd"

import { getMenuItems } from "../app/navigation/menuConfig"

import { getMenuParentKeys } from "../app/navigation/menuUtils"

import LogoImage from "../assets/factory-logo.png"

import { useAuth } from "../features/auth/AuthContext"

import { keyKinds } from "../features/system/navigation"

import { resources } from "../features/system/types"

const { Sider } = Layout

interface AppSidebarProps {
  collapsed: boolean

  activeKey: string

  onNavigate: (key: string) => void
}

export default function AppSidebar({
  collapsed,

  activeKey,

  onNavigate,
}: AppSidebarProps) {
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    getMenuParentKeys(activeKey),
  )

  useEffect(() => {
    setOpenKeys(getMenuParentKeys(activeKey))
  }, [activeKey])

  const { auth } = useAuth()

  const menuItems = getMenuItems(
    (key) => canOpenScreen(auth, key),
  )

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={256}
      collapsedWidth={80}
      style={{
        background: "#fff",

        borderRight: "1px solid #f0f0f0",

        height: "100dvh",

        position: "sticky",

        top: 0,
      }}
    >
      {/* Khu vực Logo & Thương hiệu */}
      <div
        style={{
          height: 64,

          display: "flex",

          alignItems: "center",

          justifyContent: collapsed ? "center" : "flex-start",

          paddingLeft: collapsed ? 0 : 16,

          paddingRight: collapsed ? 0 : 16,

          borderBottom: "1px solid #f0f0f0",

          overflow: "hidden",
        }}
      >
        <img
          src={LogoImage}
          alt="Logo nhà máy cơ khí"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <div
            style={{
              marginLeft: 12,

              display: "flex",

              flexDirection: "column",

              justifyContent: "center",

              whiteSpace: "nowrap",

              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontWeight: 700,

                fontSize: 14,

                lineHeight: "1.2",

                color: "#1f1f1f",
              }}
            >
              Nhà máy cơ khí
            </span>
            <span
              style={{
                fontWeight: 400,

                fontSize: 11,

                lineHeight: "1.2",

                color: "#8c8c8c",

                marginTop: 2,
              }}
            >
              Hệ thống quản lý sản xuất
            </span>
          </div>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[activeKey]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={menuItems}
        onClick={({ key }) => onNavigate(key)}
        inlineIndent={16}
        style={{
          borderRight: 0,

          height: "calc(100dvh - 64px)",

          overflowY: "auto",
        }}
      />
    </Sider>
  )
}
