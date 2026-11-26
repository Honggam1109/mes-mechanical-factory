import { Form, Row, Col, Select, DatePicker, Input } from "antd"

import type { FormInstance } from "antd"

import { SearchOutlined } from "@ant-design/icons"

import { AppConfig } from "../../../app/config/theme"

import FilterPanel, {
  FilterActions,
} from "../../../components/shared/FilterPanel"

import { productCategories, productStatuses } from "../config/productOptions"

import { useMasterData } from "../../master-data/store"

export default function ProductFilters({
  form,

  onSearch,

  onReset,
}: {
  form: FormInstance

  onSearch: () => void

  onReset: () => void
}) {
  const references = useMasterData()

  return (
    <FilterPanel>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ category: undefined, status: undefined }}
      >
        <Row gutter={AppConfig.theme.light.layout.filterGap}>
          <Col xs={24} md={8}>
            <Form.Item name="category" label="Phân loại">
              <Select
                placeholder="Tất cả"
                allowClear
                options={productCategories}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="status" label="Trạng thái">
              <Select
                placeholder="Tất cả"
                allowClear
                options={productStatuses}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="dateRange" label="Ngày cập nhật">
              <DatePicker.RangePicker
                style={{ width: "100%" }}
                placeholder={["Từ ngày", "Đến ngày"]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={AppConfig.theme.light.layout.filterGap}>
          <Col xs={24} md={8}>
            <Form.Item
              name="keyword"
              label="Từ khóa tìm kiếm"
            >
              <Input
                prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                placeholder="Nhập mã hoặc tên..."
                onPressEnter={onSearch}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="catalog" label="Danh mục sản phẩm">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Tất cả"
                options={references.categories.map((item) => ({
                  value: item.id,
                  label: String(item.name),
                }))}
              />
            </Form.Item>
          </Col>
          <Col
            className="product-filter-actions"
            xs={24}
            md={8}
            style={{
              display: "flex",

              alignItems: "flex-end",

              justifyContent: "flex-end",
            }}
          >
            <Form.Item>
              <FilterActions onReset={onReset} onSearch={onSearch} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </FilterPanel>
  )
}
