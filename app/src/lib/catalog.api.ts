import { api } from './api'

export type CatalogLookupRow = {
  id: number
  name: string
}

export type ShoeLookupsResponse = {
  brands: CatalogLookupRow[]
  categories: CatalogLookupRow[]
  colors: CatalogLookupRow[]
}

export async function getShoeLookups(): Promise<ShoeLookupsResponse> {
  const { data } = await api.get<ShoeLookupsResponse>('/catalog/shoe-lookups')
  return data
}
