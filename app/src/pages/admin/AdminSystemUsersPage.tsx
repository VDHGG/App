import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listSystemUsers,
  deleteSystemUser,
  updateSystemUser,
  type SystemUserSummary,
} from '../../lib/systemUsers.api'
import { sanitizeCsvCell } from '../../lib/rentals.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { useAuth } from '../../auth/AuthContext'
import { getApiErrorMessage } from '../../lib/api'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination'
import { AdminPagination } from '../../components/admin/AdminPagination'

const ROLE_LABEL: Record<number, string> = {
  1: 'Customer',
  2: 'Admin',
}

export function AdminSystemUsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<SystemUserSummary[]>([])
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 1 | 2>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL')
  const [listMeta, setListMeta] = useState({
    total: 0,
    totalPages: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SystemUserSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSystemUsers({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(roleFilter !== 'ALL' ? { roleId: roleFilter } : {}),
        ...(statusFilter === 'ACTIVE'
          ? { isActive: true }
          : statusFilter === 'LOCKED'
            ? { isActive: false }
            : {}),
      })
      setUsers(res.users)
      setListMeta({
        total: res.total,
        totalPages: res.totalPages,
        pageSize: res.pageSize,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleToggleLock = async (u: SystemUserSummary) => {
    if (me?.sub === u.userId) return
    setTogglingId(u.userId)
    setActionError(null)
    try {
      await updateSystemUser(u.userId, {
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        roleId: u.roleId,
        isActive: !u.isActive,
        customerId: u.customerId,
      })
      await loadUsers()
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  const handleExportUsersCsv = () => {
    if (users.length === 0) return
    const headers = [
      'Mã Tài Khoản',
      'Họ Tên',
      'Email',
      'Số Điện Thoại',
      'Vai Trò',
      'Mã Khách Hàng Liên Kết',
      'Trạng Thái',
    ]
    const rows = users.map((u) => [
      u.userId,
      u.fullName,
      u.email,
      u.phone ?? '',
      ROLE_LABEL[u.roleId] ?? `Role ${u.roleId}`,
      u.customerId ?? '',
      u.isActive ? 'Đang hoạt động' : 'Đã khóa',
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
    const dateStr = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `tai-khoan-he-thong-${dateStr}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const runDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setError(null)
    try {
      await deleteSystemUser(deleteTarget.userId)
      setDeleteTarget(null)
      await loadUsers()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

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

        {actionError && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {actionError}
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
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
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-500 shrink-0">{listMeta.total} account(s)</p>
              <button
                type="button"
                disabled={users.length === 0}
                onClick={handleExportUsersCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                📥 Xuất Tài Khoản (CSV)
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Vai trò:
              </span>
              {(
                [
                  { id: 'ALL', label: 'Tất cả vai trò' },
                  { id: 2, label: 'Admin (Quản trị)' },
                  { id: 1, label: 'Customer (Khách hàng)' },
                ] as const
              ).map((r) => (
                <button
                  key={String(r.id)}
                  type="button"
                  onClick={() => {
                    setRoleFilter(r.id)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    roleFilter === r.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Trạng thái:
              </span>
              {(
                [
                  { id: 'ALL', label: 'Tất cả trạng thái' },
                  { id: 'ACTIVE', label: 'Đang hoạt động' },
                  { id: 'LOCKED', label: 'Đã khóa' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st.id)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === st.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
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
                        {u.customerId ? (
                          <Link
                            to={`/admin/customers/${encodeURIComponent(u.customerId)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:underline"
                          >
                            {u.customerId} →
                          </Link>
                        ) : (
                          '—'
                        )}
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
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            disabled={
                              togglingId === u.userId || (me?.sub != null && me.sub === u.userId)
                            }
                            onClick={() => void handleToggleLock(u)}
                            className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              u.isActive
                                ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            {togglingId === u.userId
                              ? '…'
                              : u.isActive
                                ? 'Khóa'
                                : 'Mở khóa'}
                          </button>
                          <Link
                            to={`/admin/system-users/${encodeURIComponent(u.userId)}`}
                            className="text-sm font-semibold text-primary hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            disabled={
                              deleteLoading || (me?.sub != null && me.sub === u.userId)
                            }
                            onClick={() => setDeleteTarget(u)}
                            className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              me?.sub === u.userId
                                ? 'You cannot delete your own account'
                                : 'Delete account'
                            }
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xóa tài khoản hệ thống?"
        message={
          deleteTarget
            ? `Xóa vĩnh viễn ${deleteTarget.fullName} (${deleteTarget.email})? Không thể hoàn tác. Phải còn ít nhất một admin hoạt động khác nếu đây là admin.`
            : ''
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        danger
        loading={deleteLoading}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={() => void runDeleteUser()}
      />
    </>
  )
}
