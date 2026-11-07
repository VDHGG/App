import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listRentals,
  activateRental,
  returnRental,
  cancelRental,
  extendRentalAdmin,
  deleteRentalAdmin,
  type ListRentalsQuery,
} from '../../lib/rentals.api'
import type { RentalSummary, RentalStatus } from '../../lib/rentals.api'
import {
  fetchMomoPaymentStatuses,
  type MomoPaymentStatusRecord,
} from '../../lib/payments.api'
import { listCustomers } from '../../lib/customers.api'
import type { CustomerSummary } from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatDate, formatCurrency, formatDurationDays } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'

const STATUS_OPTIONS: { value: '' | RentalStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const AMOUNT_OPTIONS: { value: ListRentalsQuery['amountBucket']; label: string }[] = [
  { value: 'all', label: 'All amounts' },
  { value: 'lt50', label: 'Under 1.000.000₫' },
  { value: '50to150', label: '1.000.000₫ – 2.000.000₫' },
  { value: '150to300', label: '2.000.000₫ – 3.500.000₫' },
  { value: 'gt300', label: 'Over 3.500.000₫' },
]

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

function nextDayDateString(isoDate: string): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + 1)
  return toDateString(d)
}

export function RentalsListPage() {
  const [rentals, setRentals] = useState<RentalSummary[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | RentalStatus>('')
  const [startDateFrom, setStartDateFrom] = useState('')
  const [startDateTo, setStartDateTo] = useState('')
  const [amountBucket, setAmountBucket] = useState<NonNullable<ListRentalsQuery['amountBucket']>>(
    'all'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDeleteRental, setConfirmDeleteRental] = useState<RentalSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [listMeta, setListMeta] = useState({
    total: 0,
    totalPages: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  // MoMo payment statuses & extend rental state
  const [paymentMap, setPaymentMap] = useState<Record<string, MomoPaymentStatusRecord>>({})
  const [extendRentalTarget, setExtendRentalTarget] = useState<RentalSummary | null>(null)
  const [extendNewEndDate, setExtendNewEndDate] = useState('')
  const [extendNote, setExtendNote] = useState('')
  const [extendLoading, setExtendLoading] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)

  const customerMap = Object.fromEntries(customers.map((c) => [c.customerId, c]))

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search])

  const rentalQuery = useMemo((): ListRentalsQuery => {
    const q: ListRentalsQuery = { page, pageSize: DEFAULT_PAGE_SIZE }
    if (statusFilter) q.status = statusFilter
    if (startDateFrom) q.startDateFrom = startDateFrom
    if (startDateTo) q.startDateTo = startDateTo
    if (amountBucket && amountBucket !== 'all') q.amountBucket = amountBucket
    if (search.trim()) q.search = search.trim()
    return q
  }, [statusFilter, startDateFrom, startDateTo, amountBucket, page, search])

  useEffect(() => {
    Promise.all([listRentals(rentalQuery), listCustomers()])
      .then(async ([rentalsRes, customersRes]) => {
        setRentals(rentalsRes.rentals)
        setListMeta({
          total: rentalsRes.total,
          totalPages: rentalsRes.totalPages,
          pageSize: rentalsRes.pageSize,
        })
        setCustomers(customersRes.customers)

        if (rentalsRes.rentals.length > 0) {
          try {
            const payStatuses = await fetchMomoPaymentStatuses(
              rentalsRes.rentals.map((r) => r.rentalId)
            )
            setPaymentMap(payStatuses.payments)
          } catch {
            // ignore payment status error
          }
        }
      })
      .catch((err) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [rentalQuery])

  const openExtend = (r: RentalSummary) => {
    setExtendRentalTarget(r)
    setExtendNewEndDate(nextDayDateString(r.endDate))
    setExtendNote('')
    setExtendError(null)
  }

  const closeExtend = () => {
    setExtendRentalTarget(null)
    setExtendError(null)
  }

  const confirmExtend = async () => {
    if (!extendRentalTarget || !extendNewEndDate) return
    setExtendLoading(true)
    setExtendError(null)
    try {
      await extendRentalAdmin(extendRentalTarget.rentalId, {
        newEndDate: extendNewEndDate,
        note: extendNote.trim() || undefined,
      })
      closeExtend()
      const res = await listRentals(rentalQuery)
      setRentals(res.rentals)
    } catch (err: unknown) {
      setExtendError(getApiErrorMessage(err))
    } finally {
      setExtendLoading(false)
    }
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
      const res = await listRentals(rentalQuery)
      setRentals(res.rentals)
      setListMeta({
        total: res.total,
        totalPages: res.totalPages,
        pageSize: res.pageSize,
      })
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(null)
    }
  }

  const confirmDeleteRentalAction = async () => {
    if (!confirmDeleteRental) return
    setDeleteLoading(true)
    setActionError(null)
    try {
      await deleteRentalAdmin(confirmDeleteRental.rentalId)
      setConfirmDeleteRental(null)
      const res = await listRentals(rentalQuery)
      setRentals(res.rentals)
      setListMeta({
        total: res.total,
        totalPages: res.totalPages,
        pageSize: res.pageSize,
      })
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Rentals" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <AdminHeader title="Rentals" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Rentals" />
      <div className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 lg:items-end lg:justify-between">
            <div className="flex flex-col sm:flex-row flex-wrap gap-4">
              <div className="flex flex-col gap-1 min-w-[200px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Search
                </span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Rental id or customer name…"
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-medium min-w-[220px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1)
                    setStatusFilter((e.target.value || '') as '' | RentalStatus)
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold min-w-[160px]"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Start date from
                </span>
                <input
                  type="date"
                  value={startDateFrom}
                  onChange={(e) => {
                    setPage(1)
                    setStartDateFrom(e.target.value)
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Start date to
                </span>
                <input
                  type="date"
                  value={startDateTo}
                  onChange={(e) => {
                    setPage(1)
                    setStartDateTo(e.target.value)
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total amount
                </span>
                <select
                  value={amountBucket}
                  onChange={(e) => {
                    setPage(1)
                    setAmountBucket(e.target.value as NonNullable<ListRentalsQuery['amountBucket']>)
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold min-w-[180px]"
                >
                  {AMOUNT_OPTIONS.map((opt) => (
                    <option key={opt.value ?? 'all'} value={opt.value ?? 'all'}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-slate-500 lg:text-right shrink-0">
              {listMeta.total} rental(s) total
            </p>
          </div>
        </div>

        {actionError && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {actionError}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Rental
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Start
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Payment
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
                {rentals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      No rentals found
                    </td>
                  </tr>
                ) : (
                  rentals.map((r) => (
                    <tr
                      key={r.rentalId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/rentals/${r.rentalId}`}
                          className="font-mono text-sm font-semibold text-primary hover:underline"
                        >
                          {r.rentalId}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                            {(customerMap[r.customerId]?.fullName ?? r.customerId)
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold">
                            {customerMap[r.customerId]?.fullName ?? r.customerId}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{r.totalItems} item(s)</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDate(r.startDate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {formatDurationDays(r.startDate, r.endDate)}
                      </td>
                      <td className="px-6 py-4">
                        <RentalStatusBadge status={r.status} />
                      </td>
                      <td className="px-6 py-4">
                        {paymentMap[r.rentalId]?.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            MoMo PAID
                          </span>
                        ) : paymentMap[r.rentalId]?.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            MoMo PENDING
                          </span>
                        ) : paymentMap[r.rentalId]?.status === 'EXPIRED' || paymentMap[r.rentalId]?.status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                            <span className="size-1.5 rounded-full bg-rose-500" />
                            MoMo {paymentMap[r.rentalId]?.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            COD / Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">
                        {formatCurrency(r.totalAmount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {r.status === 'RESERVED' && (
                            <button
                              type="button"
                              onClick={() => handleAction(r.rentalId, 'activate')}
                              disabled={actionLoading === r.rentalId}
                              className="p-1 hover:text-green-600 transition-colors disabled:opacity-50"
                              title="Activate"
                            >
                              <span className="material-symbols-outlined text-lg">
                                check_circle
                              </span>
                            </button>
                          )}
                          {r.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleAction(r.rentalId, 'return')}
                              disabled={actionLoading === r.rentalId}
                              className="p-1 hover:text-blue-600 transition-colors disabled:opacity-50"
                              title="Return"
                            >
                              <span className="material-symbols-outlined text-lg">
                                assignment_return
                              </span>
                            </button>
                          )}
                          {(r.status === 'RESERVED' || r.status === 'ACTIVE') && (
                            <button
                              type="button"
                              onClick={() => openExtend(r)}
                              className="p-1 hover:text-indigo-600 transition-colors"
                              title="Gia hạn thời gian thuê"
                            >
                              <span className="material-symbols-outlined text-lg">
                                edit_calendar
                              </span>
                            </button>
                          )}
                          {r.status === 'RESERVED' && (
                            <button
                              type="button"
                              onClick={() => handleAction(r.rentalId, 'cancel')}
                              disabled={actionLoading === r.rentalId}
                              className="p-1 hover:text-red-600 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <span className="material-symbols-outlined text-lg">cancel</span>
                            </button>
                          )}
                          <Link
                            to={`/admin/rentals/${r.rentalId}`}
                            className="p-1 text-slate-400 hover:text-primary transition-colors"
                            title="View details"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRental(r)}
                            disabled={actionLoading === r.rentalId || deleteLoading}
                            className="p-1 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Delete permanently"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <AdminPagination
              page={page}
              totalPages={listMeta.totalPages}
              total={listMeta.total}
              pageSize={listMeta.pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      </div>

      {extendRentalTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Gia hạn đơn thuê {extendRentalTarget.rentalId}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Ngày trả hiện tại: <strong>{formatDate(extendRentalTarget.endDate)}</strong>. Chọn ngày trả mới sau ngày này.
            </p>
            {extendError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-3 py-2">
                {extendError}
              </div>
            )}
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ngày trả mới
                </label>
                <input
                  type="date"
                  value={extendNewEndDate}
                  min={nextDayDateString(extendRentalTarget.endDate)}
                  onChange={(e) => setExtendNewEndDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="admin-extend-note" className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ghi chú (tùy chọn)
                </label>
                <textarea
                  id="admin-extend-note"
                  value={extendNote}
                  onChange={(e) => setExtendNote(e.target.value)}
                  maxLength={255}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  placeholder="Lý do gia hạn…"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeExtend}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={extendLoading || !extendNewEndDate}
                onClick={() => void confirmExtend()}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {extendLoading ? 'Đang gia hạn…' : 'Xác nhận gia hạn'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteRental !== null}
        title="Xóa đơn thuê?"
        message={
          confirmDeleteRental
            ? `Xóa vĩnh viễn đơn ${confirmDeleteRental.rentalId}? Hành động này không thể hoàn tác (gồm cả lịch sử thanh toán liên quan trong DB).`
            : ''
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        danger
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setConfirmDeleteRental(null)}
        onConfirm={() => void confirmDeleteRentalAction()}
      />
    </>
  )
}
