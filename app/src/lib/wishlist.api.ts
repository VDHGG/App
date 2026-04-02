import { api } from './api'

export type WishlistItemDto = {
  shoeId: string
  name: string
  brand: string
  category: string
  pricePerDay: number
  imagePublicId: string | null
  imageUrl: string | null
  addedAt: string
}

export type ListWishlistResponse = {
  items: WishlistItemDto[]
}

export async function fetchWishlist(): Promise<ListWishlistResponse> {
  const { data } = await api.get<ListWishlistResponse>('/wishlist')
  return data
}

export async function fetchWishlistShoeIds(): Promise<{ shoeIds: string[] }> {
  const { data } = await api.get<{ shoeIds: string[] }>('/wishlist/shoe-ids')
  return data
}

export async function addWishlistItem(shoeId: string): Promise<void> {
  await api.post('/wishlist', { shoeId })
}

export async function removeWishlistItem(shoeId: string): Promise<void> {
  await api.delete(`/wishlist/${encodeURIComponent(shoeId)}`)
}

export async function clearWishlist(): Promise<void> {
  await api.delete('/wishlist/clear')
}
