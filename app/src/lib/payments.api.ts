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
