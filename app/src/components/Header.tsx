import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useRentalCart } from '../cart/RentalCartContext'

export function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { totalQuantity } = useRentalCart()
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const [searchInput, setSearchInput] = useState(q)

  useEffect(() => {
    setSearchInput(q)
  }, [q])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams()
    const t = searchInput.trim()
    if (t) next.set('q', t)
    navigate({ pathname: '/', search: next.toString() ? `?${next.toString()}` : '' })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-4 shrink-0">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined text-[22px] leading-none">footprint</span>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              Rental Shoes
            </h2>
          </Link>
          <nav className="hidden md:flex items-center gap-5 lg:gap-6 flex-wrap">
            <Link
              to="/shoes"
              className="text-sm font-semibold hover:text-primary transition-colors"
            >
              Browse
            </Link>
            <Link
              to="/discovery"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Discover
            </Link>
            <Link
              to="/how-it-works"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              How it works
            </Link>
            <Link
              to="/faq"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              FAQ
            </Link>
            <Link
              to="/policies"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Policies
            </Link>
            <Link
              to="/contact"
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              Contact
            </Link>
            {user?.role === 'customer' && user.customerId && (
              <Link
                to="/wishlist"
                className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                Wishlist
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-sm font-semibold hover:text-primary transition-colors">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-3">
            <form onSubmit={handleSearch} className="hidden lg:block w-full max-w-xs">
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl leading-none">
                  search
                </span>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Search premium shoes..."
                  type="search"
                  name="q"
                  aria-label="Search shoes"
                />
              </div>
            </form>
            <div className="flex items-center gap-2 shrink-0">
              {user?.role === 'customer' && user.customerId && (
                <>
                  <Link
                    to="/wishlist"
                    className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Wishlist"
                  >
                    <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[22px] leading-none">
                      favorite
                    </span>
                  </Link>
                  <Link
                    to="/checkout"
                    className="relative flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Rental cart"
                  >
                    <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[22px] leading-none">
                      shopping_cart
                    </span>
                    {totalQuantity > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                        {totalQuantity > 99 ? '99+' : totalQuantity}
                      </span>
                    )}
                  </Link>
                </>
              )}
              <Link
                to="/shoes#collection"
                className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Browse collection"
              >
                <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[22px] leading-none">
                  shopping_bag
                </span>
              </Link>
              <Link
                to="/account"
                className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Account"
              >
                <span className="material-symbols-outlined text-slate-700 dark:text-slate-300 text-[22px] leading-none">
                  person
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 hover:text-primary px-2 py-2"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
        <nav className="md:hidden border-t border-slate-200 dark:border-slate-800 py-2.5 -mx-4 px-4 flex gap-4 overflow-x-auto text-xs font-semibold whitespace-nowrap items-center">
          <Link to="/shoes" className="text-slate-900 dark:text-white">
            Browse
          </Link>
          <Link to="/discovery" className="text-slate-600 dark:text-slate-400">
            Discover
          </Link>
          {user?.role === 'customer' && user.customerId && (
            <Link to="/wishlist" className="text-slate-600 dark:text-slate-400">
              Wishlist
            </Link>
          )}
          <Link to="/how-it-works" className="text-slate-600 dark:text-slate-400">
            How it works
          </Link>
          <Link to="/faq" className="text-slate-600 dark:text-slate-400">
            FAQ
          </Link>
          <Link to="/policies" className="text-slate-600 dark:text-slate-400">
            Policies
          </Link>
          <Link to="/contact" className="text-slate-600 dark:text-slate-400">
            Contact
          </Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className="text-primary">
              Admin
            </Link>
          )}
          <button type="button" onClick={handleLogout} className="text-slate-500 ml-auto">
            Log out
          </button>
        </nav>
      </div>
    </header>
  )
}
