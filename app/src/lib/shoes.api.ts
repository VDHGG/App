import { api } from './api'

export type ShoeSummary = {
  shoeId: string
  name: string
  brand: string
  category: string
  pricePerDay: number
  variantCount: number
}

export type ShoeVariantDto = {
  variantId: string
  size: number
  color: string
  totalQuantity: number
  availableQuantity: number
}

export type GetShoeResponse = {
  shoeId: string
  name: string
  brand: string
  category: string
  description: string | null
  pricePerDay: number
  isActive: boolean
  variants: ShoeVariantDto[]
}

export type ListShoesResponse = {
  shoes: ShoeSummary[]
}

export async function listShoes(): Promise<ListShoesResponse> {
  const { data } = await api.get<ListShoesResponse>('/shoes')
  return data
}

export async function getShoe(shoeId: string): Promise<GetShoeResponse> {
  const { data } = await api.get<GetShoeResponse>(`/shoes/${shoeId}`)
  return data
}
