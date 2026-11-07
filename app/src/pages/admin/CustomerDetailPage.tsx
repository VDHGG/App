import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getCustomer,
  updateCustomerAdmin,
  type CustomerRank,
  type GetCustomerResponse,
} from '../../lib/customers.api'
import {
  listRentals,
  type RentalSummary,
  type RentalStatus,
} from '../../lib/rentals.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatCurrency, formatDate } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

const RANKS: CustomerRank[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']

const RANK_META: Record<
  CustomerRank,
  { label: string; discountPct: number; badgeClass: string; threshold: number }
> = {
  BRONZE: {
    label: 'BRONZE',
    discountPct: 0,
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    threshold: 0,
  },
  SILVER: {
    label: 'SILVER',
    discountPct: 5,
    badgeClass: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    threshold: 2_000_000,
  },
  GOLD: {
    label: 'GOLD',
    discountPct: 10,
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    threshold: 5_000_000,
  },
  DIAMOND: {
    label: 'DIAMOND',
    discountPct: 15,
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    threshold: 10_000_000,
  },
}

type StatusFilter = 'ALL' | RentalStatus

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<GetCustomerResponse | null>(null)
  const [rentals, setRentals] = useState<RentalSummary[]>([])
  const [selectedRank, setSelectedRank] = useState<CustomerRank>('BRONZE')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    Promise.all([
      getCustomer(id),
      listRentals({ customerId: id, page: 1, pageSize: 50 }),
    ])
      .then(([custRes, rentalsRes]) => {
        setCustomer(custRes)
        setSelectedRank(custRes.rank)
        setRentals(rentalsRes.rentals)
      })
      .catch((err: unknown) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  const totalSpentReturned = useMemo(
    () =>
      rentals
        .filter((r) => r.status === 'RETURNED')
        .reduce((sum, r) => sum + r.totalAmount, 0),
    [rentals]
  )

  const overdueRentals = useMemo(
    () => rentals.filter((r) => Boolean(r.isOverdue)),
    [rentals]
  )

  const totalEstimatedLateFees = useMemo(
    () =>
      overdueRentals.reduce((sum, r) => sum + (r.estimatedLateFee ?? 0), 0),
    [overdueRentals]
  )

  const statusBreakdown = useMemo(() => {
    const counts = {
      RESERVED: 0,
      ACTIVE: 0,
      RETURNED: 0,
      CANCELLED: 0,
    }
    for (const r of rentals) {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    }
    return counts
  }, [rentals])

  const filteredRentals = useMemo(() => {
    if (statusFilter === 'ALL') return rentals
    return rentals.filter((r) => r.status === statusFilter)
  }, [rentals, statusFilter])

  const tierProgress = useMemo(() => {
    if (!customer) {
      return {
        nextRank: 'SILVER' as CustomerRank | null,
        targetAmount: 2_000_000,
        percent: 0,
        remainingAmount: 2_000_000,
      }
    }
    if (customer.rank === 'DIAMOND' || totalSpentReturned >= 10_000_000) {
      return {
        nextRank: null,
        targetAmount: 10_000_000,
        percent: 100,
        remainingAmount: 0,
      }
    }
    if (totalSpentReturned < 2_000_000 && customer.rank === 'BRONZE') {
      const pct = Math.min(100, Math.round((totalSpentReturned / 2_000_000) * 100))
      return {
        nextRank: 'SILVER' as CustomerRank,
        targetAmount: 2_000_000,
        percent: pct,
        remainingAmount: Math.max(0, 2_000_000 - totalSpentReturned),
      }
    }
    if (totalSpentReturned < 5_000_000 && (customer.rank === 'BRONZE' || customer.rank === 'SILVER')) {
      const pct = Math.min(100, Math.round((totalSpentReturned / 5_000_000) * 100))
      return {
        nextRank: 'GOLD' as CustomerRank,
        targetAmount: 5_000_000,
        percent: pct,
        remainingAmount: Math.max(0, 5_000_000 - totalSpentReturned),
      }
    }
    const pct = Math.min(100, Math.round((totalSpentReturned / 10_000_000) * 100))
    return {
      nextRank: 'DIAMOND' as CustomerRank,
      targetAmount: 10_000_000,
      percent: pct,
      remainingAmount: Math.max(0, 10_000_000 - totalSpentReturned),
    }
  }, [customer, totalSpentReturned])

  const handleUpdateRank = async () => {
    if (!customer) return
    setActionLoading(true)
    setActionError(null)
    setActionMessage(null)
    try {
      const updated = await updateCustomerAdmin(customer.customerId, {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        rank: selectedRank,
        isActive: customer.isActive,
      })
      setCustomer(updated)
      setSelectedRank(updated.rank)
      setActionMessage(`Đã cập nhật hạng thành viên sang ${updated.rank}.`)
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async () => {
    if (!customer) return
    setActionLoading(true)
    setActionError(null)
    setActionMessage(null)
    try {
      const nextActive = !customer.isActive
      const updated = await updateCustomerAdmin(customer.customerId, {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        rank: customer.rank,
        isActive: nextActive,
      })
      setCustomer(updated)
      setActionMessage(
        updated.isActive
          ? 'Đã mở khóa tài khoản khách hàng.'
          : 'Đã khóa tài khoản khách hàng.'
      )
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Hồ sơ Khách hàng 360°" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error || !customer) {
    return (
      <>
        <AdminHeader title="Hồ sơ Khách hàng 360°" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error ?? 'Không tìm thấy khách hàng'}</p>
          <Link to="/admin/customers" className="text-primary hover:underline">
            ← Quay lại danh sách khách hàng
          </Link>
        </div>
      </>
    )
  }

  const currentRankMeta = RANK_META[customer.rank]

  return (
    <>
      <AdminHeader title="Hồ sơ Khách hàng 360°" />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <nav className="flex items-center justify-between">
          <Link
            to="/admin/customers"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Quay lại danh sách khách hàng
          </Link>
        </nav>

        {actionMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center justify-between">
            <span>{actionMessage}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-xs underline ml-4"
            >
              Đóng
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold">
            {actionError}
          </div>
        )}

        {/* Header & Quick Admin Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="size-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-black text-xl shrink-0">
                {customer.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {customer.fullName}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      customer.isActive
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                    }`}
                  >
                    {customer.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${currentRankMeta.badgeClass}`}>
                    Hạng {currentRankMeta.label} (-{currentRankMeta.discountPct}%)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    ID: {customer.customerId}
                  </span>
                  <span>Email: {customer.email}</span>
                  <span>SĐT: {customer.phone ?? 'Chưa cập nhật'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <select
                  aria-label="Chọn hạng thành viên"
                  value={selectedRank}
                  onChange={(e) => setSelectedRank(e.target.value as CustomerRank)}
                  disabled={actionLoading}
                  className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r}>
                      {r} (-{RANK_META[r].discountPct}%)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleUpdateRank()}
                  disabled={actionLoading || selectedRank === customer.rank}
                  className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  Cập nhật hạng
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleToggleActive()}
                disabled={actionLoading}
                className={`h-10 px-4 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                  customer.isActive
                    ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
                    : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                {customer.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
              </button>
            </div>
          </div>
        </div>

        {/* Membership Rank & Tier Progress Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Tiến trình Hạng Thành viên & Ưu đãi
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Hạng hiện tại:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {customer.rank} (Giảm {currentRankMeta.discountPct}% mọi đơn thuê)
                </strong>
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              {tierProgress.nextRank === null ? (
                <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                  100% — Đã đạt hạng cao nhất DIAMOND (-15%)
                </span>
              ) : (
                <span>
                  Còn <strong>{formatCurrency(tierProgress.remainingAmount)}</strong> để lên hạng{' '}
                  <strong>{tierProgress.nextRank}</strong> (Mốc {formatCurrency(tierProgress.targetAmount)})
                </span>
              )}
            </div>
          </div>

          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${tierProgress.percent}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3 text-[11px] text-slate-500 font-semibold">
            <div>BRONZE: 0₫ (0%)</div>
            <div className="text-center">SILVER: 2.000.000₫ (-5%)</div>
            <div className="text-center">GOLD: 5.000.000₫ (-10%)</div>
            <div className="text-right">DIAMOND: 10.000.000₫ (-15%)</div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tổng chi tiêu hoàn tất (RETURNED)
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
              {formatCurrency(totalSpentReturned)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Từ {statusBreakdown.RETURNED} đơn đã hoàn trả
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Số đôi đang giữ
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
              {customer.currentRentedItems} đôi
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Đang trong các đơn RESERVED / ACTIVE
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Đơn đang quá hạn
            </p>
            <p
              className={`text-2xl font-bold mt-2 ${
                overdueRentals.length > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {overdueRentals.length} đơn
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Phí phạt dự kiến: +{formatCurrency(totalEstimatedLateFees)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tổng số đơn thuê
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {rentals.length} đơn
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Đặt: {statusBreakdown.RESERVED} · Thuê: {statusBreakdown.ACTIVE} · Trả: {statusBreakdown.RETURNED} · Hủy: {statusBreakdown.CANCELLED}
            </p>
          </div>
        </div>

        {/* Full Rental History Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Lịch sử Đơn thuê của Khách hàng
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hiển thị {filteredRentals.length} / {rentals.length} đơn thuê
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc trạng thái đơn thuê">
              {(
                [
                  { value: 'ALL', label: `Tất cả (${rentals.length})` },
                  { value: 'RESERVED', label: `RESERVED (${statusBreakdown.RESERVED})` },
                  { value: 'ACTIVE', label: `ACTIVE (${statusBreakdown.ACTIVE})` },
                  { value: 'RETURNED', label: `RETURNED (${statusBreakdown.RETURNED})` },
                  { value: 'CANCELLED', label: `CANCELLED (${statusBreakdown.CANCELLED})` },
                ] as { value: StatusFilter; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === pill.value
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Mã đơn
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ngày thuê — Ngày hẹn trả
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Số đôi
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tiền cọc
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tổng tiền
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRentals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">
                      Chưa có đơn thuê nào trong trạng thái này.
                    </td>
                  </tr>
                ) : (
                  filteredRentals.map((r) => (
                    <tr
                      key={r.rentalId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-sm font-bold text-slate-900 dark:text-white">
                        <Link
                          to={`/admin/rentals/${r.rentalId}`}
                          className="hover:text-primary transition-colors"
                        >
                          {r.rentalId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {formatDate(r.startDate)} → {formatDate(r.endDate)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        {r.totalItems} đôi
                      </td>
                      <td className="px-6 py-4 text-sm text-amber-700 dark:text-amber-400 font-semibold">
                        {formatCurrency(r.depositAmount ?? r.totalItems * 500_000)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(r.totalAmount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <RentalStatusBadge status={r.status} />
                          {r.isOverdue && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                              QUÁ HẠN {r.overdueDays ? `${r.overdueDays}d` : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/rentals/${r.rentalId}`}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          Chi tiết →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
