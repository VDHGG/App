import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRentals, activateRental, returnRental, cancelRental } from '../../lib/rentals.api'
import type { RentalSummary } from '../../lib/rentals.api'
import { listCustomers } from '../../lib/customers.api'
import type { CustomerSummary } from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { RentalStatusBadge } from '../../components/admin/RentalStatusBadge'
import { formatDate, formatCurrency, formatDurationDays } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

const RECENT_LIMIT = 10

export function AdminDashboardPage() {
  const [rentals, setRentals] = useState<RentalSummary[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const customerMap = Object.fromEntries(customers.map((c) => [c.customerId, c]))

  useEffect(() => {
    Promise.all([listRentals(), listCustomers()])
      .then(([rentalsRes, customersRes]) => {
        setRentals(rentalsRes.rentals)
        setCustomers(customersRes.customers)
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
      const res = await listRentals()
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
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined">history</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Rentals</p>
            <h3 className="text-2xl font-bold mt-1">{totalRentals}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined">assignment_return</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Pending Returns</p>
            <h3 className="text-2xl font-bold mt-1">{pendingReturns}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined">payments</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Revenue (Returned)</p>
            <h3 className="text-2xl font-bold mt-1">{formatCurrency(revenue)}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined">group</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Customers</p>
            <h3 className="text-2xl font-bold mt-1">{customers.length}</h3>
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
        </div>

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
        {formatDurationDays(rental.startDate, rental.endDate)}
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
