import { api } from './api'

export type ShoeSummary = {
  shoeId: string
  name: string
  brand: string
  category: string
  pricePerDay: number
  variantCount: number
  isActive: boolean
  unitsInStock: number
  imagePublicId: string | null
  imageUrl: string | null
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
  imagePublicId: string | null
  imageUrlCard: string | null
  imageUrlDetail: string | null
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

export type AddShoeRequest = {
  name: string
  brand: string
  category: string
  description?: string
  pricePerDay: number
  imagePublicId?: string
  variants: { size: number; color: string; totalQuantity: number }[]
}

export type AddShoeResponse = {
  shoeId: string
  name: string
  brand: string
  category: string
  pricePerDay: number
  variantCount: number
  variantIds: string[]
  imagePublicId: string | null
}

export async function addShoe(body: AddShoeRequest): Promise<AddShoeResponse> {
  const { data } = await api.post<AddShoeResponse>('/shoes', body)
  return data
}

export type UpdateShoeRequest = {
  name?: string
  brand?: string
  category?: string
  description?: string | null
  pricePerDay?: number
  isActive?: boolean
  imagePublicId?: string | null
  variantQuantityUpdates?: { variantId: string; totalQuantity: number }[]
  newVariants?: { size: number; color: string; totalQuantity: number }[]
}

export type UploadShoeImageResponse = {
  publicId: string
  imageUrlCard: string
  imageUrlDetail: string
}

const MAX_SHOE_IMAGE_BYTES = 2 * 1024 * 1024

export async function uploadShoeImage(file: File): Promise<UploadShoeImageResponse> {
  if (file.size > MAX_SHOE_IMAGE_BYTES) {
    throw new Error('Image must be 2 MB or smaller.')
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed.')
  }
  const fd = new FormData()
  fd.append('image', file)
  const { data } = await api.post<UploadShoeImageResponse>('/shoe-images/upload', fd, {
    headers: { 'Content-Type': false },
  })
  return data
}

export async function updateShoe(
  shoeId: string,
  body: UpdateShoeRequest
): Promise<GetShoeResponse> {
  const { data } = await api.patch<GetShoeResponse>(`/shoes/${shoeId}`, body)
  return data
}

export type DeactivateShoeResponse = {
  shoeId: string
  isActive: boolean
}

export async function deactivateShoe(shoeId: string): Promise<DeactivateShoeResponse> {
  const { data } = await api.delete<DeactivateShoeResponse>(`/shoes/${shoeId}`)
  return data
}
