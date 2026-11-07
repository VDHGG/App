import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminHeader } from '../../components/admin/AdminHeader'
import {
  listAdminReviews,
  deleteAdminReview,
  type AdminReviewItem,
} from '../../lib/reviews.api'
import { formatDate } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

export function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([])
  const [total, setTotal] = useState(0)
  const [averageRating, setAverageRating] = useState(0)
  const [ratingFilter, setRatingFilter] = useState<number | undefined>(undefined)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminReviews({
        ...(ratingFilter ? { rating: ratingFilter } : {}),
        ...(search ? { search } : {}),
      })
      setReviews(res.reviews)
      setTotal(res.total)
      setAverageRating(res.averageRating)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [ratingFilter, search])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const handleDelete = async (reviewId: number) => {
    if (
      !window.confirm(
        'Xóa vĩnh viễn đánh giá này? Điểm trung bình của mẫu giày sẽ được tính lại ngay lập tức.'
      )
    ) {
      return
    }
    setDeletingId(reviewId)
    setError(null)
    try {
      await deleteAdminReview(reviewId)
      await loadReviews()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  const lowRatingCount = reviews.filter((r) => r.rating <= 2).length

  return (
    <>
      <AdminHeader title="Quản lý & Kiểm duyệt Đánh giá" />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tổng số đánh giá
              </p>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                {total} đánh giá
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">reviews</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Điểm đánh giá trung bình
              </p>
              <h3 className="text-2xl font-bold mt-1 text-amber-500">
                {averageRating.toFixed(1)} ★
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <span className="material-symbols-outlined">star</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Đánh giá cần chú ý (1★–2★)
              </p>
              <h3 className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
                {lowRatingCount} đánh giá
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
              <span className="material-symbols-outlined">report</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo mã/tên giày, khách hàng, nội dung nhận xét..."
              className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRatingFilter(undefined)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                ratingFilter === undefined
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tất cả
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingFilter(star)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  ratingFilter === star
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {star} ★
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Mẫu giày
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Khách hàng
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Số sao
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nội dung nhận xét
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ngày gửi
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                      Đang tải danh sách đánh giá...
                    </td>
                  </tr>
                ) : reviews.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm">
                      Không tìm thấy đánh giá nào phù hợp
                    </td>
                  </tr>
                ) : (
                  reviews.map((r) => (
                    <tr
                      key={r.reviewId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to={`/shoes/${r.shoeId}`}
                          className="font-semibold text-sm text-primary hover:underline block"
                        >
                          {r.shoeName}
                        </Link>
                        <span className="text-xs font-mono text-slate-400">{r.shoeId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {r.customerName}
                        </p>
                        <span className="text-xs font-mono text-slate-400">{r.customerId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.rating >= 4
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : r.rating === 3
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          }`}
                        >
                          {'★'.repeat(r.rating)}
                          {'☆'.repeat(Math.max(0, 5 - r.rating))} ({r.rating})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 max-w-md">
                        {r.comment}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={deletingId === r.reviewId}
                          onClick={() => void handleDelete(r.reviewId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50"
                          title="Xóa đánh giá vi phạm"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          {deletingId === r.reviewId ? 'Đang xóa…' : 'Xóa'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
