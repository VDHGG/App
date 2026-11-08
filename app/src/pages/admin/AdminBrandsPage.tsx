import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getShoeLookups } from '../../lib/catalog.api'
import type { CatalogLookupRow } from '../../lib/catalog.api'
import { createBrand, deleteBrand, updateBrand } from '../../lib/catalogAdmin.api'
import { listShoes, type ShoeSummary } from '../../lib/shoes.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { getApiErrorMessage } from '../../lib/api'

export function AdminBrandsPage() {
  const [rows, setRows] = useState<CatalogLookupRow[]>([])
  const [shoes, setShoes] = useState<ShoeSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const [lookups, shoesRes] = await Promise.all([
      getShoeLookups(),
      listShoes({ pageSize: 100 }).catch(() => ({ shoes: [] as ShoeSummary[] })),
    ])
    setRows([...lookups.brands].sort((a, b) => a.name.localeCompare(b.name)))
    setShoes(shoesRes.shoes)
  }, [])

  useEffect(() => {
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setRowError(null)
    try {
      await createBrand(name)
      setNewName('')
      await load()
    } catch (err: unknown) {
      setRowError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (row: CatalogLookupRow) => {
    setEditingId(row.id)
    setEditName(row.name)
    setRowError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const saveEdit = async () => {
    if (editingId === null) return
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    setRowError(null)
    try {
      await updateBrand(editingId, name)
      cancelEdit()
      await load()
    } catch (err: unknown) {
      setRowError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: CatalogLookupRow) => {
    if (!window.confirm(`Delete brand “${row.name}”?`)) return
    setSaving(true)
    setRowError(null)
    try {
      await deleteBrand(row.id)
      await load()
    } catch (err: unknown) {
      setRowError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const metricsByBrand = useMemo(() => {
    const map = new Map<
      number,
      { shoeCount: number; variantCount: number; totalStock: number }
    >()
    for (const row of rows) {
      const target = row.name.trim().toLowerCase()
      const matched = shoes.filter((s) => s.brand.trim().toLowerCase() === target)
      let variantCount = 0
      let totalStock = 0
      for (const s of matched) {
        variantCount += s.variantCount ?? (s.variants?.length ?? 0)
        if (s.variants && s.variants.length > 0) {
          totalStock += s.variants.reduce((acc, v) => acc + v.totalQuantity, 0)
        } else {
          totalStock += s.unitsInStock
        }
      }
      map.set(row.id, { shoeCount: matched.length, variantCount, totalStock })
    }
    return map
  }, [rows, shoes])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || String(r.id).includes(q)
    )
  }, [rows, search])

  const summaryKpis = useMemo(() => {
    let activeBrands = 0
    let totalStock = 0
    for (const r of rows) {
      const m = metricsByBrand.get(r.id)
      if (m && m.shoeCount > 0) activeBrands++
      totalStock += m?.totalStock ?? 0
    }
    return {
      totalBrands: rows.length,
      activeBrands,
      totalStock,
    }
  }, [rows, metricsByBrand])

  if (loading) {
    return (
      <>
        <AdminHeader title="Brands" />
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-slate-500">Loading...</div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <AdminHeader title="Brands" />
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-600">{error}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminHeader title="Brands" />
      <div className="p-6 lg:p-8 max-w-4xl space-y-6">
        <p className="text-sm text-slate-500">
          Brand names must be unique (case-insensitive). You cannot delete a brand that is still used by
          any shoe.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tổng thương hiệu
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {summaryKpis.totalBrands}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Đang gắn sản phẩm
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {summaryKpis.activeBrands}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tổng đôi tồn kho
            </p>
            <p className="text-2xl font-black text-primary mt-1">
              {summaryKpis.totalStock}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleCreate} className="flex flex-1 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New brand name"
              maxLength={100}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
            <button
              type="submit"
              disabled={saving || !newName.trim()}
              className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 shrink-0"
            >
              Add brand
            </button>
          </form>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm thương hiệu..."
            className="sm:w-64 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
        </div>

        {rowError && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {rowError}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Số mẫu giày
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Tổng tồn kho
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                      No brands found
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const m = metricsByBrand.get(row.id) ?? {
                      shoeCount: 0,
                      variantCount: 0,
                      totalStock: 0,
                    }
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-3 font-mono text-slate-500">{row.id}</td>
                        <td className="px-6 py-3">
                          {editingId === row.id ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={100}
                              className="w-full max-w-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-slate-900 dark:text-white">{row.name}</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          {m.shoeCount > 0 ? (
                            <Link
                              to={`/shoes?q=${encodeURIComponent(row.name)}`}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:underline"
                              title={`Xem mẫu giày ${row.name} trên Storefront`}
                            >
                              {m.shoeCount} mẫu ({m.variantCount} size/màu) →
                            </Link>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              0 mẫu (0 size/màu)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-200">
                          {m.totalStock} đôi
                        </td>
                        <td className="px-6 py-3 text-right">
                          {editingId === row.id ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveEdit()}
                                disabled={saving || !editName.trim()}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(row)}
                                disabled={saving || m.shoeCount > 0}
                                title={
                                  m.shoeCount > 0
                                    ? 'Không thể xóa khi đang có mẫu giày sử dụng'
                                    : 'Xóa thương hiệu'
                                }
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
