import { Link } from 'react-router-dom'
import type { ShoeSummary } from '../lib/shoes.api'
import { useWishlist } from '../wishlist/WishlistContext'
import { ShoeImage } from './ShoeImage'

type ProductCardProps = {
  shoe: ShoeSummary
}

export function ProductCard({ shoe }: ProductCardProps) {
  const { isCustomer, isInWishlist, toggle } = useWishlist()
  const filled = isInWishlist(shoe.shoeId)

  return (
    <div className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Link to={`/shoes/${shoe.shoeId}`} className="block absolute inset-0">
          <ShoeImage
            src={shoe.imageUrl}
            alt={shoe.name}
            imgClassName="absolute inset-0 object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
          />
        </Link>
        <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 dark:bg-slate-900/90 rounded text-[10px] font-bold uppercase tracking-wider pointer-events-none z-[1]">
          {shoe.category}
        </div>
        {isCustomer && (
          <button
            type="button"
            aria-label={filled ? 'Remove from wishlist' : 'Add to wishlist'}
            className="absolute top-3 right-3 size-8 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 rounded-full shadow-md text-slate-400 hover:text-red-500 transition-colors z-[2]"
            onClick={() => void toggle(shoe.shoeId)}
          >
            <span
              className="material-symbols-outlined text-xl leading-none"
              style={
                filled
                  ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                  : undefined
              }
            >
              favorite
            </span>
          </button>
        )}
      </div>
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
          className="w-full py-2.5 bg-slate-900 dark:bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center"
        >
          Rent Now
        </Link>
      </div>
    </div>
  )
}
