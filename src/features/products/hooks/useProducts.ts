import { mergeImportedProducts } from "../lib/productImport"

import type { ProductImportPreview } from "../lib/productImport"

import { useState } from "react"

import { updateRows, useMasterData } from "../../master-data/store"

import { validateProductReferences } from "../../master-data/rules"

import type { RecordData } from "../../master-data/config"

import type { Product } from "../types/product"

import {
  clampPage,
  filterProducts,
  nextProductCode,
  saveProduct,
  productToday,
} from "../lib/productData"

import type { ProductFilters, ProductValues } from "../types/product"

export default function useProducts() {
  const references = useMasterData()

  const products = references.products.map((row) => ({
    ...row,

    key: row.id,
  })) as unknown as Product[]

  const setProducts = (updater: (previous: Product[]) => Product[]) =>
    updateRows(
      "products",

      updater(products).map(
        (product) => ({ ...product, id: product.key }) as unknown as RecordData,
      ),
    )

  const [filters, setFilters] = useState<ProductFilters>({})

  const [page, setPage] = useState(1)

  const [pageSize, setPageSize] = useState(10)

  const filteredProducts = filterProducts(products, filters)

  const search = (next: ProductFilters) => {
    setFilters(next)

    setPage(1)
  }

  const save = (values: ProductValues, key?: string) => {
    const issues = validateProductReferences(
      { ...values, id: key || "new" } as unknown as RecordData,

      references,
    )

    if (issues.length) throw new Error(issues.join("\n"))

    setProducts((previous) => saveProduct(previous, values, key))

    if (!key) {
      setFilters({})

      setPage(1)
    }
  }

  const remove = (key: string) =>
    setProducts((previous) => previous.filter((product) => product.key !== key))

  const paginate = (nextPage: number, nextSize: number) => {
    setPage(nextSize === pageSize ? nextPage : 1)

    setPageSize(nextSize)
  }

  const importProducts = (preview: ProductImportPreview) => {
    const merged = mergeImportedProducts(products, preview, productToday())

    for (const row of merged.filter((row) =>
      preview.rows.some((imported) => imported.code === row.code),
    )) {
      const issues = validateProductReferences(
        { ...row, id: row.key } as unknown as RecordData,
        references,
      )

      if (issues.length) throw new Error(`${row.code}: ${issues.join("; ")}`)
    }

    setProducts(() => merged)

    setFilters({})

    setPage(1)
  }

  return {
    products,

    importProducts,

    filteredProducts,

    filters,

    search,

    save,

    remove,

    paginate,

    page: clampPage(page, filteredProducts.length, pageSize),

    pageSize,

    nextCode: nextProductCode(products),
  }
}
