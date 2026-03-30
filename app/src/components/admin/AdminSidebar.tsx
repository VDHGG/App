import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export function AdminSidebar() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  function handleSignOut() {
    logout()
    navigate('/login', { replace: true })
  }
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
    }`

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed h-full">
      <div className="p-6 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-3">
          <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[22px] leading-none">ice_skating</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Rental Shoe</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
              Admin Panel
            </p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        <NavLink to="/admin" end className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            dashboard
          </span>
          <span className="text-sm font-medium">Dashboard</span>
        </NavLink>
        <NavLink to="/admin/rentals" className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            shopping_cart
          </span>
          <span className="text-sm font-medium">Rentals</span>
        </NavLink>
        <NavLink to="/admin/customers" className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            group
          </span>
          <span className="text-sm font-medium">Customers</span>
        </NavLink>
        <NavLink to="/admin/shoes" className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            inventory_2
          </span>
          <span className="text-sm font-medium">Shoe inventory</span>
        </NavLink>
        <NavLink to="/admin/catalog/brands" className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            sell
          </span>
          <span className="text-sm font-medium">Brands</span>
        </NavLink>
        <NavLink to="/admin/catalog/categories" className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            category
          </span>
          <span className="text-sm font-medium">Categories</span>
        </NavLink>
        <NavLink to="/admin/rentals/new" className={navClass}>
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            point_of_sale
          </span>
          <span className="text-sm font-medium">New rental (walk-in)</span>
        </NavLink>
        <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Store
        </div>
        <Link
          to="/shoes"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] leading-none w-6 shrink-0 flex items-center justify-center">
            storefront
          </span>
          <span className="text-sm font-medium">Browse Storefront</span>
        </Link>
      </nav>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
        >
          <span className="material-symbols-outlined text-slate-400 text-[18px] leading-none w-6 shrink-0 flex items-center justify-center">
            logout
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Sign out</span>
        </button>
        <Link
          to="/"
          className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-400 text-[18px] leading-none w-6 shrink-0 flex items-center justify-center">
            storefront
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Back to Store
          </span>
        </Link>
      </div>
    </aside>
  )
}
