import { Link } from 'react-router-dom'
import type { ShoeSummary } from '../lib/shoes.api'

type ProductCardProps = {
  shoe: ShoeSummary
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop'

export function ProductCard({ shoe }: ProductCardProps) {
  return (
    <div className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
      <Link to={`/shoes/${shoe.shoeId}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={shoe.imageUrl ?? PLACEHOLDER_IMAGE}
            alt={shoe.name}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 dark:bg-slate-900/90 rounded text-[10px] font-bold uppercase tracking-wider">
            {shoe.category}
          </div>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <Link to={`/shoes/${shoe.shoeId}`}>
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
              {shoe.name}
            </h3>
          </Link>
          <span className="text-primary font-black">
            ${shoe.pricePerDay}
            <span className="text-[10px] text-slate-500 font-normal">/day</span>
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-4 line-clamp-1">{shoe.brand}</p>
        <Link
          to={`/shoes/${shoe.shoeId}`}
          className="w-full py-2.5 bg-slate-900 dark:bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          Rent Now
        </Link>
      </div>
    </div>
  )
}
