import { api } from './api'

export type RentalStatus = 'RESERVED' | 'ACTIVE' | 'RETURNED' | 'CANCELLED'

export type RentalItemDto = {
  shoeId: string
  variantId: string
  shoeName: string
  size: number
  color: string
  pricePerDay: number
  quantity: number
}

export type RentalSummary = {
  rentalId: string
  customerId: string
  status: RentalStatus
  totalItems: number
  basePrice: number
  totalAmount: number
  startDate: string
  endDate: string
}

export type GetRentalResponse = {
  rentalId: string
  customerId: string
  status: RentalStatus
  totalItems: number
  basePrice: number
  lateFee: number
  totalAmount: number
  startDate: string
  endDate: string
  items: RentalItemDto[]
  note: string | null
  createdAt: string
  activatedAt: string | null
  returnedAt: string | null
  cancelledAt: string | null
}

export type CreateRentalItemRequest = {
  variantId: string
  quantity: number
}

export type CreateRentalRequest = {
  customerId: string
  items: CreateRentalItemRequest[]
  startDate: string
  endDate: string
}

export type CreateRentalResponse = {
  rentalId: string
  customerId: string
  status: RentalStatus
  totalItems: number
  basePrice: number
  totalAmount: number
  startDate: string
  endDate: string
}

export type ListRentalsResponse = {
  rentals: RentalSummary[]
}

export type ListRentalsQuery = {
  status?: RentalStatus
  startDateFrom?: string
  startDateTo?: string
  amountBucket?: 'all' | 'lt50' | '50to150' | '150to300' | 'gt300'
}

export async function listRentals(query?: ListRentalsQuery): Promise<ListRentalsResponse> {
  const { data } = await api.get<ListRentalsResponse>('/rentals', {
    ...(query ? { params: query } : {}),
  })
  return data
}

export async function getRental(rentalId: string): Promise<GetRentalResponse> {
  const { data } = await api.get<GetRentalResponse>(`/rentals/${rentalId}`)
  return data
}

export async function createRental(
  body: CreateRentalRequest
): Promise<CreateRentalResponse> {
  const { data } = await api.post<CreateRentalResponse>('/rentals', body)
  return data
}

export async function activateRental(rentalId: string): Promise<GetRentalResponse> {
  const { data } = await api.patch<GetRentalResponse>(`/rentals/${rentalId}/activate`)
  return data
}

export async function returnRental(
  rentalId: string,
  body?: { returnedAt?: string; note?: string }
): Promise<GetRentalResponse> {
  const { data } = await api.patch<GetRentalResponse>(`/rentals/${rentalId}/return`, body ?? {})
  return data
}

export async function cancelRental(
  rentalId: string,
  body?: { cancelledAt?: string; note?: string }
): Promise<GetRentalResponse> {
  const { data } = await api.patch<GetRentalResponse>(`/rentals/${rentalId}/cancel`, body ?? {})
  return data
}
