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
  depositAmount?: number
  startDate: string
  endDate: string
  isOverdue?: boolean
  overdueDays?: number
  estimatedLateFee?: number
}

export type GetRentalResponse = {
  rentalId: string
  customerId: string
  status: RentalStatus
  totalItems: number
  basePrice: number
  lateFee: number
  totalAmount: number
  depositAmount?: number
  startDate: string
  endDate: string
  items: RentalItemDto[]
  note: string | null
  createdAt: string
  activatedAt: string | null
  returnedAt: string | null
  cancelledAt: string | null
  isOverdue?: boolean
  overdueDays?: number
  estimatedLateFee?: number
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
  voucherCode?: string
}

export type CreateRentalResponse = {
  rentalId: string
  customerId: string
  status: RentalStatus
  totalItems: number
  basePrice: number
  totalAmount: number
  depositAmount?: number
  startDate: string
  endDate: string
  originalBasePrice?: number
  discountPercent?: number
  discountAmount?: number
  customerRank?: string
  appliedVoucher?: string | null
}

export type ListRentalsResponse = {
  rentals: RentalSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListRentalsQuery = {
  customerId?: string
  status?: RentalStatus
  startDateFrom?: string
  startDateTo?: string
  amountBucket?: 'all' | 'lt50' | '50to150' | '150to300' | 'gt300'
  search?: string
  page?: number
  pageSize?: number
}

export async function listRentals(query?: ListRentalsQuery): Promise<ListRentalsResponse> {
  const { data } = await api.get<ListRentalsResponse>('/rentals', {
    ...(query ? { params: query } : {}),
  })
  return data
}

export async function listMyRentals(query?: {
  page?: number
  pageSize?: number
}): Promise<ListRentalsResponse> {
  const { data } = await api.get<ListRentalsResponse>('/rentals/me', {
    ...(query ? { params: query } : {}),
  })
  return data
}

export async function getRental(rentalId: string): Promise<GetRentalResponse> {
  const { data } = await api.get<GetRentalResponse>(`/rentals/${rentalId}`)
  return data
}

export async function getMyRental(rentalId: string): Promise<GetRentalResponse> {
  const { data } = await api.get<GetRentalResponse>(`/rentals/me/${encodeURIComponent(rentalId)}`)
  return data
}

export type CancelMyRentalResponse = {
  rentalId: string
  customerId: string
  status: RentalStatus
  totalItems: number
  cancelledAt: string
}

export async function cancelMyRental(
  rentalId: string,
  body?: { cancelledAt?: string; note?: string }
): Promise<CancelMyRentalResponse> {
  const { data } = await api.patch<CancelMyRentalResponse>(
    `/rentals/me/${encodeURIComponent(rentalId)}/cancel`,
    body ?? {}
  )
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
  body?: { returnedAt?: string; note?: string; damageFee?: number }
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

export async function deleteRentalAdmin(rentalId: string): Promise<void> {
  await api.delete(`/rentals/${encodeURIComponent(rentalId)}`)
}

export type ValidateVoucherResponse = {
  valid: boolean
  code: string
  discountPercent: number
  description: string
}

export async function validateVoucher(code: string): Promise<ValidateVoucherResponse> {
  const { data } = await api.get<ValidateVoucherResponse>(
    `/rentals/vouchers/validate?code=${encodeURIComponent(code)}`
  )
  return data
}

export async function extendMyRental(
  rentalId: string,
  body: { newEndDate: string; note?: string }
): Promise<GetRentalResponse> {
  const { data } = await api.patch<GetRentalResponse>(
    `/rentals/me/${encodeURIComponent(rentalId)}/extend`,
    body
  )
  return data
}

export async function extendRentalAdmin(
  rentalId: string,
  body: { newEndDate: string; note?: string }
): Promise<GetRentalResponse> {
  const { data } = await api.patch<GetRentalResponse>(
    `/rentals/${encodeURIComponent(rentalId)}/extend`,
    body
  )
  return data
}

export type StatsPeriod = '7d' | '30d' | '6m' | 'all'

export type RevenueSeriesPoint = {
  label: string
  returnedRevenue: number
  activeRevenue: number
  totalRevenue: number
  rentalCount: number
}

export type LowStockVariantDto = {
  variantId: string
  shoeId: string
  shoeName: string
  size: number
  color: string
  totalQuantity: number
  reservedToday: number
  availableToday: number
}

export type AdminStatsOverviewResponse = {
  period?: StatsPeriod
  totalRentals: number
  statusCounts: {
    RESERVED: number
    ACTIVE: number
    RETURNED: number
    CANCELLED: number
  }
  overdueCount: number
  totalRevenueReturned: number
  activeExpectedRevenue: number
  totalLateFeesCollected: number
  momoPaidCount: number
  momoPaidAmountVnd: number
  totalCustomers: number
  revenueSeries?: RevenueSeriesPoint[]
  topShoes: Array<{
    shoeId: string
    shoeName: string
    totalRentalsCount: number
    totalUnitsRented: number
    averageRating: number | null
  }>
  lowStockVariants?: LowStockVariantDto[]
}

export type ActivityFeedFilterType =
  | 'ALL'
  | 'RESERVED'
  | 'MOMO'
  | 'ACTIVE'
  | 'RETURNED'
  | 'CANCELLED'
  | 'REVIEW'

export type ActivityFeedEventType =
  | 'RESERVED'
  | 'MOMO_PAID'
  | 'MOMO_EXPIRED'
  | 'ACTIVE'
  | 'RETURNED'
  | 'CANCELLED'
  | 'REVIEW'

export type ActivityFeedItem = {
  id: string
  type: ActivityFeedEventType
  title: string
  subtitle: string
  amountVnd: number | null
  rating: number | null
  link: string
  timestamp: string
}

export async function fetchActivityFeed(params?: {
  type?: ActivityFeedFilterType
  limit?: number
}): Promise<{ type: string; events: ActivityFeedItem[]; total: number }> {
  const { data } = await api.get<{ type: string; events: ActivityFeedItem[]; total: number }>(
    '/rentals/activity-feed',
    { ...(params ? { params } : {}) }
  )
  return data
}

export type DailyScheduleItemDto = {
  rentalId: string
  customerId: string
  customerName: string
  customerPhone: string
  status: RentalStatus
  startDate: string
  endDate: string
  totalItems: number
  totalAmount: number
  depositAmount: number
  overdueDays: number
  estimatedLateFee: number
  paymentStatus: string | null
}

export type DailyScheduleResponse = {
  date: string
  pickupsDue: DailyScheduleItemDto[]
  returnsDue: DailyScheduleItemDto[]
  overdueActive: DailyScheduleItemDto[]
  summary: {
    pickupsCount: number
    returnsCount: number
    overdueCount: number
  }
}

export async function fetchRentalSchedule(date?: string): Promise<DailyScheduleResponse> {
  const { data } = await api.get<DailyScheduleResponse>('/rentals/schedule', {
    ...(date ? { params: { date } } : {}),
  })
  return data
}

export async function fetchAdminStatsOverview(
  period?: StatsPeriod
): Promise<AdminStatsOverviewResponse> {
  const { data } = await api.get<AdminStatsOverviewResponse>('/rentals/stats/overview', {
    ...(period ? { params: { period } } : {}),
  })
  return data
}

export async function sweepExpiredMomoRentals(): Promise<{
  sweptCount: number
  cancelledRentalIds: string[]
  errors: number
}> {
  const { data } = await api.post<{
    sweptCount: number
    cancelledRentalIds: string[]
    errors: number
  }>('/rentals/sweep-expired-momo')
  return data
}

export type NotificationItem = {
  id: string
  type: 'OVERDUE' | 'DUE_SOON' | 'RANK_INFO' | 'VOUCHER' | 'ADMIN_ALERT'
  severity: 'danger' | 'warning' | 'success' | 'info'
  title: string
  message: string
  link: string
  createdAt: string
}

export async function fetchNotifications(): Promise<{
  notifications: NotificationItem[]
  unreadCount: number
}> {
  const { data } = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>(
    '/rentals/notifications'
  )
  return data
}

export function sanitizeCsvCell(v: string | number | null | undefined): string {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportRentalsToCsv(
  rentals: RentalSummary[],
  customerNameById: Record<string, string>,
  dateStr: string
): void {
  const headers = [
    'Mã đơn',
    'Mã khách',
    'Tên khách',
    'Số đôi',
    'Ngày bắt đầu',
    'Ngày hẹn trả',
    'Trạng thái',
    'Quá hạn (ngày)',
    'Giá thuê gốc (VND)',
    'Phụ phí / Trễ hạn (VND)',
    'Tổng tiền (VND)',
    'Tiền cọc (VND)',
  ]
  const rows = rentals.map((r) => [
    r.rentalId,
    r.customerId,
    customerNameById[r.customerId] ?? r.customerId,
    r.totalItems,
    r.startDate.slice(0, 10),
    r.endDate.slice(0, 10),
    r.status,
    r.overdueDays ?? 0,
    r.basePrice,
    Math.max(0, r.totalAmount - r.basePrice),
    r.totalAmount,
    r.depositAmount ?? r.totalItems * 500000,
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
  link.download = `rentals-report-${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

