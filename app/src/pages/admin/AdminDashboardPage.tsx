import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listRentals,
  activateRental,
  returnRental,
  cancelRental,
  fetchAdminStatsOverview,
  type RentalSummary,
  type AdminStatsOverviewResponse,
} from '../../lib/rentals.api'
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

export function AdminDashboardPage() {
  const [rentals, setRentals] = useState<RentalSummary[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [stats, setStats] = useState<AdminStatsOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const customerMap = Object.fromEntries(customers.map((c) => [c.customerId, c]))

  useEffect(() => {
    Promise.all([
      listRentals(),
      listCustomers(),
      fetchAdminStatsOverview().catch(() => null),
    ])
      .then(([rentalsRes, customersRes, statsRes]) => {
        setRentals(rentalsRes.rentals)
        setCustomers(customersRes.customers)
        setStats(statsRes)
      })
      .catch((err) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const totalRentals = rentals.length
  const pendingReturns = rentals.filter((r) => r.status === 'ACTIVE').length
  const revenue = rentals
    .filter((r) => r.status === 'RETURNED')
    .reduce((sum, r) => sum + r.totalAmount, 0)
  const recentRentals = rentals.slice(0, RECENT_LIMIT)

  const handleExportCsv = () => {
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
      'Tổng tiền (VND)',
      'Tiền cọc (VND)',
    ]
    const escapeCell = (v: string | number) => {
      const s = String(v ?? '')
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }
    const rows = rentals.map((r) => [
      r.rentalId,
      r.customerId,
      customerMap[r.customerId]?.fullName ?? r.customerId,
      r.totalItems,
      r.startDate.slice(0, 10),
      r.endDate.slice(0, 10),
      r.status,
      r.overdueDays ?? 0,
      r.basePrice,
      r.totalAmount,
      r.depositAmount ?? r.totalItems * 500000,
    ])
    const csvContent =
      '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rentals-report-${toDateString(new Date())}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleAction = async (
    rentalId: string,
    action: 'activate' | 'return' | 'cancel'
  ) => {
    if (!confirmRentalAction(action)) return
    setActionLoading(rentalId)
    setActionError(null)
    try {
      if (action === 'activate') await activateRental(rentalId)
      else if (action === 'return') await returnRental(rentalId)
      else await cancelRental(rentalId)
      const [res, statsRes] = await Promise.all([
        listRentals(),
        fetchAdminStatsOverview().catch(() => null),
      ])
      setRentals(res.rentals)
      setStats(statsRes)
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

  return (
    <>
      <AdminHeader title="Dashboard Overview" />
      <div className="p-6 lg:p-8 space-y-8 max-w-[1400px]">
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
                      onReturn={() => handleAction(r.rentalId, 'return')}
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
