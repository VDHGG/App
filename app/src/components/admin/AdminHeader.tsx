import { Link } from 'react-router-dom'

type AdminHeaderProps = {
  title: string
}

export function AdminHeader({ title }: AdminHeaderProps) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-8 flex items-center justify-between sticky top-0 z-10">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="flex items-center gap-3">
        <Link
          to="/admin/rentals/new"
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          New Rental
        </Link>
      </div>
    </header>
  )
}
