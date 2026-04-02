import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getSystemUser,
  updateSystemUser,
  type SystemUserSummary,
} from '../../lib/systemUsers.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { ConfirmDialog } from '../../components/admin/ConfirmDialog'
import { getApiErrorMessage } from '../../lib/api'

const ROLES = [
  { id: 1, label: 'Customer (storefront login)' },
  { id: 2, label: 'Admin' },
] as const

export function AdminSystemUserEditorPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<SystemUserSummary | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState(1)
  const [isActive, setIsActive] = useState(true)
  const [customerId, setCustomerId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setLoadError(null)
    getSystemUser(userId)
      .then((u) => {
        setLoaded(u)
        setFullName(u.fullName)
        setEmail(u.email)
        setPhone(u.phone ?? '')
        setRoleId(u.roleId)
        setIsActive(u.isActive)
        setCustomerId(u.customerId ?? '')
        setNewPassword('')
      })
      .catch((err: unknown) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [userId])

  const openSaveConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setConfirmOpen(true)
  }

  const performSave = async () => {
    if (!userId) return
    setSaving(true)
    setSaveError(null)
    try {
      const cid = customerId.trim()
      await updateSystemUser(userId, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() ? phone.trim() : null,
        roleId,
        isActive,
        customerId: cid.length > 0 ? cid : null,
        ...(newPassword.trim().length >= 8 ? { newPassword: newPassword.trim() } : {}),
      })
      setConfirmOpen(false)
      setNewPassword('')
      navigate('/admin/system-users')
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!userId) {
    return (
      <>
        <AdminHeader title="Edit user" />
        <div className="p-8 text-red-600">Missing user id.</div>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <AdminHeader title="Edit user" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (loadError || !loaded) {
    return (
      <>
        <AdminHeader title="Edit user" />
        <div className="p-8 space-y-4">
          <p className="text-red-600">{loadError ?? 'Not found'}</p>
          <Link to="/admin/system-users" className="text-primary font-semibold hover:underline">
            Back to list
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Edit system user" />
      <div className="p-6 lg:p-8 max-w-2xl">
        <nav className="mb-6">
          <Link
            to="/admin/system-users"
            className="text-sm text-slate-500 hover:text-primary transition-colors"
          >
            ← Back to system users
          </Link>
        </nav>

        <form onSubmit={openSaveConfirm} className="space-y-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              User id
            </label>
            <p className="font-mono text-sm text-slate-700 dark:text-slate-300">{loaded.userId}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Full name
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Role
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="su-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            <label htmlFor="su-active" className="text-sm font-medium">
              Account active
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Linked customer id
            </label>
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Leave empty if not linked"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              When set, name/email/phone/active status are mirrored to that customer record on save.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              autoComplete="new-password"
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 8 characters when provided.</p>
          </div>

          {saveError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
              {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              Save changes
            </button>
            <Link
              to="/admin/system-users"
              className="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-300"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Save changes?"
        message="Apply these updates to the system user (and linked customer, if any)?"
        confirmLabel="Save"
        cancelLabel="Go back"
        loading={saving}
        onCancel={() => !saving && setConfirmOpen(false)}
        onConfirm={() => void performSave()}
      />
    </>
  )
}
