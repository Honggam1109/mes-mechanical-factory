import useUnsavedChanges from "../../../components/shared/useUnsavedChanges"

import AddButton from "../../../components/shared/AddButton"

import React, { useEffect, useState } from "react"

import {
  Card,
  Button,
  Tabs,
  Form,
  Row,
  Col,
  Input,
  InputNumber,
  Select,
  Checkbox,
  Space,
  message,
  Modal,
} from "antd"

import { DeleteOutlined } from "@ant-design/icons"

import { AppConfig } from "../../../app/config/theme"

import FormHeader from "../../../components/shared/FormHeader"

const { TextArea } = Input

import type { Product, ProductValues } from "../types/product"

import { productCategories, productStatuses } from "../config/productOptions"

import { useMasterData } from "../../master-data/store"

export default function ProductForm({
  editingRecord,

  nextCode,

  onBack,

  onSave,
}: {
  editingRecord: Product | null

  nextCode: string

  onBack: () => void

  onSave: (values: ProductValues) => void
}) {
  const [form] = Form.useForm<ProductValues>()

  const references = useMasterData()

  const [dirty, setDirty] = useState(false)

  const withoutGuard = useUnsavedChanges(dirty, () => {
    form.resetFields()
    setDirty(false)
  })

  const initialValues: ProductValues = editingRecord ?? {
    code: nextCode,

    name: "",

    category: productCategories[0].value,

    unit: "",

    status: productStatuses[0].value,

    description: "",

    trackType: "Theo lô",

    pqc: false,

    iqc: false,

    attributes: [],
  }

  const currentTheme = AppConfig.theme.light

  useEffect(() => {
    form.resetFields()
  }, [editingRecord, form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      withoutGuard(() => onSave(values))

      setDirty(false)
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "Vui lòng điền đầy đủ các trường bắt buộc!",
      )
    }
  }

  return (
    <Card bordered={false} style={{ minHeight: "100%", flexShrink: 0 }}>
      <FormHeader
        onBack={() => {
          if (!dirty) onBack()
          else
            Modal.confirm({
              title: "Thay đổi chưa lưu",
              content: "Rời khỏi sẽ bỏ các thay đổi chưa lưu.",
              okText: "Rời khỏi",
              cancelText: "Tiếp tục chỉnh sửa",
              onOk: () => {
                setDirty(false)
                withoutGuard(onBack)
              },
            })
        }}
        onReset={() => {
          form.resetFields()
          setDirty(false)
        }}
        onSave={handleSave}
      />

      <Form
        form={form}
        onValuesChange={() => setDirty(true)}
        initialValues={initialValues}
        layout="vertical"
        style={{ marginTop: 16 }}
      >
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: "1",

              label: "Thông tin sản phẩm",

              children: (
                <>
                  <Row gutter={24}>
                    <Col xs={24} md={8}>
                      <Form.Item name="code" label="Mã sản phẩm">
                        <Input disabled placeholder="PRODUCT-0005" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="name"
                        label="Tên sản phẩm"
                        rules={[
                          {
                            required: true,

                            whitespace: true,

                            message: "Vui lòng nhập tên sản phẩm!",
                          },
                        ]}
                      >
                        <Input placeholder="Tên sản phẩm" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="catalog" label="Danh mục sản phẩm">
                        <Select
                          placeholder="Danh mục sản phẩm"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={references.categories

                            .filter(
                              (item) =>
                                item.status === "Hoạt động" ||
                                item.id === editingRecord?.catalog,
                            )

                            .map((item) => ({
                              value: item.id,

                              label: String(item.name),
                            }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="category"
                        label="Phân loại sản phẩm"
                        rules={[
                          {
                            required: true,

                            message: "Vui lòng chọn phân loại.",
                          },
                        ]}
                      >
                        <Select
                          placeholder="Loại sản phẩm"
                          options={productCategories}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="unit"
                        label="Đơn vị tính"
                        rules={[
                          {
                            required: true,

                            message: "Vui lòng chọn đơn vị tính.",
                          },
                        ]}
                      >
                        <Select
                          placeholder="Đơn vị"
                          showSearch
                          optionFilterProp="label"
                          options={references.units

                            .filter(
                              (unit) =>
                                unit.status === "Hoạt động" ||
                                unit.label === editingRecord?.unit ||
                                unit.name === editingRecord?.unit,
                            )

                            .map((unit) => ({
                              value: String(unit.label || unit.name),

                              label: String(unit.name),
                            }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="trackType"
                        label="Loại theo dõi sản phẩm"
                        rules={[
                          {
                            required: true,

                            message: "Vui lòng chọn loại theo dõi.",
                          },
                        ]}
                      >
                        <Select
                          options={[
                            { value: "Theo lô", label: "Theo lô" },

                            {
                              value: "Không theo dõi",

                              label: "Không theo dõi",
                            },

                            { value: "Cái", label: "Cái (Serial)" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="status"
                        label="Trạng thái"
                        rules={[
                          {
                            required: true,

                            message: "Vui lòng chọn trạng thái.",
                          },
                        ]}
                      >
                        <Select options={productStatuses} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="supplier" label="Nhà cung cấp">
                        <Select
                          placeholder="Nhà cung cấp"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={references.suppliers

                            .filter(
                              (item) =>
                                item.status === "Hoạt động" ||
                                item.id === editingRecord?.supplier,
                            )

                            .map((item) => ({
                              value: item.id,

                              label: String(item.name),
                            }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col xs={24} md={8}>
                      <Form.Item name="price" label="Giá cả">
                        <InputNumber
                          min={0}
                          style={{ width: "100%" }}
                          placeholder="Giá cả"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item>
                        <Space size="large" wrap>
                          <Form.Item name="pqc" valuePropName="checked" noStyle>
                            <Checkbox>Cần kiểm tra PQC</Checkbox>
                          </Form.Item>
                          <Form.Item name="iqc" valuePropName="checked" noStyle>
                            <Checkbox>Cần kiểm tra IQC</Checkbox>
                          </Form.Item>
                        </Space>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item name="description" label="Mô tả sản phẩm">
                        <TextArea
                          autoSize={{ minRows: 4, maxRows: 10 }}
                          placeholder="Mô tả sản phẩm"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item label="Thuộc tính sản phẩm">
                        <Form.List name="attributes">
                          {(fields, { add, remove }) => (
                            <>
                              {fields.map(({ key, name, ...restField }) => (
                                <Row
                                  gutter={16}
                                  key={key}
                                  align="middle"
                                  className="product-attribute-row"
                                  style={{ marginBottom: 12 }}
                                >
                                  <Col xs={24} sm={11}>
                                    <Form.Item
                                      {...restField}
                                      name={[name, "attributeName"]}
                                      rules={[
                                        {
                                          required: true,

                                          message:
                                            "Giá trị trường này là bắt buộc",
                                        },
                                      ]}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <Select
                                        placeholder="Tên"
                                        showSearch
                                        allowClear
                                        options={references.attributes

                                          .filter(
                                            (item) =>
                                              item.status === "Hoạt động" ||
                                              editingRecord?.attributes?.some(
                                                (attribute) =>
                                                  attribute.attributeName ===
                                                  item.name,
                                              ),
                                          )

                                          .map(
                                            (item) => ({
                                              value: String(item.name),

                                              label: String(item.name),
                                            }),
                                          )}
                                        onChange={() =>
                                          form.setFieldValue(
                                            [
                                              "attributes",

                                              name,

                                              "attributeValue",
                                            ],

                                            undefined,
                                          )
                                        }
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} sm={11}>
                                    <Form.Item
                                      noStyle
                                      shouldUpdate={(previous, next) =>
                                        previous.attributes?.[name]
                                          ?.attributeName !==
                                        next.attributes?.[name]?.attributeName
                                      }
                                    >
                                      {() => {
                                        const attribute =
                                          references.attributes.find(
                                            (item) =>
                                              item.name ===
                                              form.getFieldValue([
                                                "attributes",

                                                name,

                                                "attributeName",
                                              ]),
                                          )

                                        return (
                                          <Form.Item
                                            {...restField}
                                            name={[name, "attributeValue"]}
                                            rules={[
                                              {
                                                required: true,

                                                message:
                                                  "Giá trị trường này là bắt buộc",
                                              },
                                            ]}
                                            style={{ marginBottom: 0 }}
                                          >
                                            {attribute?.kind ===
                                            "Danh sách chọn" ? (
                                              <Select
                                                placeholder="Chọn giá trị"
                                                options={(attribute.values as string[]).map(
                                                  (value) => ({
                                                    value,

                                                    label: value,
                                                  }),
                                                )}
                                              />
                                            ) : (
                                              <Input placeholder="Nhập giá trị" />
                                            )}
                                          </Form.Item>
                                        )
                                      }}
                                    </Form.Item>
                                  </Col>
                                  <Col
                                    xs={24}
                                    sm={2}
                                    style={{ textAlign: "center" }}
                                  >
                                    <Button
                                      type="text"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => remove(name)}
                                      title="Xóa dòng này"
                                    />
                                  </Col>
                                </Row>
                              ))}
                              <Form.Item
                                style={{
                                  marginBottom: 0,

                                  marginTop: fields.length > 0 ? 8 : 0,
                                }}
                              >
                                <AddButton block onClick={() => add()}>
                                  Thêm thuộc tính
                                </AddButton>
                              </Form.Item>
                            </>
                          )}
                        </Form.List>
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },

            {
              key: "2",

              label: "Thông tin sản xuất",

              children: (
                <div style={{ minHeight: 200, marginTop: 16 }}>
                  Nội dung thông tin sản xuất...
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Card>
  )
}
