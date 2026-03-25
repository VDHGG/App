import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addShoe,
  getShoe,
  updateShoe,
  uploadShoeImage,
  type GetShoeResponse,
  type ShoeVariantDto,
} from '../../lib/shoes.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { getApiErrorMessage } from '../../lib/api'

type VariantFormRow = {
  variantId?: string
  size: string
  color: string
  totalQuantity: string
  availableQuantity?: number
}

function emptyVariantRow(): VariantFormRow {
  return { size: '42', color: '', totalQuantity: '1' }
}

export function ShoeEditorPage() {
  const { shoeId } = useParams<{ shoeId: string }>()
  const navigate = useNavigate()
  const isNew = !shoeId

  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [pricePerDay, setPricePerDay] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [variants, setVariants] = useState<VariantFormRow[]>([emptyVariantRow()])
  const [loaded, setLoaded] = useState<GetShoeResponse | null>(null)

  const [imagePublicId, setImagePublicId] = useState<string | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageDirty, setImageDirty] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew || !shoeId) return
    setLoading(true)
    setLoadError(null)
    getShoe(shoeId)
      .then((s) => {
        setLoaded(s)
        setName(s.name)
        setBrand(s.brand)
        setCategory(s.category)
        setDescription(s.description ?? '')
        setPricePerDay(String(s.pricePerDay))
        setIsActive(s.isActive)
        setVariants(
          s.variants.map((v: ShoeVariantDto) => ({
            variantId: v.variantId,
            size: String(v.size),
            color: v.color,
            totalQuantity: String(v.totalQuantity),
            availableQuantity: v.availableQuantity,
          }))
        )
        setImagePublicId(s.imagePublicId)
        setImagePreviewUrl(s.imageUrlDetail ?? s.imageUrlCard)
        setImageDirty(false)
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [isNew, shoeId])

  const updateVariant = (index: number, patch: Partial<VariantFormRow>) => {
    setVariants((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addVariantRow = () => setVariants((rows) => [...rows, emptyVariantRow()])

  const removeVariantRow = (index: number) => {
    setVariants((rows) => rows.filter((_, i) => i !== index))
  }

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setSaveError(null)
    setImageUploading(true)
    try {
      const res = await uploadShoeImage(file)
      setImagePublicId(res.publicId)
      setImagePreviewUrl(res.imageUrlDetail)
      setImageDirty(true)
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err))
    } finally {
      setImageUploading(false)
    }
  }

  const clearImage = () => {
    setImagePublicId(null)
    setImagePreviewUrl(null)
    setImageDirty(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    const price = Number(pricePerDay)
    if (!name.trim() || !brand.trim() || !category.trim() || !Number.isFinite(price) || price <= 0) {
      setSaveError('Please fill name, brand, category, and a valid price.')
      return
    }

    const parsedVariants = variants.map((v) => ({
      size: Number(v.size),
      color: v.color.trim(),
      total: Math.max(0, Math.floor(Number(v.totalQuantity))),
    }))

    for (const v of parsedVariants) {
      if (!Number.isFinite(v.size) || v.size < 1 || v.size > 60) {
        setSaveError('Each variant needs a valid size (1–60).')
        return
      }
      if (!v.color) {
        setSaveError('Each variant needs a color.')
        return
      }
    }

    if (parsedVariants.length === 0) {
      setSaveError('Add at least one variant.')
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        const res = await addShoe({
          name: name.trim(),
          brand: brand.trim(),
          category: category.trim(),
          description: description.trim() || undefined,
          pricePerDay: price,
          ...(imagePublicId ? { imagePublicId } : {}),
          variants: parsedVariants.map((v) => ({
            size: v.size,
            color: v.color,
            totalQuantity: v.total,
          })),
        })
        navigate(`/admin/shoes/${res.shoeId}/edit`, { replace: true })
        return
      }

      if (!shoeId) return

      const newRows = variants
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => !v.variantId)
        .map(({ v }) => ({
          size: Number(v.size),
          color: v.color.trim(),
          totalQuantity: Math.max(0, Math.floor(Number(v.totalQuantity))),
        }))

      const variantQuantityUpdates = variants
        .filter((v) => v.variantId)
        .map((v) => ({
          variantId: v.variantId as string,
          totalQuantity: Math.max(0, Math.floor(Number(v.totalQuantity))),
        }))

      await updateShoe(shoeId, {
        name: name.trim(),
        brand: brand.trim(),
        category: category.trim(),
        description: description.trim() === '' ? null : description.trim(),
        pricePerDay: price,
        isActive,
        ...(imageDirty ? { imagePublicId } : {}),
        variantQuantityUpdates,
        newVariants: newRows.length ? newRows : undefined,
      })

      const refreshed = await getShoe(shoeId)
      setLoaded(refreshed)
      setImagePublicId(refreshed.imagePublicId)
      setImagePreviewUrl(refreshed.imageUrlDetail ?? refreshed.imageUrlCard)
      setImageDirty(false)
      setVariants(
        refreshed.variants.map((v) => ({
          variantId: v.variantId,
          size: String(v.size),
          color: v.color,
          totalQuantity: String(v.totalQuantity),
          availableQuantity: v.availableQuantity,
        }))
      )
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!isNew && loading) {
    return (
      <>
        <AdminHeader title="Edit shoe" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (!isNew && loadError) {
    return (
      <>
        <AdminHeader title="Edit shoe" />
        <div className="p-8 max-w-lg">
          <p className="text-red-600 mb-4">{loadError}</p>
          <Link to="/admin/shoes" className="text-primary font-semibold">
            Back to inventory
          </Link>
        </div>
      </>
    )
  }

  const title = isNew ? 'Add shoe' : `Edit: ${loaded?.name ?? ''}`

  return (
    <>
      <AdminHeader title={title} />
      <div className="p-6 lg:p-8 max-w-3xl space-y-6">
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/admin/shoes" className="hover:text-primary">
            Inventory
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-slate-900 dark:text-white font-medium">
            {isNew ? 'New' : 'Edit'}
          </span>
        </nav>

        {saveError && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{saveError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand</label>
              <input
                required
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Price / day (USD)
              </label>
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Product image</label>
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-32 h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center px-2">
                    No image
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={imageUploading}
                  onChange={handleImageFile}
                  className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white"
                />
                {(imagePublicId || imagePreviewUrl) && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="self-start text-xs font-semibold text-red-600 hover:underline"
                  >
                    Remove image
                  </button>
                )}
                <p className="text-xs text-slate-500">
                  JPEG, PNG, or WebP — max 2 MB. Images are stored on Cloudinary (
                  <code className="text-[10px]">f_auto,q_auto</code> on delivery).
                </p>
                {imageUploading && <p className="text-xs text-slate-500">Uploading…</p>}
              </div>
            </div>
          </div>

          {!isNew && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300"
              />
              Active (visible on storefront when stocked)
            </label>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">straighten</span>
                Variants (size / color / stock)
              </h3>
              <button
                type="button"
                onClick={addVariantRow}
                className="text-sm font-semibold text-primary hover:underline"
              >
                + Add variant
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Stock is total on hand per variant. You cannot set total below what is already reserved
              for active rentals.
            </p>
            <div className="space-y-3">
              {variants.map((row, index) => (
                <div
                  key={row.variantId ?? `new-${index}`}
                  className="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
                >
                  <div className="w-20">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Size
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      required
                      disabled={!!row.variantId}
                      value={row.size}
                      onChange={(e) => updateVariant(index, { size: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Color
                    </label>
                    <input
                      required
                      disabled={!!row.variantId}
                      value={row.color}
                      onChange={(e) => updateVariant(index, { color: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm disabled:opacity-60"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Total qty
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={row.totalQuantity}
                      onChange={(e) => updateVariant(index, { totalQuantity: e.target.value })}
                      className="w-full rounded border border-slate-200 dark:border-slate-600 px-2 py-1.5 text-sm"
                    />
                  </div>
                  {row.availableQuantity !== undefined && (
                    <div className="text-xs text-slate-500 pb-1">
                      Available: <strong>{row.availableQuantity}</strong>
                    </div>
                  )}
                  {((isNew && variants.length > 1) || (!isNew && !row.variantId)) && (
                    <button
                      type="button"
                      onClick={() => removeVariantRow(index)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      title="Remove row"
                    >
                      <span className="material-symbols-outlined">remove_circle</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Create shoe' : 'Save changes'}
            </button>
            <Link
              to="/admin/shoes"
              className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
