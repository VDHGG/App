import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getShoe,
  fetchShoeAvailability,
  fetchShoeReviews,
  submitShoeReview,
  type GetShoeResponse,
  type ShoeVariantDto,
  type ShoeAvailabilityResponse,
  type ShoeReviewDto,
} from '../lib/shoes.api'
import { formatCurrency } from '../lib/format'
import { getApiErrorMessage } from '../lib/api'
import { ShoeImage } from '../components/ShoeImage'
import { useWishlist } from '../wishlist/WishlistContext'
import { useRentalCart } from '../cart/RentalCartContext'
import { useAuth } from '../auth/AuthContext'

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isCustomer, isInWishlist, toggle } = useWishlist()
  const { addOrMergeLine, hasVariantInCart, isCustomer: cartEnabled } = useRentalCart()

  const [shoe, setShoe] = useState<GetShoeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [variantId, setVariantId] = useState('')
  const urlQty = Number(searchParams.get('qty') || 0)
  const urlVoucher = (searchParams.get('voucher') || '').trim().toUpperCase()
  const [quantity, setQuantity] = useState(() =>
    urlQty >= 1 ? Math.min(5, Math.max(1, Math.floor(urlQty))) : 1
  )

  // Availability Date Range Checker
  const today = toDateString(new Date())
  const [checkStartDate, setCheckStartDate] = useState(
    () => searchParams.get('startDate') || today
  )
  const [checkEndDate, setCheckEndDate] = useState(
    () => searchParams.get('endDate') || toDateString(addDays(new Date(), 2))
  )
  const [availability, setAvailability] = useState<ShoeAvailabilityResponse | null>(null)
  const [availLoading, setAvailLoading] = useState(false)

  // Sync URL query params when navigating from AI Quote Card while already on /shoes/:id
  useEffect(() => {
    const sDate = searchParams.get('startDate')
    const eDate = searchParams.get('endDate')
    const qParam = Number(searchParams.get('qty') || 0)
    if (sDate && /^\d{4}-\d{2}-\d{2}$/.test(sDate)) {
      setCheckStartDate(sDate)
    }
    if (eDate && /^\d{4}-\d{2}-\d{2}$/.test(eDate)) {
      setCheckEndDate(eDate)
    }
    if (qParam >= 1) {
      setQuantity(Math.min(5, Math.max(1, Math.floor(qParam))))
    }
  }, [searchParams])

  // Reviews State
  const [reviews, setReviews] = useState<ShoeReviewDto[]>([])
  const [avgRating, setAvgRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null)

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

  useEffect(() => {
    if (!id || !checkStartDate || !checkEndDate || checkEndDate < checkStartDate) {
      setAvailability(null)
      return
    }
    let cancelled = false
    setAvailLoading(true)
    fetchShoeAvailability(id, checkStartDate, checkEndDate)
      .then((res) => {
        if (!cancelled) setAvailability(res)
      })
      .catch(() => {
        if (!cancelled) setAvailability(null)
      })
      .finally(() => {
        if (!cancelled) setAvailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, checkStartDate, checkEndDate])

  const loadReviews = useCallback(async (shoeId: string) => {
    setReviewsLoading(true)
    try {
      const res = await fetchShoeReviews(shoeId)
      setReviews(res.reviews)
      setAvgRating(res.averageRating)
      setTotalReviews(res.totalReviews)
    } catch {
      // ignore
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (id) {
      void loadReviews(id)
    }
  }, [id, loadReviews])

  const variantAvailMap = useMemo(() => {
    const m = new Map<string, number>()
    if (availability?.variants) {
      for (const v of availability.variants) {
        m.set(v.variantId, v.availableQuantity)
      }
    }
    return m
  }, [availability])

  const effectiveAvailable = useCallback(
    (v: ShoeVariantDto): number => {
      return variantAvailMap.has(v.variantId)
        ? variantAvailMap.get(v.variantId)!
        : v.availableQuantity
    },
    [variantAvailMap]
  )

  const selectedVariant: ShoeVariantDto | undefined = useMemo(
    () => shoe?.variants.find((v) => v.variantId === variantId),
    [shoe, variantId]
  )

  useEffect(() => {
    if (!shoe || !selectedVariant) return
    const maxAvail = effectiveAvailable(selectedVariant)
    if (maxAvail <= 0) {
      const nextAvail = shoe.variants.find((v) => effectiveAvailable(v) > 0)
      if (nextAvail && nextAvail.variantId !== selectedVariant.variantId) {
        setVariantId(nextAvail.variantId)
        return
      }
    }
    setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, maxAvail)))
  }, [shoe, variantId, selectedVariant, effectiveAvailable])

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
      availableQuantity: effectiveAvailable(selectedVariant),
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
    const voucherQuery = urlVoucher ? `&voucher=${encodeURIComponent(urlVoucher)}` : ''
    navigate(
      `/checkout?startDate=${encodeURIComponent(checkStartDate)}&endDate=${encodeURIComponent(checkEndDate)}${voucherQuery}`
    )
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !newComment.trim()) return
    setSubmittingReview(true)
    setReviewError(null)
    setReviewSuccess(null)
    try {
      await submitShoeReview(id, { rating: newRating, comment: newComment.trim() })
      setNewComment('')
      setReviewSuccess('Đánh giá của bạn đã được ghi nhận!')
      await loadReviews(id)
    } catch (err: unknown) {
      setReviewError(getApiErrorMessage(err))
    } finally {
      setSubmittingReview(false)
    }
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
    effectiveAvailable(selectedVariant) > 0 &&
    quantity >= 1 &&
    quantity <= effectiveAvailable(selectedVariant)

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
            {formatCurrency(shoe.pricePerDay)}
            <span className="text-sm font-normal text-slate-500">/day</span>
          </p>
          {shoe.description && (
            <p className="mt-6 text-slate-600 dark:text-slate-400">{shoe.description}</p>
          )}

          {shoe.variants.length > 0 && (
            <>
              <div className="mt-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">calendar_month</span>
                    Kiểm tra lịch còn giày
                  </label>
                  {availLoading && (
                    <span className="text-xs text-slate-400">Đang kiểm tra...</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">Ngày nhận (bắt đầu)</span>
                    <input
                      type="date"
                      value={checkStartDate}
                      min={today}
                      onChange={(e) => {
                        setCheckStartDate(e.target.value)
                        if (e.target.value > checkEndDate) {
                          setCheckEndDate(e.target.value)
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-500 mb-1">Ngày trả (dự kiến)</span>
                    <input
                      type="date"
                      value={checkEndDate}
                      min={checkStartDate}
                      onChange={(e) => setCheckEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Variant
                  </label>
                  <select
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary"
                  >
                    {shoe.variants.map((v) => {
                      const avail = effectiveAvailable(v)
                      return (
                        <option key={v.variantId} value={v.variantId} disabled={avail <= 0}>
                          EU {v.size} · {v.color} · {avail > 0 ? `${avail} trống (theo ngày chọn)` : 'Hết hàng'} / tổng {v.totalQuantity}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedVariant ? Math.max(1, effectiveAvailable(selectedVariant)) : 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                    className="w-full max-w-[200px] px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </>
          )}

          <div className="mt-8 flex flex-col gap-3">
            {urlVoucher && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                🎁 Mã ưu đãi từ Trợ lý AI: <strong>{urlVoucher}</strong> — sẽ tự động áp dụng khi bạn bấm &ldquo;Thuê ngay&rdquo;.
              </div>
            )}
            {canRentOnline ? (
              variantInCart ? (
                <>
                  <Link
                    to={`/checkout?startDate=${encodeURIComponent(checkStartDate)}&endDate=${encodeURIComponent(checkEndDate)}${urlVoucher ? `&voucher=${encodeURIComponent(urlVoucher)}` : ''}`}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-opacity flex items-center justify-center text-center"
                  >
                    View cart &amp; checkout
                  </Link>
                  <p className="text-sm text-slate-500 text-center">
                    This variant is already in your cart. Adjust quantity on the{' '}
                    <Link
                      to={`/checkout?startDate=${encodeURIComponent(checkStartDate)}&endDate=${encodeURIComponent(checkEndDate)}${urlVoucher ? `&voucher=${encodeURIComponent(urlVoucher)}` : ''}`}
                      className="text-primary font-semibold underline"
                    >
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

      {/* Customer Reviews Section */}
      <section className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Đánh giá từ khách hàng
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex text-amber-400 text-lg">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className="material-symbols-outlined text-lg leading-none"
                    style={
                      star <= Math.round(avgRating)
                        ? { fontVariationSettings: "'FILL' 1" }
                        : undefined
                    }
                  >
                    star
                  </span>
                ))}
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {avgRating > 0 ? avgRating.toFixed(1) : 'Chưa có đánh giá'}
              </span>
              <span className="text-xs text-slate-500">
                ({totalReviews} lượt đánh giá)
              </span>
            </div>
          </div>
        </div>

        {/* Review Submission Form */}
        {canRentOnline ? (
          <form
            onSubmit={handleSubmitReview}
            className="mb-10 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-4"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Viết đánh giá của bạn
            </h3>
            {reviewError && (
              <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                {reviewError}
              </div>
            )}
            {reviewSuccess && (
              <div className="p-3 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                {reviewSuccess}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Số sao
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform"
                  >
                    <span
                      className="material-symbols-outlined text-2xl"
                      style={
                        star <= newRating ? { fontVariationSettings: "'FILL' 1" } : undefined
                      }
                    >
                      star
                    </span>
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">
                  {newRating} sao
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Nhận xét của bạn
              </label>
              <textarea
                required
                rows={3}
                maxLength={500}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm về chất lượng giày, độ êm, đúng kích cỡ..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview || !newComment.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 transition-opacity"
            >
              {submittingReview ? 'Đang gửi…' : 'Gửi đánh giá'}
            </button>
          </form>
        ) : (
          <div className="mb-8 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
            Đăng nhập tài khoản khách hàng để gửi đánh giá về đôi giày này.
          </div>
        )}

        {/* Review List */}
        {reviewsLoading ? (
          <p className="text-sm text-slate-400">Đang tải đánh giá…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center border rounded-xl border-dashed border-slate-200 dark:border-slate-800">
            Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên trải nghiệm!
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div
                key={r.reviewId}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {r.customerName}
                    </span>
                    <div className="flex text-amber-400 text-xs">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className="material-symbols-outlined text-sm leading-none"
                          style={
                            star <= r.rating
                              ? { fontVariationSettings: "'FILL' 1" }
                              : undefined
                          }
                        >
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {r.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
