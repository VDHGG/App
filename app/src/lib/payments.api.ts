import { api } from './api'
import { sanitizeCsvCell } from './rentals.api'

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

export type AdminMomoPaymentDto = {
  paymentId: number
  rentalId: string
  customerId: string
  customerName: string
  customerPhone: string | null
  rentalStatus: string
  amountVnd: number
  status: RentalPaymentStatusDto
  gatewayOrderId: string
  gatewayRequestId: string
  gatewayTransId: string | null
  payUrl: string | null
  createdAt: string
  paidAt: string | null
}

export type AdminMomoPaymentsSummaryDto = {
  totalTransactions: number
  paidCount: number
  pendingCount: number
  expiredOrFailedCount: number
  totalPaidVnd: number
  totalPendingVnd: number
}

export type AdminMomoPaymentsResponse = {
  status: string
  search: string | null
  summary: AdminMomoPaymentsSummaryDto
  payments: AdminMomoPaymentDto[]
}

export async function fetchAdminMomoPayments(params?: {
  status?: string
  search?: string
  limit?: number
}): Promise<AdminMomoPaymentsResponse> {
  const { data } = await api.get<AdminMomoPaymentsResponse>('/payments/momo', {
    ...(params ? { params } : {}),
  })
  return data
}

export function exportMomoPaymentsToCsv(
  payments: AdminMomoPaymentDto[],
  dateStr: string
): void {
  const headers = [
    'Mã GD MoMo (OrderId)',
    'Mã TransId MoMo',
    'Mã đơn thuê',
    'Trạng thái đơn',
    'Mã khách',
    'Tên khách',
    'SĐT khách',
    'Số tiền (VND)',
    'Trạng thái thanh toán',
    'Thời gian tạo',
    'Thời gian thanh toán',
  ]
  const rows = payments.map((p) => [
    p.gatewayOrderId,
    p.gatewayTransId ?? '',
    p.rentalId,
    p.rentalStatus,
    p.customerId,
    p.customerName,
    p.customerPhone ?? '',
    p.amountVnd,
    p.status,
    p.createdAt,
    p.paidAt ?? '',
  ])
  const csvContent =
    '\uFEFF' +
    [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
    ].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `momo-reconciliation-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
