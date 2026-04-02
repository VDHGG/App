import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getShoe, type GetShoeResponse, type ShoeVariantDto } from '../lib/shoes.api'
import { ShoeImage } from '../components/ShoeImage'
import { useWishlist } from '../wishlist/WishlistContext'
import { useRentalCart } from '../cart/RentalCartContext'
import { useAuth } from '../auth/AuthContext'

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isCustomer, isInWishlist, toggle } = useWishlist()
  const { addOrMergeLine, hasVariantInCart, isCustomer: cartEnabled } = useRentalCart()

  const [shoe, setShoe] = useState<GetShoeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)

  const canRentOnline = user?.role === 'customer' && Boolean(user.customerId)

  useEffect(() => {
    if (!id) return
    getShoe(id)
      .then((s) => {
        setShoe(s)
        if (s.variants.length > 0) {
          const pick =
            s.variants.find((v) => v.availableQuantity > 0) ?? s.variants[0]
          setVariantId(pick.variantId)
        }
      })
      .catch((err) => setError(err.message ?? 'Failed to load shoe'))
      .finally(() => setLoading(false))
  }, [id])

  const selectedVariant: ShoeVariantDto | undefined = useMemo(
    () => shoe?.variants.find((v) => v.variantId === variantId),
    [shoe, variantId]
  )

  useEffect(() => {
    if (!selectedVariant) return
    setQuantity((q) => Math.min(Math.max(1, q), selectedVariant.availableQuantity))
  }, [variantId, selectedVariant])

  const variantInCart = variantId ? hasVariantInCart(variantId) : false

  function linePayload(qty: number) {
    if (!shoe || !selectedVariant) return null
    return {
      variantId: selectedVariant.variantId,
      shoeId: shoe.shoeId,
      shoeName: shoe.name,
      brand: shoe.brand,
      size: selectedVariant.size,
      color: selectedVariant.color,
      pricePerDay: shoe.pricePerDay,
      quantity: qty,
      availableQuantity: selectedVariant.availableQuantity,
      imageUrlCard: shoe.imageUrlCard,
    }
  }

  function handleAddToCart() {
    const payload = linePayload(quantity)
    if (!payload || !cartEnabled) return
    addOrMergeLine(payload)
  }

  function handleRentNow() {
    const payload = linePayload(quantity)
    if (!payload || !cartEnabled) return
    addOrMergeLine(payload)
    navigate('/checkout')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    )
  }

  if (error || !shoe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-600">{error ?? 'Shoe not found'}</p>
        <Link to="/shoes" className="text-primary hover:underline">
          Back to collection
        </Link>
      </div>
    )
  }

  const canAdd =
    canRentOnline &&
    selectedVariant &&
    selectedVariant.availableQuantity > 0 &&
    quantity >= 1 &&
    quantity <= selectedVariant.availableQuantity

  return (
    <div className="max-w-6xl mx-auto">
      <nav className="mb-8">
        <Link
          to="/shoes"
          className="text-sm text-slate-500 hover:text-primary transition-colors"
        >
          ← Back to collection
        </Link>
      </nav>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 relative">
          <ShoeImage
            src={shoe.imageUrlDetail ?? shoe.imageUrlCard}
            alt={shoe.name}
            imgClassName="absolute inset-0 object-cover w-full h-full"
          />
          {isCustomer && (
            <button
              type="button"
              aria-label={isInWishlist(shoe.shoeId) ? 'Remove from wishlist' : 'Add to wishlist'}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-sm text-primary hover:opacity-90 z-[1]"
              onClick={() => void toggle(shoe.shoeId)}
            >
              <span
                className="material-symbols-outlined text-xl leading-none"
                style={
                  isInWishlist(shoe.shoeId)
                    ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                    : undefined
                }
              >
                favorite
              </span>
            </button>
          )}
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {shoe.category}
          </span>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
            {shoe.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{shoe.brand}</p>
          <p className="text-2xl font-bold text-primary mt-6">
            ${shoe.pricePerDay}
            <span className="text-sm font-normal text-slate-500">/day</span>
          </p>
          {shoe.description && (
            <p className="mt-6 text-slate-600 dark:text-slate-400">{shoe.description}</p>
          )}

          {canRentOnline && shoe.variants.length > 0 && (
            <div className="mt-8 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Variant
                </label>
                <select
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary"
                >
                  {shoe.variants.map((v) => (
                    <option key={v.variantId} value={v.variantId}>
                      EU {v.size} · {v.color} · {v.availableQuantity} available
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedVariant?.availableQuantity ?? 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  className="w-full max-w-[200px] px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3">
            {canRentOnline ? (
              variantInCart ? (
                <>
                  <Link
                    to="/checkout"
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-opacity flex items-center justify-center text-center"
                  >
                    View cart &amp; checkout
                  </Link>
                  <p className="text-sm text-slate-500 text-center">
                    This variant is already in your cart. Adjust quantity on the{' '}
                    <Link to="/checkout" className="text-primary font-semibold underline">
                      checkout
                    </Link>{' '}
                    page or add another variant from this page.
                  </p>
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={handleAddToCart}
                    className="w-full py-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    Add more to cart (same variant)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={handleRentNow}
                    className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-lg transition-opacity"
                  >
                    Rent now
                  </button>
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={handleAddToCart}
                    className="w-full py-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                  >
                    Add to cart
                  </button>
                </>
              )
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Online rental requires a customer account.{' '}
                  <Link to="/signup" className="text-primary font-semibold">
                    Sign up
                  </Link>{' '}
                  or{' '}
                  <Link to="/login" className="text-primary font-semibold">
                    Log in
                  </Link>
                  .
                </p>
              </>
            )}

            {isCustomer ? (
              <button
                type="button"
                onClick={() => void toggle(shoe.shoeId)}
                className="w-full py-3 rounded-lg border-2 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <span
                  className="material-symbols-outlined text-xl leading-none"
                  style={
                    isInWishlist(shoe.shoeId)
                      ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
                      : undefined
                  }
                >
                  favorite
                </span>
                {isInWishlist(shoe.shoeId) ? 'Saved in wishlist' : 'Add to wishlist'}
              </button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-1">
                Wishlist is available for customer accounts.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
