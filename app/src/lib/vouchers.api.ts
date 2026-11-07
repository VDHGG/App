import { api } from './api'

export type VoucherRecord = {
  code: string
  discountPercent: number
  description: string
  isActive: boolean
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  createdAt: string
}

export type CreateVoucherRequest = {
  code: string
  discountPercent: number
  description: string
  isActive?: boolean
  maxUses?: number | null
  expiresAt?: string | null
}

export type UpdateVoucherRequest = {
  discountPercent?: number
  description?: string
  isActive?: boolean
  maxUses?: number | null
  expiresAt?: string | null
}

export async function listActiveVouchers(): Promise<{ vouchers: VoucherRecord[] }> {
  const { data } = await api.get<{ vouchers: VoucherRecord[] }>('/rentals/vouchers/active')
  return data
}

export async function listAllVouchersAdmin(): Promise<{ vouchers: VoucherRecord[] }> {
  const { data } = await api.get<{ vouchers: VoucherRecord[] }>('/vouchers')
  return data
}

export async function createVoucherAdmin(body: CreateVoucherRequest): Promise<VoucherRecord> {
  const { data } = await api.post<VoucherRecord>('/vouchers', body)
  return data
}

export async function updateVoucherAdmin(
  code: string,
  body: UpdateVoucherRequest
): Promise<VoucherRecord> {
  const { data } = await api.patch<VoucherRecord>(`/vouchers/${encodeURIComponent(code)}`, body)
  return data
}

export async function deleteVoucherAdmin(code: string): Promise<void> {
  await api.delete(`/vouchers/${encodeURIComponent(code)}`)
}
