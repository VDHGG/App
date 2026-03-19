import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-white">
                <span className="material-symbols-outlined text-base">footprint</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Rental Shoe
              </h2>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Redefining ownership through sustainable luxury footwear rental.
              Experience the best, without the commitment.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-6">
              Explore
            </h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li>
                <Link to="/shoes" className="hover:text-primary transition-colors">
                  Browse Collection
                </Link>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  How it Works
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm uppercase tracking-widest mb-6">
              Support
            </h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Rental Terms
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Rental Shoe. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-900 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
