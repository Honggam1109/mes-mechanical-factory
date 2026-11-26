import type { Product, ProductFilters, ProductValues } from "../types/product"

export function filterProducts(products: Product[], filters: ProductFilters) {
  const keyword = filters.keyword?.trim().toLocaleLowerCase() ?? ""

  return products.filter(
    (product) =>
      (!keyword ||
        product.code.toLocaleLowerCase().includes(keyword) ||
        product.name.toLocaleLowerCase().includes(keyword)) &&
      (!filters.category || product.category === filters.category) &&
      (!filters.catalog || product.catalog === filters.catalog) &&
      (!filters.status || product.status === filters.status) &&
      (!filters.dateRange ||
        (product.updatedAt >= filters.dateRange[0] &&
          product.updatedAt <= filters.dateRange[1])),
  )
}

export function nextProductCode(products: Product[]) {
  const highest = products.reduce((max, product) => {
    const match = /^PRODUCT-(\d+)$/.exec(product.code)

    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PRODUCT-${String(highest + 1).padStart(4, "0")}`
}

export function saveProduct(
  products: Product[],

  values: ProductValues,

  key?: string,
): Product[] {
  const today = productToday()

  const product: Product = {
    ...values,

    name: values.name.trim(),

    key: key ?? crypto.randomUUID(),

    updatedAt: today,
  }

  return key
    ? products.map((item) => (item.key === key ? product : item))
    : [product, ...products]
}

export function clampPage(page: number, total: number, pageSize: number) {
  return Math.max(1, Math.min(page, Math.ceil(total / pageSize) || 1))
}

export function productToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",
  }).format(new Date())
}
