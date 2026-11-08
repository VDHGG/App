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
  availableUnitsInRange?: number
  imagePublicId: string | null
  imageUrl: string | null
  variants?: Array<{
    variantId: string
    size: number
    color: string
    totalQuantity: number
    reservedQuantity?: number
    availableQuantity?: number
  }>
}

export type ShoeVariantDto = {
  variantId: string
  size: number
  color: string
  colorId: number | null
  totalQuantity: number
  availableQuantity: number
}

export type GetShoeResponse = {
  shoeId: string
  name: string
  brand: string
  category: string
  brandId: number | null
  categoryId: number | null
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
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListShoesQuery = {
  priceBucket?: 'all' | 'lt10' | '10to20' | '20to50' | 'gt50'
  stockBucket?: 'all' | '0' | '1to5' | '6plus'
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export async function listShoes(params?: ListShoesQuery): Promise<ListShoesResponse> {
  const { data } = await api.get<ListShoesResponse>('/shoes', { params })
  return data
}

export async function getShoe(shoeId: string): Promise<GetShoeResponse> {
  const { data } = await api.get<GetShoeResponse>(`/shoes/${shoeId}`)
  return data
}

export type AddShoeRequest = {
  name: string
  brandId: number
  categoryId: number
  description?: string
  pricePerDay: number
  imagePublicId?: string
  variants: { size: number; colorId: number; totalQuantity: number }[]
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
  brandId?: number
  categoryId?: number
  description?: string | null
  pricePerDay?: number
  isActive?: boolean
  imagePublicId?: string | null
  variantQuantityUpdates?: { variantId: string; totalQuantity: number }[]
  newVariants?: { size: number; colorId: number; totalQuantity: number }[]
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

export type ShoeAvailabilityVariantDto = {
  variantId: string
  size: number
  color: string
  totalQuantity: number
  reservedQuantity: number
  availableQuantity: number
}

export type ShoeAvailabilityResponse = {
  shoeId: string
  startDate: string
  endDate: string
  durationDays: number
  variants: ShoeAvailabilityVariantDto[]
}

export type ShoeReviewDto = {
  reviewId: number | string
  shoeId: string
  customerId: string
  customerName: string
  rating: number
  comment: string
  createdAt: string
}

export type ShoeReviewsResponse = {
  shoeId: string
  averageRating: number
  totalReviews: number
  reviews: ShoeReviewDto[]
}

export async function fetchShoeAvailability(
  shoeId: string,
  startDate: string,
  endDate: string
): Promise<ShoeAvailabilityResponse> {
  const { data } = await api.get<ShoeAvailabilityResponse>(
    `/shoes/${encodeURIComponent(shoeId)}/availability?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  )
  return data
}

export async function fetchShoeReviews(shoeId: string): Promise<ShoeReviewsResponse> {
  const { data } = await api.get<ShoeReviewsResponse>(`/shoes/${encodeURIComponent(shoeId)}/reviews`)
  return data
}

export async function submitShoeReview(
  shoeId: string,
  body: { rating: number; comment: string }
): Promise<{ review?: ShoeReviewDto }> {
  const { data } = await api.post<{ review?: ShoeReviewDto }>(
    `/shoes/${encodeURIComponent(shoeId)}/reviews`,
    body
  )
  return data
}
