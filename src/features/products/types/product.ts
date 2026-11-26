export interface Product {
  key: string

  code: string

  name: string

  category: string

  unit: string

  status: string

  description: string

  updatedAt: string

  catalog?: string

  trackType?: string

  supplier?: string

  price?: string

  pqc?: boolean

  iqc?: boolean

  attributes?: {
    attributeName: string

    attributeValue: string
  }[]
}

export type ProductValues = Omit<Product, "key" | "updatedAt">

export interface ProductFilters {
  catalog?: string

  keyword?: string

  category?: string

  status?: string

  dateRange?: [string, string]
}
