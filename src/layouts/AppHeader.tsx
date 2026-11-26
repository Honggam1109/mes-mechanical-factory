import ProfileModal from "../features/auth/components/ProfileModal"

import SecurityModal from "../features/auth/components/SecurityModal"

import { useAuth } from "../features/auth/AuthContext"

import React, { useState } from "react"

import {
  Layout,
  Button,
  Space,
  Avatar,
  Dropdown,
  Typography,
} from "antd"

import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DownOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  LogoutOutlined,
} from "@ant-design/icons"

import { AppConfig } from "../app/config/theme"

import type { MenuProps } from "antd"

interface AppHeaderProps {
  collapsed: boolean

  setCollapsed: (collapsed: boolean) => void

  onLogout: () => void
}

const { Header } = Layout

const { Text } = Typography

export default function AppHeader({
  collapsed,

  setCollapsed,

  onLogout,
}: AppHeaderProps) {
  const { auth } = useAuth()

  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false)

  const [isSecurityModalVisible, setIsSecurityModalVisible] = useState(false)

  const currentTheme = AppConfig.theme.light

  const userMenu: MenuProps = {
    onClick: (e) => {
      if (e.key === "profile") setIsProfileModalVisible(true)
      else if (e.key === "security") setIsSecurityModalVisible(true)
      else if (e.key === "logout") onLogout()
    },

    items: [
      { key: "grp_profile", type: "group", label: "TÀI KHOẢN CỦA TÔI" },

      {
        key: "profile",

        icon: <ProfileOutlined />,

        label: "Thông tin tài khoản",
      },

      {
        key: "security",

        icon: <SafetyCertificateOutlined />,

        label: "Đổi mật khẩu / Bảo mật",
      },

      { type: "divider" },

      {
        key: "logout",

        icon: <LogoutOutlined />,

        label: "Đăng xuất",

        danger: true,
      },
    ],
  }

  return (
    <>
      <Header
        className="app-header"
        style={{
          padding: "0 16px",

          background: "#fff",

          display: "flex",

          alignItems: "center",

          justifyContent: "space-between",

          borderBottom: `1px solid ${currentTheme.colors.borderColor}`,

          height: 64,
        }}
      >
        <Space className="header-menu-toggle" size="large" style={{ flex: 1 }}>
          <Button
            aria-label="Toggle navigation"
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: "16px", width: 40, height: 40 }}
          />
        </Space>
        <Space
          className="header-actions"
          size="middle"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: "pointer" }}>
              <Avatar
                size="small"
                style={{ backgroundColor: "#f9f0ff", color: "#722ed1" }}
              >
                {auth?.user.username.slice(0, 2).toUpperCase()}
              </Avatar>
              <Text className="header-user-name" strong>
                {auth?.user.fullName}
              </Text>
              <DownOutlined style={{ fontSize: 10, color: "#8c8c8c" }} />
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <ProfileModal
        open={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
      />

      <SecurityModal
        open={isSecurityModalVisible}
        onClose={() => setIsSecurityModalVisible(false)}
      />
    </>
  )
}
