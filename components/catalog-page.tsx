'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Pencil, Plus, Power, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Kind = 'categories' | 'brands'

type CatalogItem = {
  _id: string
  name: string
  description?: string
  isActive: boolean
}

type ListResponse = {
  success: boolean
  count?: number
  data: CatalogItem[]
}

const KIND_TEXT: Record<Kind, { title: string; eyebrow: string; subtitle: string; addLabel: string; empty: string }> = {
  categories: {
    title: 'ক্যাটাগরি',
    eyebrow: 'Workspace / Categories',
    subtitle: 'পণ্যের ক্যাটাগরি যোগ ও ব্যবস্থাপনা।',
    addLabel: 'নতুন ক্যাটাগরি',
    empty: 'কোনো ক্যাটাগরি পাওয়া যায়নি।',
  },
  brands: {
    title: 'ব্র্যান্ড',
    eyebrow: 'Workspace / Brands',
    subtitle: 'পণ্যের ব্র্যান্ড যোগ ও ব্যবস্থাপনা।',
    addLabel: 'নতুন ব্র্যান্ড',
    empty: 'কোনো ব্র্যান্ড পাওয়া যায়নি।',
  },
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const buttonClass =
  'rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40'

export function CategoriesPage({ canManage }: { canManage: boolean }) {
  return <CatalogManager kind="categories" canManage={canManage} />
}

export function BrandsPage({ canManage }: { canManage: boolean }) {
  return <CatalogManager kind="brands" canManage={canManage} />
}

function CatalogManager({ kind, canManage }: { kind: Kind; canManage: boolean }) {
  const text = KIND_TEXT[kind]
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<{ item: CatalogItem | null } | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiRequest<ListResponse>(`/${kind}`)
      setItems(response.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `${text.title}-এর তালিকা আনা যায়নি।`)
    } finally {
      setLoading(false)
    }
  }, [kind, text.title])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const query = search.trim().toLowerCase()
  const visible = query ? items.filter((item) => item.name.toLowerCase().includes(query)) : items

  async function toggleActive(item: CatalogItem) {
    const action = item.isActive ? 'বন্ধ' : 'চালু'
    if (!window.confirm(`"${item.name}" ${action} করতে চান?`)) return

    setError('')
    setNotice('')
    setBusyId(item._id)

    try {
      await apiRequest(`/${kind}/${item._id}`, {
        method: 'PATCH',
        body: { isActive: !item.isActive },
      })
      setNotice(`${text.title} ${action} করা হয়েছে।`)
      loadItems()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'পরিবর্তন সংরক্ষণ করা যায়নি।')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
          <p className="subheading">{text.subtitle}</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={() => setEditing({ item: null })}>
            <Plus /> {text.addLabel}
          </button>
        )}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>{text.title}-এর তালিকা</h2>
            <span>মোট {items.length} টি</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="নাম খুঁজুন..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>নাম</th>
                <th>বিবরণ</th>
                <th>অবস্থা</th>
                {canManage && <th>কাজ</th>}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={canManage ? 4 : 3}>লোড হচ্ছে...</td></tr>}
              {!loading && visible.length === 0 && (
                <tr><td colSpan={canManage ? 4 : 3}>{text.empty}</td></tr>
              )}
              {!loading && visible.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.description || '—'}</td>
                  <td>
                    <span className={`status ${item.isActive ? 'in-stock' : 'out-of-stock'}`}>
                      {item.isActive ? 'সক্রিয়' : 'বন্ধ'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex gap-1">
                        <button className={buttonClass} onClick={() => setEditing({ item })}>
                          <Pencil className="inline size-3" /> সম্পাদনা
                        </button>
                        <button
                          className={buttonClass}
                          disabled={busyId === item._id}
                          onClick={() => toggleActive(item)}
                        >
                          <Power className="inline size-3" /> {item.isActive ? 'বন্ধ' : 'চালু'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <CatalogModal
          kind={kind}
          title={text.title}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            setNotice(message)
            loadItems()
          }}
        />
      )}
    </>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CatalogModal({
  kind,
  title,
  item,
  onClose,
  onSaved,
}: {
  kind: Kind
  title: string
  item: CatalogItem | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!name.trim()) {
      setFormError(`${title}-এর নাম লিখুন।`)
      return
    }

    const payload = { name: name.trim(), description: description.trim() }

    setSaving(true)
    try {
      if (item) {
        await apiRequest(`/${kind}/${item._id}`, { method: 'PATCH', body: payload })
        onSaved(`${title}-এর তথ্য হালনাগাদ করা হয়েছে।`)
      } else {
        await apiRequest(`/${kind}`, { method: 'POST', body: payload })
        onSaved(`নতুন ${title} যোগ করা হয়েছে।`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError(`এই নামে ইতিমধ্যে একটি ${title} আছে।`)
      } else {
        setFormError(err instanceof ApiError ? err.message : 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।')
      }
      setSaving(false)
    }
  }

  return (
    <ModalShell title={item ? `${title} সম্পাদনা` : `নতুন ${title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">নাম *</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">বিবরণ (ঐচ্ছিক)</span>
          <textarea className={inputClass} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
