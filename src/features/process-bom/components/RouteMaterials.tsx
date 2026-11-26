import { Form, Select, Typography } from "antd"

import type { FormInstance } from "antd"

import DataTable from "../../../components/shared/DataTable"

import type { RecordData } from "../../master-data/config"

import { bomLines, consumption, text, type Catalog } from "../lib/model"

export default function RouteMaterials({
  record,

  all,

  form,

  readOnly,
}: {
  record: RecordData

  all: Catalog

  form: FormInstance<RecordData>

  readOnly: boolean
}) {
  const bom = all.boms.find((bom) => bom.id === record.bom),
    materials = Array.isArray(record.materials)
      ? record.materials.map(String)
      : []

  const rows = consumption(
    {
      ...record,

      materials: readOnly
        ? materials
        : bomLines(bom).map((line) => line.material),
    },

    all,
  )

  return (
    <>
      <Form.Item name="materials" hidden>
        <Select mode="multiple" />
      </Form.Item>

      <DataTable
        rowKey="material"
        pagination={false}
        dataSource={rows}
        rowSelection={
          readOnly
            ? undefined
            : {
                selectedRowKeys: materials,

                onChange: (keys) =>
                  form.setFieldValue("materials", keys.map(String)),
              }
        }
        scroll={{ x: 900 }}
        columns={[
          {
            title: "Mã vật liệu",

            render: (_, line) => text(line.product?.code),
          },

          {
            title: "Tên nguyên liệu",

            render: (_, line) => text(line.product?.name),
          },

          {
            title: "Đơn vị tính",

            render: (_, line) => text(line.product?.unit),
          },

          {
            title: "Số lượng định mức",

            render: (_, line) =>
              line.quantity.toLocaleString("vi-VN", {
                maximumFractionDigits: 6,
              }),
          },

          {
            title: "Hao hụt (%)",

            render: (_, line) => Number(line.waste || 0),
          },

          {
            title: "Tổng nhu cầu kèm hao hụt",

            render: (_, line) =>
              line.total.toLocaleString("vi-VN", { maximumFractionDigits: 6 }),
          },

          { title: "Ghi chú", dataIndex: "note" },
        ]}
      />
    </>
  )
}
