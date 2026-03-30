import { useCallback, useEffect, useState } from 'react'
import { getShoeLookups } from '../../lib/catalog.api'
import type { CatalogLookupRow } from '../../lib/catalog.api'
import { createBrand, deleteBrand, updateBrand } from '../../lib/catalogAdmin.api'
import { AdminHeader } from '../../components/admin/AdminHeader'
import { getApiErrorMessage } from '../../lib/api'

export function AdminBrandsPage() {
  const [rows, setRows] = useState<CatalogLookupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const lookups = await getShoeLookups()
    setRows([...lookups.brands].sort((a, b) => a.name.localeCompare(b.name)))
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
      <div className="p-6 lg:p-8 max-w-3xl space-y-6">
        <p className="text-sm text-slate-500">
          Brand names must be unique (case-insensitive). You cannot delete a brand that is still used by
          any shoe.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
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
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            Add brand
          </button>
        </form>

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
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                      No brands yet
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
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
                              disabled={saving}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Delete
                            </button>
                          </div>
                        )}
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
