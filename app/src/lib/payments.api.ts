import { api } from './api'

export type MomoCreatePaymentResponse = {
  skipped: boolean
  payUrl: string | null
}

export async function createMomoPayment(body: {
  rentalId: string
}): Promise<MomoCreatePaymentResponse> {
  const { data } = await api.post<MomoCreatePaymentResponse>('/payments/momo/create', body)
  return data
}

export async function confirmMomoReturnParams(
  params: Record<string, string>
): Promise<void> {
  await api.post('/payments/momo/ipn', params)
}

export type RentalPaymentStatusDto = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'

export type MomoPaymentStatusRecord = {
  status: RentalPaymentStatusDto
  amountVnd: number
  gatewayOrderId: string
  paidAt: string | null
}

export type MomoPaymentStatusesResponse = {
  payments: Record<string, MomoPaymentStatusRecord>
}

export async function fetchMomoPaymentStatuses(
  rentalIds: string[]
): Promise<MomoPaymentStatusesResponse> {
  if (rentalIds.length === 0) {
    return { payments: {} }
  }
  const { data } = await api.get<MomoPaymentStatusesResponse>(
    `/payments/momo/status?rentalIds=${encodeURIComponent(rentalIds.join(','))}`
  )
  return data
}
