import { useEffect, useState } from 'react'
import {
  listCustomers,
  getCustomer,
  updateCustomerAdmin,
  deleteCustomerAdmin,
  type CustomerSummary,
  type CustomerRank,
  type GetCustomerResponse,
} from '../../lib/customers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'
import { AdminPagination } from '../../components/admin/AdminPagination'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { getApiErrorMessage } from '../../lib/api'

const RANKS: CustomerRank[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']

function emptyForm(): GetCustomerResponse {
  return {
    customerId: '',
    fullName: '',
    email: '',
    phone: null,
    rank: 'BRONZE',
    isActive: true,
    currentRentedItems: 0,
  }
}

export function CustomersListPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [listMeta, setListMeta] = useState({
    total: 0,
    totalPages: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [form, setForm] = useState<GetCustomerResponse>(() => emptyForm())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomerSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    setLoading(true)
    listCustomers({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      ...(search.trim() ? { search: search.trim() } : {}),
    })
      .then((res) => {
        setCustomers(res.customers)
        setListMeta({
          total: res.total,
          totalPages: res.totalPages,
          pageSize: res.pageSize,
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [page, search])

  const openEdit = (customerId: string) => {
    setEditError(null)
    setEditOpen(true)
    setEditLoading(true)
    getCustomer(customerId)
      .then((c) => setForm(c))
      .catch((err: unknown) => setEditError(getApiErrorMessage(err)))
      .finally(() => setEditLoading(false))
  }

  const closeEdit = () => {
    setEditOpen(false)
    setEditError(null)
    setForm(emptyForm())
    setConfirmOpen(false)
  }

  const runDeleteCustomer = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setError(null)
    try {
      await deleteCustomerAdmin(deleteTarget.customerId)
      setDeleteTarget(null)
      const res = await listCustomers({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setCustomers(res.customers)
      setListMeta({
        total: res.total,
        totalPages: res.totalPages,
        pageSize: res.pageSize,
      })
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

  const requestSave = (e: React.FormEvent) => {
    e.preventDefault()
    setEditError(null)
    setConfirmOpen(true)
  }

  const saveCustomer = async () => {
    setSaveLoading(true)
    setEditError(null)
    try {
      await updateCustomerAdmin(form.customerId, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() ? form.phone.trim() : null,
        rank: form.rank,
        isActive: form.isActive,
      })
      setConfirmOpen(false)
      closeEdit()
      const res = await listCustomers({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setCustomers(res.customers)
      setListMeta({
        total: res.total,
        totalPages: res.totalPages,
        pageSize: res.pageSize,
      })
    } catch (err: unknown) {
      setEditError(getApiErrorMessage(err))
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading && customers.length === 0) {
    return (
      <>
        <AdminHeader title="Customers" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <AdminHeader title="Customers" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Customers" />
      <div className="p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1 max-w-md w-full">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Search (name or email)
            </label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <p className="text-sm text-slate-500 shrink-0">{listMeta.total} customer(s) total</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Current Rented
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.customerId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {c.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold">{c.fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {c.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {c.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            c.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">{c.currentRentedItems}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(c.customerId)}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            disabled={deleteLoading}
                            className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                          >
                            Delete
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

      {editOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-lg font-bold">Edit customer</h2>
              <button
                type="button"
                onClick={closeEdit}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {editLoading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : (
              <form onSubmit={requestSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Customer id
                  </label>
                  <p className="font-mono text-sm">{form.customerId}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Full name
                  </label>
                  <input
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Phone
                  </label>
                  <input
                    value={form.phone ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value.trim() ? e.target.value : null }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Rank
                  </label>
                  <select
                    value={form.rank}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rank: e.target.value as CustomerRank }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="cust-active"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <label htmlFor="cust-active" className="text-sm font-medium">
                    Active
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  If this customer has a linked login account, contact fields and active status are
                  mirrored to that account when you save.
                </p>
                {editError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
                    {editError}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Save customer?"
        message="Apply these changes? Linked system user data will stay in sync when applicable."
        confirmLabel="Save"
        loading={saveLoading}
        onCancel={() => !saveLoading && setConfirmOpen(false)}
        onConfirm={() => void saveCustomer()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xóa khách hàng?"
        message={
          deleteTarget
            ? `Xóa vĩnh viễn ${deleteTarget.fullName} (${deleteTarget.customerId})? Mọi đơn thuê của khách sẽ bị xóa; tài khoản đăng nhập (nếu có) sẽ được gỡ liên kết khách hàng. Không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        danger
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={() => void runDeleteCustomer()}
      />
    </>
  )
}
