import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchAdminMomoPayments,
  exportMomoPaymentsToCsv,
  type AdminMomoPaymentDto,
  type AdminMomoPaymentsSummaryDto,
} from '../../lib/payments.api'
import { sweepExpiredMomoRentals, type RentalStatus } from '../../lib/rentals.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatCurrency, formatDate } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

type PaymentFilterStatus = 'ALL' | 'PAID' | 'PENDING' | 'EXPIRED' | 'FAILED' | 'CANCELLED'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<PaymentFilterStatus>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [payments, setPayments] = useState<AdminMomoPaymentDto[]>([])
  const [summary, setSummary] = useState<AdminMomoPaymentsSummaryDto>({
    totalTransactions: 0,
    paidCount: 0,
    pendingCount: 0,
    expiredOrFailedCount: 0,
    totalPaidVnd: 0,
    totalPendingVnd: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sweepLoading, setSweepLoading] = useState(false)
  const [sweepMessage, setSweepMessage] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchAdminMomoPayments({
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
        limit: 100,
      })
      setPayments(res.payments)
      setSummary(res.summary)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const handleSweepExpiredMomo = async () => {
    setSweepLoading(true)
    setSweepMessage(null)
    setError(null)
    try {
      const res = await sweepExpiredMomoRentals()
      setSweepMessage(`Đã quét và giải phóng ${res.sweptCount} đơn treo MoMo quá 15 phút.`)
      await loadPayments()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setSweepLoading(false)
    }
  }

  return (
    <>
      <AdminHeader title="MoMo Payments" />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#A50064]">payments</span>
              Trung tâm Đối soát Giao dịch MoMo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Đối soát giao dịch cổng thanh toán MoMo &amp; quản lý trạng thái IPN theo thời gian thực
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sweepLoading}
              onClick={() => void handleSweepExpiredMomo()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">timer_off</span>
              {sweepLoading ? 'Đang quét…' : 'Quét đơn chờ quá 15p'}
            </button>
            <button
              type="button"
              disabled={payments.length === 0}
              onClick={() => exportMomoPaymentsToCsv(payments, toDateString(new Date()))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Xuất CSV Đối soát
            </button>
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

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tổng thực thu MoMo (PAID)
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
              {formatCurrency(summary.totalPaidVnd)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Đã xác nhận chữ ký HMAC-SHA256
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Giao dịch thành công
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
              {summary.paidCount} GD
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Trên tổng số {summary.totalTransactions} giao dịch
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Đang chờ thanh toán (PENDING)
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
              {summary.pendingCount} GD
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Giá trị chờ: {formatCurrency(summary.totalPendingVnd)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Hết hạn / Thất bại
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
              {summary.expiredOrFailedCount} GD
            </p>
            <p className="text-xs text-slate-500 mt-1">
              EXPIRED, FAILED hoặc CANCELLED
            </p>
          </div>
        </div>

        {/* Filter Bar & Table */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bộ lọc trạng thái thanh toán MoMo">
              {(
                [
                  { value: 'ALL', label: 'Tất cả (ALL)' },
                  { value: 'PAID', label: 'PAID' },
                  { value: 'PENDING', label: 'PENDING' },
                  { value: 'EXPIRED', label: 'EXPIRED' },
                  { value: 'FAILED', label: 'FAILED' },
                  { value: 'CANCELLED', label: 'CANCELLED' },
                ] as { value: PaymentFilterStatus; label: string }[]
              ).map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === pill.value
                      ? 'bg-[#A50064] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="w-full lg:w-80">
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Mã GD MoMo, mã đơn thuê, tên khách..."
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Mã GD MoMo
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Đơn thuê
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Khách hàng
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Số tiền (VND)
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Trạng thái thanh toán
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Thời gian tạo / Thanh toán
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                      Đang tải danh sách giao dịch MoMo…
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                      Không có giao dịch MoMo nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.paymentId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {p.gatewayOrderId}
                        </p>
                        {p.gatewayTransId && (
                          <p className="font-mono text-[11px] text-slate-500">
                            Trans: {p.gatewayTransId}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/admin/rentals/${p.rentalId}`}
                            className="font-mono text-xs font-bold text-primary hover:underline"
                          >
                            #{p.rentalId}
                          </Link>
                          <RentalStatusBadge status={p.rentalStatus as RentalStatus} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/customers/${p.customerId}`}
                          className="text-sm font-semibold text-slate-900 dark:text-white hover:text-primary"
                        >
                          {p.customerName}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {p.customerPhone ?? p.customerId}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-sm text-slate-900 dark:text-white">
                        {formatCurrency(p.amountVnd)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            p.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : p.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              p.status === 'PAID'
                                ? 'bg-emerald-500'
                                : p.status === 'PENDING'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }`}
                          />
                          MoMo {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        <div>Tạo: {formatDate(p.createdAt)}</div>
                        {p.paidAt && (
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            TT: {formatDate(p.paidAt)}
                          </div>
                        )}
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
