import ExportDialog from "../../../components/shared/ExportDialog"

import { useMasterData } from "../../master-data/store"

import DataTable from "../../../components/shared/DataTable"

import ProductImportModal from "./ProductImportModal"

import { downloadProducts } from "../services/productExcel"

import type { ProductImportPreview } from "../lib/productImport"

import { useEffect, useState } from "react"

import { Card, Form, message } from "antd"

import ConfirmDeleteDialog from "../../../components/shared/ConfirmDeleteDialog"

import DataToolbar from "../../../components/shared/DataToolbar"

import ActionToolbar from "../../../components/shared/ActionToolbar"

import ProductFilters from "./ProductFilters"

import { getProductColumns } from "./productColumns"

import type { Product, ProductFilters as FilterValues } from "../types/product"

interface ProductListProps {
  products: Product[]

  onImport: (preview: ProductImportPreview) => void

  filteredData: Product[]

  filters: FilterValues

  page: number

  pageSize: number

  onSearch: (filters: FilterValues) => void

  onCreate: () => void

  onEdit: (product: Product) => void

  onDelete: (key: string) => void | Promise<void>

  onPaginate: (page: number, size: number) => void
}

export default function ProductList({
  products,

  onImport,

  filteredData,

  filters,

  page,

  pageSize,

  onSearch,

  onCreate,

  onEdit,

  onDelete,

  onPaginate,
}: ProductListProps) {
  const [importOpen, setImportOpen] = useState(false)

  const references = useMasterData()

  const [exportOpen, setExportOpen] = useState(false)

  const [exporting, setExporting] = useState(false)

  const exportFile = async (all = false) => {
    setExporting(true)

    try {
      await downloadProducts(all ? products : filteredData, "san-pham.xlsx")

      message.success("Đã xuất danh sách theo bộ lọc hiện tại.")
    } catch {
      message.error("Không xuất được file Excel.")
    } finally {
      setExporting(false)
    }
  }

  const [form] = Form.useForm()

  const [deletingRecord, setDeletingRecord] = useState<Product | null>(null)

  useEffect(() => {
    if (!Object.keys(filters).length) form.resetFields()
  }, [filters, form])

  const handleSearch = () => {
    const values = form.getFieldsValue()

    onSearch({
      keyword: values.keyword,

      category: values.category,

      catalog: values.catalog,

      status: values.status,

      dateRange: values.dateRange
        ? [
            values.dateRange[0].format("YYYY-MM-DD"),

            values.dateRange[1].format("YYYY-MM-DD"),
          ]
        : undefined,
    })
  }

  const handleResetFilter = () => {
    form.resetFields()

    onSearch({})
  }

  const handleReloadTable = () => {
    onSearch(filters)

    message.success("Đã tải lại dữ liệu bảng thành công!")
  }

  const columns = getProductColumns(onEdit, setDeletingRecord)

  columns.splice(2, 0, {
    title: "Danh mục sản phẩm",
    dataIndex: "catalog",
    render: (id) =>
      String(references.categories.find((row) => row.id === id)?.name || "—"),
  })

  return (
    <>
      <ExportDialog
        open={exportOpen}
        filteredCount={filteredData.length}
        totalCount={products.length}
        onClose={() => setExportOpen(false)}
        onExport={exportFile}
      />
      {deletingRecord && (
        <ConfirmDeleteDialog
          open
          content={
            <>
              Bạn có chắc chắn muốn xóa <strong>{deletingRecord.name}</strong>?
              Thao tác này không thể hoàn tác.
            </>
          }
          onCancel={() => setDeletingRecord(null)}
          onConfirm={() => onDelete(deletingRecord.key)}
        />
      )}
      {importOpen && (
        <ProductImportModal
          open
          products={products}
          onClose={() => setImportOpen(false)}
          onImport={(preview) => {
            onImport(preview)

            message.success(
              `Đã thêm ${preview.added}, cập nhật ${preview.updated} sản phẩm.`,
            )
          }}
        />
      )}
      <ProductFilters
        form={form}
        onSearch={handleSearch}
        onReset={handleResetFilter}
      />
      <Card bordered={false}>
        <DataToolbar total={filteredData.length} recordLabel="sản phẩm">
          <ActionToolbar
            onAdd={onCreate}
            onReload={handleReloadTable}
            disabled={exporting}
            onImport={() => setImportOpen(true)}
            onExport={exportFile}
          />
        </DataToolbar>

        <DataTable
          rowKey="key"
          scroll={{ x: 900 }}
          columns={columns}
          dataSource={filteredData}
          pagination={{
            total: filteredData.length,

            current: page,

            pageSize,

            onChange: onPaginate,

            showSizeChanger: true,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
        />
      </Card>
    </>
  )
}
