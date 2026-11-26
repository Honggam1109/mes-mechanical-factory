import StatusTag from "@/components/shared/StatusTag"
import type { TableColumnsType } from "antd"

import type { Product } from "../types/product"


import React from "react"

import { Space, Button, Typography } from "antd"

import { EditOutlined, DeleteOutlined } from "@ant-design/icons"

const { Text } = Typography

// Hàm truyền callback để nhận sự kiện click từ bên ngoài vào MockData

export const getProductColumns = (
  onEditRecord: (record: Product) => void,
  onDeleteRecord: (record: Product) => void,
): TableColumnsType<Product> => [
  {
    title: "Mã sản phẩm",

    dataIndex: "code",

    key: "code",

    render: (text: string, record: Product) => (
      <a onClick={() => onEditRecord(record)} style={{ fontWeight: 500 }}>
        {text}
      </a>
    ),
  },

  {
    title: "Tên sản phẩm",

    dataIndex: "name",

    key: "name",
  },

  {
    title: "Phân loại",

    dataIndex: "category",

    key: "category",
  },

  {
    title: "Đơn vị",

    dataIndex: "unit",

    key: "unit",
  },

  {
    title: "Mô tả sản phẩm",

    dataIndex: "description",

    key: "description",

    render: (text: string) => <Text type="secondary">{text}</Text>,
  },

  {
    title: "Trạng thái",

    dataIndex: "status",

    key: "status",

    render: (status: string) => (
      <StatusTag color={status === "Hoạt động" ? "success" : "error"}>{status}</StatusTag>
    ),
  },

  {
    title: "Hành động",

    key: "action",

    width: 112,

    align: "center" as const,

    render: (_: unknown, record: Product) => (
      <Space size={8}>
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEditRecord(record)}
          title="Sửa / Chi tiết"
        />
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          title="Xóa"
          onClick={() => onDeleteRecord(record)}
        />
      </Space>
    ),
  },
]
