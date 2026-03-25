import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-4 shrink-0">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined">footprint</span>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              Rental Shoe
            </h2>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/shoes"
              className="text-sm font-semibold hover:text-primary transition-colors"
            >
              Browse
            </Link>
            <Link
              to="/admin"
              className="text-sm font-semibold hover:text-primary transition-colors"
            >
              Admin
            </Link>
          </nav>
          <div className="flex flex-1 items-center justify-end gap-4">
            <div className="hidden lg:block w-full max-w-xs">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  className="w-full h-10 pl-10 pr-4 bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  placeholder="Search premium shoes..."
                  type="text"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-700 dark:text-slate-300">
                  shopping_bag
                </span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-slate-700 dark:text-slate-300">
                  person
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
