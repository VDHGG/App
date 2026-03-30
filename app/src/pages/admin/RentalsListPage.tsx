import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listRentals,
  activateRental,
  returnRental,
  cancelRental,
  type ListRentalsQuery,
} from '../../lib/rentals.api'
import type { RentalSummary, RentalStatus } from '../../lib/rentals.api'
import { listCustomers } from '../../lib/customers.api'
import type { CustomerSummary } from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatDate, formatCurrency, formatDurationDays } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

const STATUS_OPTIONS: { value: '' | RentalStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const AMOUNT_OPTIONS: { value: ListRentalsQuery['amountBucket']; label: string }[] = [
  { value: 'all', label: 'All amounts' },
  { value: 'lt50', label: 'Under $50' },
  { value: '50to150', label: '$50 – $150' },
  { value: '150to300', label: '$150 – $300' },
  { value: 'gt300', label: 'Over $300' },
]

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

  const customerMap = Object.fromEntries(customers.map((c) => [c.customerId, c]))

  const rentalQuery = useMemo((): ListRentalsQuery | undefined => {
    const q: ListRentalsQuery = {}
    if (statusFilter) q.status = statusFilter
    if (startDateFrom) q.startDateFrom = startDateFrom
    if (startDateTo) q.startDateTo = startDateTo
    if (amountBucket && amountBucket !== 'all') q.amountBucket = amountBucket
    return Object.keys(q).length > 0 ? q : undefined
  }, [statusFilter, startDateFrom, startDateTo, amountBucket])

  useEffect(() => {
    Promise.all([listRentals(rentalQuery), listCustomers()])
      .then(([rentalsRes, customersRes]) => {
        setRentals(rentalsRes.rentals)
        setCustomers(customersRes.customers)
      })
      .catch((err) => setError(err.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [rentalQuery])

  const handleAction = async (
    rentalId: string,
    action: 'activate' | 'return' | 'cancel'
  ) => {
    setActionLoading(rentalId)
    setActionError(null)
    try {
      if (action === 'activate') await activateRental(rentalId)
      else if (action === 'return') await returnRental(rentalId)
      else await cancelRental(rentalId)
      const res = await listRentals(rentalQuery)
      setRentals(res.rentals)
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setActionLoading(null)
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
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter((e.target.value || '') as '' | RentalStatus)}
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
                  onChange={(e) => setStartDateFrom(e.target.value)}
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
                  onChange={(e) => setStartDateTo(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm font-semibold"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total amount
                </span>
                <select
                  value={amountBucket}
                  onChange={(e) =>
                    setAmountBucket(e.target.value as NonNullable<ListRentalsQuery['amountBucket']>)
                  }
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
              {rentals.length} rental(s)
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
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
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
                          className="flex items-center gap-3 hover:text-primary"
                        >
                          <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                            {(customerMap[r.customerId]?.fullName ?? r.customerId)
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold">
                            {customerMap[r.customerId]?.fullName ?? r.customerId}
                          </span>
                        </Link>
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
                        </div>
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
