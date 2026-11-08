import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  listRentals,
  activateRental,
  cancelRental,
  fetchAdminStatsOverview,
  sweepExpiredMomoRentals,
  fetchActivityFeed,
  fetchRentalSchedule,
  exportRentalsToCsv,
  type RentalSummary,
  type AdminStatsOverviewResponse,
  type StatsPeriod,
  type LowStockVariantDto,
  type ActivityFeedFilterType,
  type ActivityFeedItem,
  type DailyScheduleResponse,
} from '../../lib/rentals.api'
import { updateShoe } from '../../lib/shoes.api'
import { listCustomers } from '../../lib/customers.api'
import type { CustomerSummary } from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatDate, formatCurrency, formatDurationDays } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

const RECENT_LIMIT = 10

function confirmRentalAction(action: 'activate' | 'return' | 'cancel'): boolean {
  const msg =
    action === 'activate'
      ? 'Activate this rental? The reservation will become active.'
      : action === 'return'
        ? 'Mark this rental as returned?'
        : 'Cancel this reservation? This cannot be undone.'
  return window.confirm(msg)
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const [rentals, setRentals] = useState<RentalSummary[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [stats, setStats] = useState<AdminStatsOverviewResponse | null>(null)
  const [period, setPeriod] = useState<StatsPeriod>('all')
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)
  const [restockLoadingId, setRestockLoadingId] = useState<string | null>(null)
  const [feedFilter, setFeedFilter] = useState<ActivityFeedFilterType>('ALL')
  const [feedEvents, setFeedEvents] = useState<ActivityFeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<string>(() => toDateString(new Date()))
  const [scheduleData, setScheduleData] = useState<DailyScheduleResponse | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const customerMap = Object.fromEntries(customers.map((c) => [c.customerId, c]))

  useEffect(() => {
    Promise.all([
      listRentals(),
      listCustomers(),
      fetchAdminStatsOverview('all').catch(() => null),
      fetchActivityFeed({ type: 'ALL', limit: 20 }).catch(() => ({
        type: 'ALL',
        events: [] as ActivityFeedItem[],
        total: 0,
      })),
    ])
      .then(([rentalsRes, customersRes, statsRes, feedRes]) => {
        setRentals(rentalsRes.rentals)
        setCustomers(customersRes.customers)
        setStats(statsRes)
        setFeedEvents(feedRes.events)
      })
      .catch((err) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!scheduleDate) return
    setScheduleLoading(true)
    fetchRentalSchedule(scheduleDate)
      .then((res) => setScheduleData(res))
      .catch(() => setScheduleData(null))
      .finally(() => setScheduleLoading(false))
  }, [scheduleDate])

  const handleDispatchActivate = async (rentalId: string) => {
    setActionLoading(rentalId)
    setActionError(null)
    setSweepMessage(null)
    try {
      await activateRental(rentalId)
      const [res, statsRes, feedRes, schedRes] = await Promise.all([
        listRentals(),
        fetchAdminStatsOverview(period).catch(() => null),
        fetchActivityFeed({ type: feedFilter, limit: 20 }).catch(() => null),
        fetchRentalSchedule(scheduleDate).catch(() => null),
      ])
      setRentals(res.rentals)
      setStats(statsRes)
      if (feedRes) setFeedEvents(feedRes.events)
      if (schedRes) setScheduleData(schedRes)
      setSweepMessage(`Đã kích hoạt giao giày cho đơn #${rentalId}.`)
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handlePeriodChange = async (nextPeriod: StatsPeriod) => {
    setPeriod(nextPeriod)
    try {
      const statsRes = await fetchAdminStatsOverview(nextPeriod)
      setStats(statsRes)
    } catch {
      // ignore
    }
  }

  const handleFeedFilterChange = async (nextType: ActivityFeedFilterType) => {
    setFeedFilter(nextType)
    setFeedLoading(true)
    try {
      const res = await fetchActivityFeed({ type: nextType, limit: 20 })
      setFeedEvents(res.events)
    } catch {
      // ignore
    } finally {
      setFeedLoading(false)
    }
  }

  const handleQuickRestock = async (variant: LowStockVariantDto, delta: number) => {
    setRestockLoadingId(`${variant.variantId}:${delta}`)
    setSweepMessage(null)
    setActionError(null)
    try {
      const nextTotal = variant.totalQuantity + delta
      await updateShoe(variant.shoeId, {
        variantQuantityUpdates: [
          { variantId: variant.variantId, totalQuantity: nextTotal },
        ],
      })
      const statsRes = await fetchAdminStatsOverview(period).catch(() => null)
      if (statsRes) setStats(statsRes)
      setSweepMessage(
        `Đã nhập kho nhanh +${delta} đôi cho ${variant.shoeName} (Size EU ${variant.size} · ${variant.color}). Tổng tồn kho mới: ${nextTotal} đôi.`
      )
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setRestockLoadingId(null)
    }
  }

  const handleSweepExpiredMomo = async () => {
    setSweepLoading(true)
    setSweepMessage(null)
    setActionError(null)
    try {
      const res = await sweepExpiredMomoRentals()
      setSweepMessage(`Đã quét và giải phóng ${res.sweptCount} đơn treo MoMo quá hạn.`)
      const [rentalsRes, statsRes, feedRes, schedRes] = await Promise.all([
        listRentals(),
        fetchAdminStatsOverview(period).catch(() => null),
        fetchActivityFeed({ type: feedFilter, limit: 20 }).catch(() => null),
        fetchRentalSchedule(scheduleDate).catch(() => null),
      ])
      setRentals(rentalsRes.rentals)
      setStats(statsRes)
      if (feedRes) setFeedEvents(feedRes.events)
      if (schedRes) setScheduleData(schedRes)
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setSweepLoading(false)
    }
  }

  const totalRentals = rentals.length
  const pendingReturns = rentals.filter((r) => r.status === 'ACTIVE').length
  const revenue = rentals
    .filter((r) => r.status === 'RETURNED')
    .reduce((sum, r) => sum + r.totalAmount, 0)
  const recentRentals = rentals.slice(0, RECENT_LIMIT)

  const handleExportCsv = () => {
    const nameMap = Object.fromEntries(customers.map((c) => [c.customerId, c.fullName]))
    exportRentalsToCsv(rentals, nameMap, toDateString(new Date()))
  }

  const handleAction = async (
    rentalId: string,
    action: 'activate' | 'cancel'
  ) => {
    if (!confirmRentalAction(action)) return
    setActionLoading(rentalId)
    setActionError(null)
    try {
      if (action === 'activate') await activateRental(rentalId)
      else await cancelRental(rentalId)
      const [res, statsRes, feedRes, schedRes] = await Promise.all([
        listRentals(),
        fetchAdminStatsOverview(period).catch(() => null),
        fetchActivityFeed({ type: feedFilter, limit: 20 }).catch(() => null),
        fetchRentalSchedule(scheduleDate).catch(() => null),
      ])
      setRentals(res.rentals)
      setStats(statsRes)
      if (feedRes) setFeedEvents(feedRes.events)
      if (schedRes) setScheduleData(schedRes)
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Dashboard Overview" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <AdminHeader title="Dashboard Overview" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-slate-500">Make sure the backend server is running.</p>
        </div>
      </>
    )
  }

  const series = stats?.revenueSeries ?? []
  const maxSeriesRevenue = Math.max(1, ...series.map((p) => p.totalRevenue))
  const statusTotal = Math.max(
    1,
    (stats?.statusCounts.RESERVED ?? 0) +
      (stats?.statusCounts.ACTIVE ?? 0) +
      (stats?.statusCounts.RETURNED ?? 0) +
      (stats?.statusCounts.CANCELLED ?? 0)
  )

  return (
    <>
      <AdminHeader title="Dashboard Overview" />
      <div className="p-6 lg:p-8 space-y-8 max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Chu kỳ thống kê:
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bộ lọc thời gian">
            {(
              [
                { value: 'all', label: 'Tất cả' },
                { value: '6m', label: '6 tháng qua' },
                { value: '30d', label: '30 ngày qua' },
                { value: '7d', label: '7 ngày qua' },
              ] as { value: StatsPeriod; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => void handlePeriodChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  period === opt.value
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {sweepMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center justify-between">
            <span>{sweepMessage}</span>
            <button
              type="button"
              onClick={() => setSweepMessage(null)}
              className="text-xs underline ml-4"
            >
              Đóng
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined">payments</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Doanh thu hoàn tất (RETURNED)</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                {formatCurrency(stats?.totalRevenueReturned ?? revenue)}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              Phụ phí trễ hạn: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(stats?.totalLateFeesCollected ?? 0)}</span>
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <span className="material-symbols-outlined">trending_up</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Doanh thu đang thực hiện</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                {formatCurrency(stats?.activeExpectedRevenue ?? 0)}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              MoMo PAID: <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(stats?.momoPaidAmountVnd ?? 0)}</span> ({stats?.momoPaidCount ?? 0} đơn)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                  <span className="material-symbols-outlined">assignment_return</span>
                </div>
                {(stats?.overdueCount ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-full">
                    <span className="size-1.5 rounded-full bg-rose-500" />
                    {stats?.overdueCount} đơn quá hạn
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 rounded-full">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    0 quá hạn
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Đơn đang thuê (ACTIVE)</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                {stats?.statusCounts.ACTIVE ?? pendingReturns} đơn
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              Cần theo dõi sát lịch trả để xử lý quá hạn kịp thời
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                  <span className="material-symbols-outlined">group</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Tổng đơn & Khách hàng</p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                {stats?.totalRentals ?? totalRentals} đơn · {stats?.totalCustomers ?? customers.length} khách
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 truncate" title={`Đặt: ${stats?.statusCounts.RESERVED ?? 0} · Trả: ${stats?.statusCounts.RETURNED ?? 0} · Hủy: ${stats?.statusCounts.CANCELLED ?? 0}`}>
              Đặt: {stats?.statusCounts.RESERVED ?? 0} · Trả: {stats?.statusCounts.RETURNED ?? 0} · Hủy: {stats?.statusCounts.CANCELLED ?? 0}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/rentals/new"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10"
          >
            <span className="material-symbols-outlined">point_of_sale</span>
            New walk-in rental
          </Link>
          <Link
            to="/admin/shoes"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined">inventory_2</span>
            Shoe inventory
          </Link>
          <Link
            to="/admin/vouchers"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-3 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40"
          >
            <span className="material-symbols-outlined">local_activity</span>
            Manage Vouchers
          </Link>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
          >
            <span className="material-symbols-outlined">download</span>
            Xuất CSV báo cáo
          </button>
          <button
            type="button"
            disabled={sweepLoading}
            onClick={() => void handleSweepExpiredMomo()}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">timer_off</span>
            {sweepLoading ? 'Đang quét…' : 'Quét đơn MoMo quá hạn'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">bar_chart</span>
                  Biểu đồ Xu hướng Doanh thu
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  So sánh doanh thu hoàn tất (RETURNED) và doanh thu đang thực hiện theo thời gian
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <span className="size-2.5 rounded-sm bg-emerald-500" />
                  Đã hoàn tất
                </span>
                <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="size-2.5 rounded-sm bg-blue-500" />
                  Đang thuê / Đặt
                </span>
              </div>
            </div>

            {series.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-slate-400">
                Chưa có dữ liệu biểu đồ cho chu kỳ này
              </div>
            ) : (
              <div className="h-60 flex items-end gap-2 sm:gap-3 pt-6 pb-2 px-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
                {series.map((point) => {
                  const returnedPct = Math.round((point.returnedRevenue / maxSeriesRevenue) * 100)
                  const activePct = Math.round((point.activeRevenue / maxSeriesRevenue) * 100)
                  const totalHeightPct = Math.min(100, Math.max(point.totalRevenue > 0 ? 6 : 2, returnedPct + activePct))
                  return (
                    <div
                      key={point.label}
                      className="flex-1 min-w-[42px] h-full flex flex-col justify-end items-center group"
                      title={`${point.label}: Tổng ${formatCurrency(point.totalRevenue)} (${point.rentalCount} đơn)`}
                    >
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 opacity-85 group-hover:opacity-100 truncate max-w-[68px]">
                        {point.totalRevenue > 0
                          ? `${Math.round(point.totalRevenue / 1000).toLocaleString('vi-VN')}k`
                          : '0'}
                      </span>
                      <div
                        className="w-full max-w-[36px] rounded-t-lg overflow-hidden flex flex-col justify-end bg-slate-100 dark:bg-slate-800 transition-all"
                        style={{ height: `${totalHeightPct}%` }}
                      >
                        {point.activeRevenue > 0 && (
                          <div
                            className="w-full bg-blue-500 transition-all"
                            style={{
                              height: `${
                                point.totalRevenue > 0
                                  ? Math.round((point.activeRevenue / point.totalRevenue) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        )}
                        {point.returnedRevenue > 0 && (
                          <div
                            className="w-full bg-emerald-500 transition-all"
                            style={{
                              height: `${
                                point.totalRevenue > 0
                                  ? Math.round((point.returnedRevenue / point.totalRevenue) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        )}
                      </div>
                      <span className="mt-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {point.label}
                      </span>
                      <span className="text-[9px] text-slate-400 whitespace-nowrap">
                        {point.rentalCount} đơn
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary">pie_chart</span>
                Phân bổ Trạng thái Đơn thuê
              </h3>
              <p className="text-xs text-slate-500 mb-5">
                Tỷ trọng đơn thuê theo trạng thái xử lý hiện tại
              </p>

              <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex mb-6">
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{
                    width: `${Math.round(((stats?.statusCounts.RESERVED ?? 0) / statusTotal) * 100)}%`,
                  }}
                  title={`RESERVED: ${stats?.statusCounts.RESERVED ?? 0}`}
                />
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{
                    width: `${Math.round(((stats?.statusCounts.ACTIVE ?? 0) / statusTotal) * 100)}%`,
                  }}
                  title={`ACTIVE: ${stats?.statusCounts.ACTIVE ?? 0}`}
                />
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{
                    width: `${Math.round(((stats?.statusCounts.RETURNED ?? 0) / statusTotal) * 100)}%`,
                  }}
                  title={`RETURNED: ${stats?.statusCounts.RETURNED ?? 0}`}
                />
                <div
                  className="bg-rose-500 h-full transition-all"
                  style={{
                    width: `${Math.round(((stats?.statusCounts.CANCELLED ?? 0) / statusTotal) * 100)}%`,
                  }}
                  title={`CANCELLED: ${stats?.statusCounts.CANCELLED ?? 0}`}
                />
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    key: 'RESERVED',
                    label: 'Đã đặt giữ chỗ (RESERVED)',
                    count: stats?.statusCounts.RESERVED ?? 0,
                    dot: 'bg-amber-500',
                  },
                  {
                    key: 'ACTIVE',
                    label: 'Đang thuê (ACTIVE)',
                    count: stats?.statusCounts.ACTIVE ?? 0,
                    dot: 'bg-blue-500',
                  },
                  {
                    key: 'RETURNED',
                    label: 'Đã hoàn trả (RETURNED)',
                    count: stats?.statusCounts.RETURNED ?? 0,
                    dot: 'bg-emerald-500',
                  },
                  {
                    key: 'CANCELLED',
                    label: 'Đã hủy (CANCELLED)',
                    count: stats?.statusCounts.CANCELLED ?? 0,
                    dot: 'bg-rose-500',
                  },
                ].map((row) => {
                  const pct =
                    (stats?.totalRentals ?? 0) > 0
                      ? Math.round((row.count / statusTotal) * 100)
                      : 0
                  return (
                    <div key={row.key} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                        <span className={`size-2.5 rounded-full ${row.dot}`} />
                        {row.label}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {row.count} đơn ({pct}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Tổng số đơn trong kỳ:</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">
                {stats?.totalRentals ?? totalRentals} đơn
              </span>
            </div>
          </div>
        </div>

        {/* Phase R: Bảng Điều phối Giao / Trả Giày Theo Ngày (Daily Dispatch & Return Board) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">event_note</span>
                Bảng Điều phối Giao / Trả Giày Theo Ngày
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Danh sách đơn cần giao giày, đơn đến hạn nhận trả và đơn đang quá hạn cần thu hồi
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleDate(toDateString(new Date()))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  scheduleDate === toDateString(new Date())
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setScheduleDate(toDateString(addDays(new Date(), 1)))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  scheduleDate === toDateString(addDays(new Date(), 1))
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Ngày mai
              </button>
              <input
                type="date"
                aria-label="Ngày điều phối"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              />
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Cần giao giày */}
            <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-amber-500" />
                  Cần giao giày ({scheduleData?.summary.pickupsCount ?? 0})
                </h4>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  RESERVED · {scheduleDate}
                </span>
              </div>

              {scheduleLoading ? (
                <p className="text-xs text-slate-400 py-6 text-center">Đang tải lịch giao…</p>
              ) : (scheduleData?.pickupsDue.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Không có đơn cần giao trong ngày này.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {(scheduleData?.pickupsDue ?? []).map((item) => (
                    <div
                      key={item.rentalId}
                      className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/rentals/${item.rentalId}`}
                          className="font-mono text-xs font-bold text-primary hover:underline"
                        >
                          #{item.rentalId}
                        </Link>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : item.paymentStatus === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.paymentStatus ? `MoMo ${item.paymentStatus}` : 'COD / Tại quầy'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-semibold">{item.customerName}</p>
                        <p className="text-slate-500">
                          SĐT: {item.customerPhone || '—'} · {item.totalItems} đôi
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          disabled={actionLoading === item.rentalId}
                          onClick={() => void handleDispatchActivate(item.rentalId)}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                        >
                          {actionLoading === item.rentalId ? 'Đang xử lý…' : 'Giao giày'}
                        </button>
                        <Link
                          to={`/admin/rentals/${item.rentalId}`}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Chi tiết →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Đến hạn nhận trả */}
            <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-blue-500" />
                  Đến hạn nhận trả ({scheduleData?.summary.returnsCount ?? 0})
                </h4>
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  ACTIVE · {scheduleDate}
                </span>
              </div>

              {scheduleLoading ? (
                <p className="text-xs text-slate-400 py-6 text-center">Đang tải lịch trả…</p>
              ) : (scheduleData?.returnsDue.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Không có đơn đến hạn trả trong ngày này.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {(scheduleData?.returnsDue ?? []).map((item) => (
                    <div
                      key={item.rentalId}
                      className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/rentals/${item.rentalId}`}
                          className="font-mono text-xs font-bold text-primary hover:underline"
                        >
                          #{item.rentalId}
                        </Link>
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Cọc: {formatCurrency(item.depositAmount)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-semibold">{item.customerName}</p>
                        <p className="text-slate-500">
                          SĐT: {item.customerPhone || '—'} · {item.totalItems} đôi
                        </p>
                      </div>
                      <div className="flex justify-end pt-1">
                        <Link
                          to={`/admin/rentals/${item.rentalId}`}
                          className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Kiểm định &amp; Nhận trả →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: Đang quá hạn */}
            <div className="rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-rose-500" />
                  Đang quá hạn ({scheduleData?.summary.overdueCount ?? 0})
                </h4>
                <Link
                  to="/admin/rentals?overdue=1"
                  className="text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:underline"
                >
                  Lọc tất cả quá hạn →
                </Link>
              </div>

              {scheduleLoading ? (
                <p className="text-xs text-slate-400 py-6 text-center">Đang tải danh sách…</p>
              ) : (scheduleData?.overdueActive.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Không có đơn thuê nào đang quá hạn.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {(scheduleData?.overdueActive ?? []).map((item) => (
                    <div
                      key={item.rentalId}
                      className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/rentals/${item.rentalId}`}
                          className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          #{item.rentalId}
                        </Link>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          Quá hạn {item.overdueDays} ngày (+{formatCurrency(item.estimatedLateFee)})
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-semibold">{item.customerName}</p>
                        <p className="text-slate-500">
                          SĐT: {item.customerPhone || '—'} · Hạn trả: {item.endDate}
                        </p>
                      </div>
                      <div className="flex justify-end pt-1">
                        <Link
                          to={`/admin/rentals/${item.rentalId}`}
                          className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Xử lý thu hồi →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phase N (Low-Stock Alerts + Quick Restock) & Phase P (Live Operations Audit Feed) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low-Stock Variant Alerts */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500">inventory</span>
                  Cảnh báo Tồn kho Thấp & Nhập nhanh
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các biến thể có số lượng khả dụng hôm nay ≤ 1 đôi
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  (stats?.lowStockVariants?.length ?? 0) > 0
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                }`}
              >
                {(stats?.lowStockVariants?.length ?? 0) > 0
                  ? `${stats?.lowStockVariants?.length} biến thể cần chú ý`
                  : 'Đủ hàng'}
              </span>
            </div>

            <div className="p-6 flex-1 max-h-[420px] overflow-y-auto">
              {(stats?.lowStockVariants?.length ?? 0) === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
                  <span className="material-symbols-outlined text-3xl text-emerald-500">
                    verified
                  </span>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Tất cả biến thể giày đều đủ tồn kho khả dụng hôm nay (&gt; 1 đôi).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(stats?.lowStockVariants ?? []).map((v) => (
                    <div
                      key={v.variantId}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/shoes/${v.shoeId}/edit`}
                            className="font-bold text-sm text-slate-900 dark:text-white hover:text-primary transition-colors"
                          >
                            {v.shoeName}
                          </Link>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            Size EU {v.size} · {v.color}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>Tồn kho: <strong>{v.totalQuantity}</strong></span>
                          <span>Đang giữ: <strong>{v.reservedToday}</strong></span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              v.availableToday === 0
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            Khả dụng hôm nay: {v.availableToday} đôi
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={restockLoadingId !== null}
                          onClick={() => void handleQuickRestock(v, 1)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {restockLoadingId === `${v.variantId}:1` ? '...' : '+1 đôi'}
                        </button>
                        <button
                          type="button"
                          disabled={restockLoadingId !== null}
                          onClick={() => void handleQuickRestock(v, 5)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {restockLoadingId === `${v.variantId}:5` ? '...' : '+5 đôi'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Operations Audit Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">bolt</span>
                    Nhật ký Vận hành Thời gian thực
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tổng hợp luồng sự kiện Đặt đơn, MoMo, Giao/Trả giày & Đánh giá mới nhất
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {feedEvents.length} sự kiện
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bộ lọc sự kiện vận hành">
                {(
                  [
                    { value: 'ALL', label: 'Tất cả (ALL)' },
                    { value: 'RESERVED', label: 'Đặt đơn' },
                    { value: 'MOMO', label: 'MoMo' },
                    { value: 'ACTIVE', label: 'Giao giày' },
                    { value: 'RETURNED', label: 'Trả giày' },
                    { value: 'CANCELLED', label: 'Đã hủy' },
                    { value: 'REVIEW', label: 'Đánh giá' },
                  ] as { value: ActivityFeedFilterType; label: string }[]
                ).map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => void handleFeedFilterChange(pill.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                      feedFilter === pill.value
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 flex-1 max-h-[420px] overflow-y-auto">
              {feedLoading ? (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                  Đang tải nhật ký sự kiện…
                </div>
              ) : feedEvents.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                  Chưa có sự kiện nào thuộc bộ lọc này.
                </div>
              ) : (
                <div className="space-y-3">
                  {feedEvents.map((ev) => {
                    const badgeMeta =
                      ev.type === 'MOMO_PAID'
                        ? {
                            icon: 'paid',
                            cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                          }
                        : ev.type === 'MOMO_EXPIRED' || ev.type === 'CANCELLED'
                          ? {
                              icon: ev.type === 'MOMO_EXPIRED' ? 'timer_off' : 'cancel',
                              cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
                            }
                          : ev.type === 'RETURNED'
                            ? {
                                icon: 'assignment_turned_in',
                                cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                              }
                            : ev.type === 'ACTIVE'
                              ? {
                                  icon: 'directions_walk',
                                  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                                }
                              : ev.type === 'REVIEW'
                                ? {
                                    icon: 'star',
                                    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                                  }
                                : {
                                    icon: 'event_available',
                                    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                                  }

                    return (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${badgeMeta.cls}`}>
                            <span className="material-symbols-outlined text-base leading-none">
                              {badgeMeta.icon}
                            </span>
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {ev.title}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {ev.subtitle}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                              <span>{formatDate(ev.timestamp)}</span>
                              {ev.amountVnd !== null && (
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                  · {formatCurrency(ev.amountVnd)}
                                </span>
                              )}
                              {ev.rating !== null && (
                                <span className="font-bold text-amber-500">
                                  · {ev.rating} ★
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Link
                          to={ev.link}
                          className="text-xs font-bold text-primary hover:underline shrink-0"
                        >
                          Chi tiết →
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {stats?.topShoes && stats.topShoes.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">hotel_class</span>
                <h3 className="font-bold text-lg">Top Mẫu Giày Được Thuê Nhiều Nhất</h3>
              </div>
              <span className="text-xs text-slate-500">Theo lượt thuê và số đôi thực tế</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Hạng
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tên giày
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                      Số đơn
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                      Số đôi đã thuê
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                      Đánh giá TB
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.topShoes.map((shoe, idx) => (
                    <tr
                      key={shoe.shoeId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-sm text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="px-6 py-4 font-semibold text-sm">
                        <Link
                          to={`/shoes/${shoe.shoeId}`}
                          className="hover:text-primary transition-colors"
                        >
                          {shoe.shoeName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-slate-600 dark:text-slate-300">
                        {shoe.totalRentalsCount} đơn
                      </td>
                      <td className="px-6 py-4 text-sm text-center font-bold text-primary">
                        {shoe.totalUnitsRented} đôi
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-amber-500">
                        {shoe.averageRating !== null && shoe.averageRating !== undefined
                          ? `${shoe.averageRating.toFixed(1)} ★`
                          : 'Chưa có'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-lg">Recent Rentals</h3>
            <Link to="/admin/rentals" className="text-primary text-sm font-bold hover:underline">
              View All
            </Link>
          </div>
          {actionError && (
            <div className="mx-6 mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {actionError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentRentals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No rentals yet
                    </td>
                  </tr>
                ) : (
                  recentRentals.map((r) => (
                    <RentalRow
                      key={r.rentalId}
                      rental={r}
                      customerName={customerMap[r.customerId]?.fullName ?? r.customerId}
                      onActivate={() => handleAction(r.rentalId, 'activate')}
                      onReturn={() => navigate(`/admin/rentals/${r.rentalId}`)}
                      onCancel={() => handleAction(r.rentalId, 'cancel')}
                      loading={actionLoading === r.rentalId}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              Showing 1 to {recentRentals.length} of {rentals.length} rentals
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

type RentalRowProps = {
  rental: RentalSummary
  customerName: string
  onActivate: () => void
  onReturn: () => void
  onCancel: () => void
  loading: boolean
}

function RentalRow({
  rental,
  customerName,
  onActivate,
  onReturn,
  onCancel,
  loading,
}: RentalRowProps) {
  const canActivate = rental.status === 'RESERVED'
  const canReturn = rental.status === 'ACTIVE'
  const canCancel = rental.status === 'RESERVED'

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="px-6 py-4">
        <Link
          to={`/admin/rentals/${rental.rentalId}`}
          className="flex items-center gap-3 hover:text-primary"
        >
          <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
            {customerName.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold">{customerName}</span>
        </Link>
      </td>
      <td className="px-6 py-4 text-sm">{rental.totalItems} item(s)</td>
      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(rental.startDate)}</td>
      <td className="px-6 py-4 text-sm text-slate-500">
        <div>{formatDurationDays(rental.startDate, rental.endDate)}</div>
        {rental.isOverdue && (rental.overdueDays ?? 0) > 0 && (
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            Quá hạn {rental.overdueDays}d (+{formatCurrency(rental.estimatedLateFee ?? 0)})
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        <RentalStatusBadge status={rental.status} />
      </td>
      <td className="px-6 py-4 text-sm font-bold">{formatCurrency(rental.totalAmount)}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {canActivate && (
            <button
              type="button"
              onClick={onActivate}
              disabled={loading}
              className="p-1 hover:text-green-600 transition-colors disabled:opacity-50"
              title="Activate"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
            </button>
          )}
          {canReturn && (
            <button
              type="button"
              onClick={onReturn}
              disabled={loading}
              className="p-1 hover:text-blue-600 transition-colors disabled:opacity-50"
              title="Return"
            >
              <span className="material-symbols-outlined text-lg">assignment_return</span>
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="p-1 hover:text-red-600 transition-colors disabled:opacity-50"
              title="Cancel"
            >
              <span className="material-symbols-outlined text-lg">cancel</span>
            </button>
          )}
          {(rental.status === 'RETURNED' || rental.status === 'CANCELLED') && (
            <Link
              to={`/admin/rentals/${rental.rentalId}`}
              className="p-1 text-slate-400 hover:text-primary transition-colors"
              title="View details"
            >
              <span className="material-symbols-outlined text-lg">visibility</span>
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}
