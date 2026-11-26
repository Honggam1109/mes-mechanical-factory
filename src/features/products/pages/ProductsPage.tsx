import { useEffect, useState } from "react"

import useWorkspaceLocation from "../../../app/navigation/useWorkspaceLocation"

import { navigate } from "../../auth/AuthContext"

import { message } from "antd"

import ProductList from "../components/ProductList"

import ProductForm from "../components/ProductForm"

import useProducts from "../hooks/useProducts"

import type { Product } from "../types/product"

import { isReferenced } from "../../master-data/store"

export default function ProductsPage() {
  const data = useProducts()

  const [view, setView] = useState<"list" | "form">("list")

  const [editingRecord, setEditingRecord] = useState<Product | null>(null)

  const { pathname, query } = useWorkspaceLocation()

  const linkedId =
    pathname === "/workspace/products-list" ? query.get("record") : null

  useEffect(() => {
    if (linkedId) {
      const record = data.products.find((product) => product.key === linkedId)
      if (record) {
        setEditingRecord(record)
        setView("form")
      } else message.error("Không tìm thấy sản phẩm được liên kết.")
    }
  }, [linkedId])

  const back = () => {
    setView("list")
    if (linkedId) navigate("/workspace/products-list")
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: view === "list" ? "contents" : "none" }}>
        <ProductList
          products={data.products}
          onImport={data.importProducts}
          filteredData={data.filteredProducts}
          filters={data.filters}
          page={data.page}
          pageSize={data.pageSize}
          onSearch={data.search}
          onPaginate={data.paginate}
          onCreate={() => {
            setEditingRecord(null)

            setView("form")
          }}
          onEdit={(record) => {
            setEditingRecord(record)

            setView("form")
          }}
          onDelete={(key) => {
            if (isReferenced("products", key)) {
              message.warning(
                "Sản phẩm đang được tham chiếu bởi quy trình hoặc định mức vật tư.",
              )

              return
            }

            data.remove(key)

            message.success("Đã xóa sản phẩm trong phiên frontend.")
          }}
        />
      </div>
      {view === "form" && (
        <ProductForm
          editingRecord={editingRecord}
          nextCode={data.nextCode}
          onBack={back}
          onSave={(values) => {
            data.save(values, editingRecord?.key)

            back()

            message.success("Đã lưu sản phẩm trong phiên frontend.")
          }}
        />
      )}
    </div>
  )
}
