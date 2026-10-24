'use client'
import { rowAction } from '@/components/ui/row-action'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Pencil, Plus, Power, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Supplier = {
  _id: string
  name: string
  companyName: string
  phone: string
  email?: string
  address: string
  notes: string
  isActive: boolean
}

type SuppliersResponse = {
  success: boolean
  total?: number
  totalPages?: number
  data: Supplier[]
}

type PurchaseSummary = {
  _id: string
  purchaseNumber: string
  purchaseDate?: string
  grandTotal: number
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  supplier: string | { _id: string; name?: string } | null
}

type PurchasesResponse = { success: boolean; data: PurchaseSummary[] }

type FormState = {
  name: string
  companyName: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  companyName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const PURCHASE_STATUS_LABEL: Record<PurchaseSummary['status'], string> = {
  DRAFT: 'খসড়া',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

const PURCHASE_STATUS_CLASS: Record<PurchaseSummary['status'], string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

const numberFormat = new Intl.NumberFormat('en-IN')

function taka(value: number): string {
  return `৳ ${numberFormat.format(value)}`
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

// Purchase-এর supplier কখনো শুধু id, কখনো populate করা object হতে পারে
function supplierIdOf(purchase: PurchaseSummary): string | null {
  if (!purchase.supplier) return null
  return typeof purchase.supplier === 'string' ? purchase.supplier : purchase.supplier._id
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const buttonClass =
  'rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40'

export function SuppliersPage({ canManage }: { canManage: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<{ supplier: Supplier | null } | null>(null)
  const [details, setDetails] = useState<Supplier | null>(null)

  // খোঁজার লেখা লেখা শেষ হওয়ার ৩০০ মিলিসেকেন্ড পরে অনুসন্ধান শুরু হয়
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

    try {
      const response = await apiRequest<SuppliersResponse>(`/suppliers?${params.toString()}`)
      setSuppliers(response.data)
      setTotal(response.total ?? response.data.length)
      setTotalPages(Math.max(response.totalPages ?? 1, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'সরবরাহকারীর তালিকা আনা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  async function toggleActive(supplier: Supplier) {
    const action = supplier.isActive ? 'বন্ধ' : 'চালু'
    if (!window.confirm(`"${supplier.name}" সরবরাহকারীকে ${action} করতে চান?`)) return

    setError('')
    setNotice('')
    setBusyId(supplier._id)

    try {
      await apiRequest(`/suppliers/${supplier._id}`, {
        method: 'PATCH',
        body: { isActive: !supplier.isActive },
      })
      setNotice(`সরবরাহকারীকে ${action} করা হয়েছে।`)
      loadSuppliers()
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
          <p className="eyebrow">Workspace / Suppliers</p>
          <h1>সরবরাহকারী</h1>
          <p className="subheading">সরবরাহকারীর তালিকা, যোগাযোগের তথ্য ও ক্রয়ের হিসাব।</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={() => setForm({ supplier: null })}>
            <Plus /> নতুন সরবরাহকারী
          </button>
        )}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>সরবরাহকারীর তালিকা</h2>
            <span>মোট {total} টি</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="নাম, কোম্পানি বা ফোন খুঁজুন..."
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
                <th>কোম্পানি</th>
                <th>ফোন</th>
                <th>ইমেইল</th>
                <th>অবস্থা</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6}>লোড হচ্ছে...</td></tr>}
              {!loading && suppliers.length === 0 && <tr><td colSpan={6}>কোনো সরবরাহকারী পাওয়া যায়নি।</td></tr>}
              {!loading && suppliers.map((supplier) => (
                <tr key={supplier._id}>
                  <td><strong>{supplier.name}</strong></td>
                  <td>{supplier.companyName || '—'}</td>
                  <td>{supplier.phone || '—'}</td>
                  <td>{supplier.email || '—'}</td>
                  <td>
                    <span className={`status ${supplier.isActive ? 'in-stock' : 'out-of-stock'}`}>
                      {supplier.isActive ? 'সক্রিয়' : 'বন্ধ'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className={rowAction.view} onClick={() => setDetails(supplier)}>বিস্তারিত</button>
                      {canManage && (
                        <>
                          <button className={rowAction.edit} onClick={() => setForm({ supplier })}>
                            <Pencil className="inline size-3" /> সম্পাদনা
                          </button>
                          <button
                            className={supplier.isActive ? rowAction.danger : rowAction.success}
                            disabled={busyId === supplier._id}
                            onClick={() => toggleActive(supplier)}
                          >
                            <Power className="inline size-3" /> {supplier.isActive ? 'বন্ধ' : 'চালু'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span>পৃষ্ঠা {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              আগের
            </button>
            <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              পরের
            </button>
          </div>
        </div>
      </section>

      {form && (
        <SupplierModal
          supplier={form.supplier}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            setNotice(message)
            loadSuppliers()
          }}
        />
      )}

      {details && (
        <SupplierDetailModal
          supplier={details}
          canManage={canManage}
          onClose={() => setDetails(null)}
          onEdit={() => {
            setForm({ supplier: details })
            setDetails(null)
          }}
        />
      )}
    </>
  )
}

function ModalShell({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl`}>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function SupplierModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    supplier
      ? {
          name: supplier.name,
          companyName: supplier.companyName ?? '',
          phone: supplier.phone ?? '',
          email: supplier.email ?? '',
          address: supplier.address ?? '',
          notes: supplier.notes ?? '',
        }
      : EMPTY_FORM
  )
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function setField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setForm((previous) => ({ ...previous, [field]: value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!form.name.trim()) {
      setFormError('সরবরাহকারীর নাম লিখুন।')
      return
    }

    const email = form.email.trim()
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFormError('ইমেইল সঠিক ফরম্যাটে লিখুন, যেমন name@example.com।')
      return
    }

    const payload = {
      name: form.name.trim(),
      companyName: form.companyName.trim(),
      phone: form.phone.trim(),
      email,
      address: form.address.trim(),
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      if (supplier) {
        await apiRequest(`/suppliers/${supplier._id}`, { method: 'PATCH', body: payload })
        onSaved('সরবরাহকারীর তথ্য হালনাগাদ করা হয়েছে।')
      } else {
        await apiRequest('/suppliers', { method: 'POST', body: payload })
        onSaved('নতুন সরবরাহকারী যোগ করা হয়েছে।')
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={supplier ? 'সরবরাহকারী সম্পাদনা' : 'নতুন সরবরাহকারী'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="নাম *">
            <input className={inputClass} value={form.name} onChange={setField('name')} />
          </Field>
          <Field label="কোম্পানির নাম (ঐচ্ছিক)">
            <input className={inputClass} value={form.companyName} onChange={setField('companyName')} />
          </Field>
          <Field label="ফোন">
            <input className={inputClass} value={form.phone} onChange={setField('phone')} />
          </Field>
          <Field label="ইমেইল (ঐচ্ছিক)">
            <input type="email" className={inputClass} value={form.email} onChange={setField('email')} />
          </Field>
        </div>
        <Field label="ঠিকানা (ঐচ্ছিক)">
          <input className={inputClass} value={form.address} onChange={setField('address')} />
        </Field>
        <Field label="মন্তব্য (ঐচ্ছিক)">
          <textarea className={inputClass} rows={2} value={form.notes} onChange={setField('notes')} />
        </Field>

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

function SupplierDetailModal({
  supplier,
  canManage,
  onClose,
  onEdit,
}: {
  supplier: Supplier
  canManage: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(true)
  const [purchaseError, setPurchaseError] = useState('')

  useEffect(() => {
    apiRequest<PurchasesResponse>('/purchases?limit=100')
      .then((response) => {
        setPurchases(response.data.filter((purchase) => supplierIdOf(purchase) === supplier._id))
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setPurchaseError('ক্রয়ের তথ্য দেখার অনুমতি আপনার নেই।')
        } else {
          setPurchaseError(err instanceof ApiError ? err.message : 'ক্রয়ের তথ্য আনা যায়নি।')
        }
      })
      .finally(() => setLoadingPurchases(false))
  }, [supplier._id])

  // হিসাব শুধু সম্পন্ন ক্রয় থেকে। খসড়া ও বাতিল ক্রয় বাদ যায়
  const completed = purchases.filter((purchase) => purchase.status === 'COMPLETED')
  const totalPurchased = completed.reduce((sum, purchase) => sum + purchase.grandTotal, 0)

  return (
    <ModalShell title={supplier.name} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">কোম্পানি: </span>{supplier.companyName || '—'}</p>
        <p><span className="text-gray-500">ফোন: </span>{supplier.phone || '—'}</p>
        <p><span className="text-gray-500">ইমেইল: </span>{supplier.email || '—'}</p>
        <p><span className="text-gray-500">অবস্থা: </span>{supplier.isActive ? 'সক্রিয়' : 'বন্ধ'}</p>
        <p className="md:col-span-2"><span className="text-gray-500">ঠিকানা: </span>{supplier.address || '—'}</p>
        {supplier.notes && <p className="md:col-span-2"><span className="text-gray-500">মন্তব্য: </span>{supplier.notes}</p>}
      </div>

      {!purchaseError && (
        <>
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-gray-500">সম্পন্ন ক্রয়</p>
              <strong>{completed.length} টি</strong>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-gray-500">মোট ক্রয়মূল্য</p>
              <strong>{taka(totalPurchased)}</strong>
            </div>
          </div>

          <p className="text-xs text-gray-500">সর্বশেষ ১০০টি ক্রয়ের ভিত্তিতে হিসাব।</p>
        </>
      )}

      {loadingPurchases && <p className="text-sm text-gray-500">ক্রয়ের তথ্য লোড হচ্ছে...</p>}
      {purchaseError && <p className="text-sm text-red-600">{purchaseError}</p>}

      {!loadingPurchases && !purchaseError && (
        purchases.length === 0 ? (
          <p className="text-sm text-gray-500">এই সরবরাহকারীর কোনো ক্রয় নেই।</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ক্রয় নম্বর</th>
                  <th>তারিখ</th>
                  <th>মোট</th>
                  <th>অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase._id}>
                    <td><strong className="ref-code">{purchase.purchaseNumber}</strong></td>
                    <td>{formatDate(purchase.purchaseDate)}</td>
                    <td>{taka(purchase.grandTotal)}</td>
                    <td>
                      <span className={`status ${PURCHASE_STATUS_CLASS[purchase.status]}`}>
                        {PURCHASE_STATUS_LABEL[purchase.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {canManage && (
        <div className="flex justify-end">
          <button type="button" onClick={onEdit} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            সম্পাদনা করুন
          </button>
        </div>
      )}
    </ModalShell>
  )
}
