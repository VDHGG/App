import { type FormEvent, useEffect, useState } from 'react'
import { ContentPageShell } from '../components/content/ContentPageShell'
import { useAuth } from '../auth/AuthContext'
import { changePassword, updateProfile } from '../lib/auth.api'
import { getApiErrorMessage } from '../lib/api'

export function AccountPage() {
  const { user, refreshUser } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    setFullName(user.fullName)
    setEmail(user.email)
    setPhone(user.phone ?? '')
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      await updateProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      })
      await refreshUser()
      setSuccess('Đã lưu thông tin tài khoản.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(null)
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    setPwSubmitting(true)
    try {
      await changePassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess('Password updated successfully.')
    } catch (err) {
      setPwError(getApiErrorMessage(err))
    } finally {
      setPwSubmitting(false)
    }
  }

  return (
    <ContentPageShell
      title="Account Information"
      intro="Update your full name, email and phone number used for renting and contact."
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-w-lg pb-10 border-b border-slate-200 dark:border-slate-800">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2">
            {success}
          </div>
        )}
        <div>
          <label htmlFor="account-fullName" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Full Name
          </label>
          <input
            id="account-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
            autoComplete="name"
            required
            maxLength={100}
          />
        </div>
        <div>
          <label htmlFor="account-email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
            autoComplete="email"
            required
            maxLength={255}
          />
        </div>
        <div>
          <label htmlFor="account-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Phone
          </label>
          <input
            id="account-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
            autoComplete="tel"
            required
            minLength={1}
            maxLength={20}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            Use the contact number when receiving shoes; format like when registering (8–15 digits).
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center min-h-11 px-6 rounded-lg bg-primary text-white text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="max-w-lg pt-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Change password</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Enter your current password, then choose a new one (at least 8 characters).
        </p>
        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          {pwError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2">
              {pwSuccess}
            </div>
          )}
          <div>
            <label
              htmlFor="account-current-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Current password
            </label>
            <input
              id="account-current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label
              htmlFor="account-new-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              New password
            </label>
            <input
              id="account-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <div>
            <label
              htmlFor="account-confirm-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="account-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            disabled={pwSubmitting}
            className="inline-flex items-center justify-center min-h-11 px-6 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
          >
            {pwSubmitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </ContentPageShell>
  )
}
