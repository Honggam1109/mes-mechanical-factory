import Select from "@/components/shared/SelectableSelect"
import { Button, Form, Input, InputNumber, } from "antd"

import type { FormInstance } from "antd"

import { DeleteOutlined } from "@ant-design/icons"

import type { RecordData } from "../../master-data/config"

import {
  active,
  text,
  componentProduct,
  type BomLine,
  type Catalog,
} from "../lib/model"

import AddButton from "../../../components/shared/AddButton"

import DataTable from "../../../components/shared/DataTable"

export default function BomLines({
  form,

  all,

  readOnly,
}: {
  form: FormInstance<RecordData>

  all: Catalog

  readOnly: boolean
}) {
  const lines = (Form.useWatch("details", { form, preserve: true }) ||
      []) as BomLine[],
    product = Form.useWatch("product", form)

  const material = (index: number) =>
    all.products.find((row) => row.id === lines[index]?.material)

  return (
    <>
      {!readOnly && (
        <AddButton
          style={{ marginBottom: 16 }}
          onClick={() =>
            form.setFieldValue("details", [
              ...lines,

              { material: "", quantity: 1, note: "", waste: 0, bom: "" },
            ])
          }
        >
          Thêm thành phần
        </AddButton>
      )}
      <DataTable
        rowKey="index"
        pagination={false}
        scroll={{ x: 1200 }}
        dataSource={lines.map((_, index) => ({ index }))}
        columns={[
          { title: "STT", width: 60, render: (_, row) => row.index + 1 },

          {
            title: "Mã thành phần",

            width: 150,

            render: (_, row) => text(material(row.index)?.code) || "—",
          },

          {
            title: "Tên thành phần *",

            width: 300,

            render: (_, row) => (
              <Form.Item
                name={["details", row.index, "material"]}
                rules={[{ required: true, message: "Chọn thành phần." }]}
                style={{ margin: 0 }}
              >
                <Select
                  onChange={(id) =>
                    form.setFieldValue(
                      "details",
                      lines.map((line, index) =>
                        index === row.index
                          ? { ...line, material: id, bom: "" }
                          : line,
                      ),
                    )
                  }
                  disabled={readOnly}
                  showSearch
                  optionFilterProp="label"
                  style={{ width: "100%" }}
                  options={all.products

                    .filter(
                      (item) =>
                        (active(item) &&
                          componentProduct(item) &&
                          item.id !== product &&
                          !lines.some(
                            (line, index) =>
                              index !== row.index && line.material === item.id,
                          )) ||
                        item.id === lines[row.index]?.material,
                    )

                    .map((item) => ({
                      value: item.id,

                      label: `${item.code} · ${item.name}`,

                      disabled:
                        !active(item) ||
                        !componentProduct(item) ||
                        item.id === product,
                    }))}
                />
              </Form.Item>
            ),
          },

          {
            title: "Loại",

            width: 160,

            render: (_, row) => text(material(row.index)?.category) || "—",
          },

          {
            title: "Đơn vị tính",

            width: 100,

            render: (_, row) => text(material(row.index)?.unit) || "—",
          },

          {
            title: "Số lượng định mức *",

            width: 170,

            render: (_, row) => (
              <Form.Item
                name={["details", row.index, "quantity"]}
                rules={[
                  {
                    required: true,

                    type: "number",

                    min: 0.000001,

                    message: "Số lượng phải lớn hơn 0.",
                  },
                ]}
                style={{ margin: 0 }}
              >
                <InputNumber
                  disabled={readOnly}
                  min={0.000001}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            ),
          },

          {
            title: "Hao hụt (%)",
            width: 140,
            render: (_, row) => (
              <Form.Item
                name={["details", row.index, "waste"]}
                style={{ margin: 0 }}
              >
                <InputNumber
                  min={0}
                  max={100}
                  disabled={readOnly}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            ),
          },
          {
            title: "BOM bán thành phẩm",
            width: 210,
            render: (_, row) => (
              <Form.Item
                name={["details", row.index, "bom"]}
                style={{ margin: 0 }}
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={readOnly}
                  style={{ width: "100%" }}
                  placeholder="Không triển khai cấp dưới"
                  options={all.boms
                    .filter(
                      (bom) =>
                        bom.product === lines[row.index]?.material &&
                        (active(bom) || bom.id === lines[row.index]?.bom),
                    )
                    .map((bom) => ({
                      value: bom.id,
                      label: String(bom.code),
                      disabled: !active(bom),
                    }))}
                />
              </Form.Item>
            ),
          },
          {
            title: "Ghi chú",

            width: 200,

            render: (_, row) => (
              <Form.Item
                name={["details", row.index, "note"]}
                style={{ margin: 0 }}
              >
                <Input disabled={readOnly} />
              </Form.Item>
            ),
          },

          ...(!readOnly
            ? [
                {
                  title: "Thao tác",

                  width: 90,

                  fixed: "right" as const,

                  render: (_: unknown, row: { index: number }) => (
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      aria-label={`Xóa thành phần ${row.index + 1}`}
                      onClick={() =>
                        form.setFieldValue(
                          "details",

                          lines.filter((_, index) => index !== row.index),
                        )
                      }
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  )
}
