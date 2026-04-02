import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSystemUsers } from '../../lib/systemUsers.api'
import type { SystemUserSummary } from '../../lib/systemUsers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'
import { AdminPagination } from '../../components/admin/AdminPagination'

const ROLE_LABEL: Record<number, string> = {
  1: 'Customer',
  2: 'Admin',
}

export function AdminSystemUsersPage() {
  const [users, setUsers] = useState<SystemUserSummary[]>([])
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

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    setLoading(true)
    listSystemUsers({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      ...(search.trim() ? { search: search.trim() } : {}),
    })
      .then((res) => {
        setUsers(res.users)
        setListMeta({
          total: res.total,
          totalPages: res.totalPages,
          pageSize: res.pageSize,
        })
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load')
      )
      .finally(() => setLoading(false))
  }, [page, search])

  if (loading && users.length === 0) {
    return (
      <>
        <AdminHeader title="System users" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <AdminHeader title="System users" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="System users" />
      <div className="p-6 lg:p-8">
        <p className="text-sm text-slate-500 mb-4 max-w-2xl">
          Manage login accounts (roles, active status, link to customer profile). At least one active
          admin must remain; linked customer contact fields stay in sync when a customer id is set.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1 max-w-md w-full">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Search (name, email, user id)
            </label>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <p className="text-sm text-slate-500 shrink-0">{listMeta.total} account(s)</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Customer link
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No accounts match your search
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.userId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {u.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold">{u.fullName}</div>
                            <div className="text-xs text-slate-500 font-mono">{u.userId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {ROLE_LABEL[u.roleId] ?? `Role ${u.roleId}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600 dark:text-slate-400">
                        {u.customerId ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/system-users/${encodeURIComponent(u.userId)}`}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          Edit
                        </Link>
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
    </>
  )
}
