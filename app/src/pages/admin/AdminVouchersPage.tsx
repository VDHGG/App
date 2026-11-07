import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/admin/AdminHeader'
import {
  listAllVouchersAdmin,
  createVoucherAdmin,
  updateVoucherAdmin,
  deleteVoucherAdmin,
  type VoucherRecord,
} from '../../lib/vouchers.api'
import { formatDate } from '../../lib/format'
import { getApiErrorMessage } from '../../lib/api'

export function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Create Form State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createCode, setCreateCode] = useState('')
  const [createDiscount, setCreateDiscount] = useState('10')
  const [createDescription, setCreateDescription] = useState('')
  const [createMaxUses, setCreateMaxUses] = useState('')
  const [createExpiresAt, setCreateExpiresAt] = useState('')
  const [createIsActive, setCreateIsActive] = useState(true)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit Modal State
  const [editVoucher, setEditVoucher] = useState<VoucherRecord | null>(null)
  const [editDiscount, setEditDiscount] = useState('10')
  const [editDescription, setEditDescription] = useState('')
  const [editMaxUses, setEditMaxUses] = useState('')
  const [editExpiresAt, setEditExpiresAt] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Action Loading ID
  const [actionLoadingCode, setActionLoadingCode] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const res = await listAllVouchersAdmin()
      setVouchers(res.vouchers)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    const code = createCode.trim().toUpperCase()
    const discount = Number(createDiscount)
    if (!code) {
      setCreateError('Vui lòng nhập mã voucher.')
      return
    }
    if (!Number.isFinite(discount) || discount < 1 || discount > 50) {
      setCreateError('Mức giảm giá phải từ 1% đến 50%.')
      return
    }
    if (!createDescription.trim()) {
      setCreateError('Vui lòng nhập mô tả cho voucher.')
      return
    }

    setCreateSubmitting(true)
    try {
      await createVoucherAdmin({
        code,
        discountPercent: discount,
        description: createDescription.trim(),
        maxUses: createMaxUses ? Math.max(1, Math.floor(Number(createMaxUses))) : null,
        expiresAt: createExpiresAt || null,
        isActive: createIsActive,
      })
      setShowCreateModal(false)
      setCreateCode('')
      setCreateDiscount('10')
      setCreateDescription('')
      setCreateMaxUses('')
      setCreateExpiresAt('')
      setCreateIsActive(true)
      setSuccess(`Đã tạo voucher ${code} thành công!`)
      await load()
    } catch (err: unknown) {
      setCreateError(getApiErrorMessage(err))
    } finally {
      setCreateSubmitting(false)
    }
  }

  const openEdit = (v: VoucherRecord) => {
    setEditVoucher(v)
    setEditDiscount(String(v.discountPercent))
    setEditDescription(v.description)
    setEditMaxUses(v.maxUses != null ? String(v.maxUses) : '')
    setEditExpiresAt(v.expiresAt ? v.expiresAt.slice(0, 10) : '')
    setEditIsActive(v.isActive)
    setEditError(null)
  }

  const closeEdit = () => {
    setEditVoucher(null)
    setEditError(null)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editVoucher) return
    setEditError(null)
    const discount = Number(editDiscount)
    if (!Number.isFinite(discount) || discount < 1 || discount > 50) {
      setEditError('Mức giảm giá phải từ 1% đến 50%.')
      return
    }
    if (!editDescription.trim()) {
      setEditError('Vui lòng nhập mô tả cho voucher.')
      return
    }

    setEditSubmitting(true)
    try {
      await updateVoucherAdmin(editVoucher.code, {
        discountPercent: discount,
        description: editDescription.trim(),
        maxUses: editMaxUses ? Math.max(1, Math.floor(Number(editMaxUses))) : null,
        expiresAt: editExpiresAt || null,
        isActive: editIsActive,
      })
      closeEdit()
      setSuccess(`Đã cập nhật voucher ${editVoucher.code}!`)
      await load()
    } catch (err: unknown) {
      setEditError(getApiErrorMessage(err))
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleToggleActive = async (v: VoucherRecord) => {
    setActionLoadingCode(v.code)
    try {
      await updateVoucherAdmin(v.code, { isActive: !v.isActive })
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoadingCode(null)
    }
  }

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Xóa vĩnh viễn voucher ${code}?`)) return
    setActionLoadingCode(code)
    try {
      await deleteVoucherAdmin(code)
      setSuccess(`Đã xóa voucher ${code}.`)
      await load()
    } catch (err: unknown) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoadingCode(null)
    }
  }

  return (
    <>
      <AdminHeader title="Vouchers & Promotions" />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quản lý mã giảm giá</h2>
            <p className="text-sm text-slate-500">
              Tạo và quản lý các mã khuyến mãi áp dụng khi khách hàng đặt thuê giày.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg leading-none">add</span>
            Thêm voucher mới
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="p-8 flex items-center justify-center min-h-[300px]">
            <div className="text-slate-500">Đang tải danh sách voucher…</div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Mã (Code)</th>
                    <th className="px-6 py-4">Giảm giá (%)</th>
                    <th className="px-6 py-4">Mô tả</th>
                    <th className="px-6 py-4">Lượt dùng</th>
                    <th className="px-6 py-4">Hạn dùng</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Chưa có voucher nào. Hãy nhấn &quot;Thêm voucher mới&quot; để tạo mã đầu tiên!
                      </td>
                    </tr>
                  ) : (
                    vouchers.map((v) => (
                      <tr
                        key={v.code}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono font-bold text-primary text-sm">
                          <span className="px-2.5 py-1 rounded bg-primary/10 border border-primary/20">
                            {v.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400">
                          -{v.discountPercent}%
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-xs">
                          {v.description}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {v.usedCount}
                          </span>{' '}
                          / {v.maxUses != null ? v.maxUses : '∞'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                          {v.expiresAt ? formatDate(v.expiresAt) : 'Không giới hạn'}
                        </td>
                        <td className="px-6 py-4">
                          {v.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Đang bật
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              Đã tắt
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={actionLoadingCode === v.code}
                            onClick={() => void handleToggleActive(v)}
                            className="text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            {v.isActive ? 'Tắt' : 'Bật'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(v)}
                            className="p-1 hover:text-primary text-slate-500 transition-colors"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingCode === v.code}
                            onClick={() => void handleDelete(v.code)}
                            className="p-1 hover:text-rose-600 text-slate-500 transition-colors disabled:opacity-50"
                            title="Xóa voucher"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Thêm voucher mới
            </h3>
            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-xs">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Mã voucher (Code)
                </label>
                <input
                  required
                  type="text"
                  maxLength={32}
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  placeholder="VD: WELCOME10, VIP25..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm uppercase focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Mức giảm (%)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={50}
                  value={createDiscount}
                  onChange={(e) => setCreateDiscount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Mô tả ưu đãi
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={255}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="VD: Giảm 10% cho khách hàng mới..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Giới hạn lượt dùng
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Không giới hạn"
                    value={createMaxUses}
                    onChange={(e) => setCreateMaxUses(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Ngày hết hạn
                  </label>
                  <input
                    type="date"
                    value={createExpiresAt}
                    onChange={(e) => setCreateExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={createIsActive}
                  onChange={(e) => setCreateIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Kích hoạt sử dụng ngay
                </span>
              </label>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {createSubmitting ? 'Đang tạo…' : 'Tạo voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editVoucher && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Chỉnh sửa voucher {editVoucher.code}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Cập nhật thông tin giảm giá hoặc thời hạn cho mã này.
            </p>
            {editError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-xs">
                {editError}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Mức giảm (%)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={50}
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Mô tả ưu đãi
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={255}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Giới hạn lượt dùng
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Không giới hạn"
                    value={editMaxUses}
                    onChange={(e) => setEditMaxUses(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Ngày hết hạn
                  </label>
                  <input
                    type="date"
                    value={editExpiresAt}
                    onChange={(e) => setEditExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Đang bật (cho phép khách hàng áp dụng)
                </span>
              </label>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {editSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
