import { api } from './api'
import type { CatalogLookupRow } from './catalog.api'

export async function createBrand(name: string): Promise<CatalogLookupRow> {
  const { data } = await api.post<CatalogLookupRow>('/catalog/brands', { name })
  return data
}

export async function updateBrand(id: number, name: string): Promise<void> {
  await api.patch(`/catalog/brands/${id}`, { name })
}

export async function deleteBrand(id: number): Promise<void> {
  await api.delete(`/catalog/brands/${id}`)
}

export async function createCategory(name: string): Promise<CatalogLookupRow> {
  const { data } = await api.post<CatalogLookupRow>('/catalog/categories', { name })
  return data
}

export async function updateCategory(id: number, name: string): Promise<void> {
  await api.patch(`/catalog/categories/${id}`, { name })
}

export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/catalog/categories/${id}`)
}
