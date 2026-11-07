import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchNotifications, type NotificationItem } from '../lib/rentals.api'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) {
      setNotifications([])
      setReadIds([])
      return
    }
    let cancelled = false
    fetchNotifications()
      .then((res) => {
        if (cancelled) return
        setNotifications(res.notifications ?? [])
      })
      .catch(() => {
        // Ignore silent fetch error in header
      })
    return () => {
      cancelled = true
    }
  }, [user?.email, user?.role, user?.customerId, open])

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  if (!user) return null

  const badgeCount = notifications.filter((n) => !readIds.includes(n.id)).length

  function getSeverityStyle(severity: NotificationItem['severity']) {
    switch (severity) {
      case 'danger':
        return {
          icon: 'warning',
          bg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
        }
      case 'warning':
        return {
          icon: 'schedule',
          bg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
        }
      case 'success':
        return {
          icon: 'workspace_premium',
          bg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
        }
      case 'info':
      default:
        return {
          icon: 'local_offer',
          bg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
        }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        title="Thông báo"
        aria-label="Thông báo"
      >
        <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[22px] leading-none">
          notifications
        </span>
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">notifications_active</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Thông báo</span>
              {badgeCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  {badgeCount} mới
                </span>
              )}
            </div>
            {badgeCount > 0 && (
              <button
                type="button"
                onClick={() => setReadIds(notifications.map((n) => n.id))}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Hiện chưa có thông báo mới.
              </div>
            ) : (
              notifications.map((item) => {
                const style = getSeverityStyle(item.severity)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate(item.link)
                    }}
                    className="w-full text-left p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3"
                  >
                    <div
                      className={`size-9 rounded-xl shrink-0 flex items-center justify-center ${style.bg}`}
                    >
                      <span className="material-symbols-outlined text-lg">{style.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
