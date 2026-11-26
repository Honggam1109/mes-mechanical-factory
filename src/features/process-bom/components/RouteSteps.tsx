import Select from "@/components/shared/SelectableSelect"
import {
  Button,
  Form,
  Input,
  InputNumber,
  Tag,
  Space,
  Typography,
} from "antd"

import type { FormInstance } from "antd"

import { DeleteOutlined } from "@ant-design/icons"

import type { RecordData } from "../../master-data/config"

import {
  active,
  text,
  operationUnitIds,
  type RouteStep,
  type Catalog,
} from "../lib/model"

import AddButton from "../../../components/shared/AddButton"

import DataTable from "../../../components/shared/DataTable"

export default function RouteSteps({
  form,

  all,

  readOnly,
}: {
  form: FormInstance<RecordData>

  all: Catalog

  readOnly: boolean
}) {
  const steps = (Form.useWatch("details", { form, preserve: true }) ||
    []) as RouteStep[]

  const operation = (index: number) =>
    all.operations.find((row) => row.id === steps[index]?.operation)

  return (
    <>
      {!readOnly && (
        <AddButton
          style={{ marginBottom: 16 }}
          onClick={() =>
            form.setFieldValue("details", [
              ...steps,

              {
                stepId: crypto.randomUUID(),

                order:
                  Math.max(0, ...steps.map((step) => Number(step.order) || 0)) +
                  10,

                operation: "",

                note: "",
              },
            ])
          }
        >
          Thêm công đoạn
        </AddButton>
      )}
      <DataTable
        rowKey="index"
        pagination={false}
        scroll={{ x: 1100 }}
        dataSource={steps

          .map((_, index) => ({ index }))

          .sort(
            (a, b) =>
              Number(steps[a.index].order) - Number(steps[b.index].order),
          )}
        columns={[
          {
            title: "Thứ tự *",

            width: 120,

            render: (_, row) => (
              <Form.Item
                name={["details", row.index, "order"]}
                rules={[
                  {
                    required: true,

                    type: "integer",

                    min: 1,

                    message: "Nhập số nguyên dương.",
                  },
                ]}
                style={{ margin: 0 }}
              >
                <InputNumber
                  disabled={readOnly}
                  min={1}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            ),
          },

          {
            title: "Mã công đoạn",

            width: 150,

            render: (_, row) => text(operation(row.index)?.code) || "—",
          },

          {
            title: "Tên công đoạn *",

            width: 280,

            render: (_, row) => (
              <>
                <Form.Item name={["details", row.index, "stepId"]} hidden>
                  <Input />
                </Form.Item>
                <Form.Item
                  name={["details", row.index, "operation"]}
                  rules={[{ required: true, message: "Chọn công đoạn." }]}
                  style={{ margin: 0 }}
                >
                  <Select
                    disabled={readOnly}
                    showSearch
                    optionFilterProp="label"
                    style={{ width: "100%" }}
                    options={all.operations

                      .filter(
                        (item) =>
                          active(item) ||
                          item.id === steps[row.index]?.operation,
                      )

                      .map((item) => ({
                        value: item.id,

                        label: `${item.code} · ${item.name}`,

                        disabled: !active(item),
                      }))}
                  />
                </Form.Item>
              </>
            ),
          },

          {
            title: "Đơn vị sản xuất có thể thực hiện",

            width: 280,

            render: (_, row) => (
              <Space wrap>
                {operationUnitIds(operation(row.index)).map((id) => {
                  const unit = all.productionUnits.find(
                    (item) => item.id === id,
                  )

                  return (
                    <Tag key={id}>
                      {text(unit?.name) || id}
                      {unit && !active(unit) ? " (Ngừng hoạt động)" : ""}
                    </Tag>
                  )
                })}
              </Space>
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
                      aria-label={`Xóa công đoạn thứ tự ${steps[row.index].order}`}
                      onClick={() =>
                        form.setFieldValue(
                          "details",

                          steps.filter((_, index) => index !== row.index),
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
