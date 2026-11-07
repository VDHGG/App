import { api } from './api'

export type AdminReviewItem = {
  reviewId: number
  shoeId: string
  shoeName: string
  customerId: string
  customerName: string
  rating: number
  comment: string
  createdAt: string
}

export type ListAdminReviewsResponse = {
  reviews: AdminReviewItem[]
  total: number
  averageRating: number
  overallTotal?: number
  overallAverageRating?: number
  lowRatingCount?: number
}

export async function listAdminReviews(params?: {
  rating?: number
  search?: string
}): Promise<ListAdminReviewsResponse> {
  const { data } = await api.get<ListAdminReviewsResponse>('/reviews', {
    ...(params ? { params } : {}),
  })
  return data
}

export async function deleteAdminReview(reviewId: number): Promise<void> {
  await api.delete(`/reviews/${encodeURIComponent(String(reviewId))}`)
}
