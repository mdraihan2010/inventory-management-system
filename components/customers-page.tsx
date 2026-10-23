'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Pencil, Plus, Power, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Customer = {
  _id: string
  name: string
  phone: string
  email?: string
  address: string
  notes: string
  isActive: boolean
}

type CustomersResponse = {
  success: boolean
  total?: number
  totalPages?: number
  data: Customer[]
}

type SaleSummary = {
  _id: string
  saleNumber: string
  saleDate: string
  grandTotal: number
  outstandingAmount: number
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'
}

type SalesResponse = { success: boolean; data: SaleSummary[] }

type FormState = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

const SALE_STATUS_LABEL: Record<SaleSummary['status'], string> = {
  DRAFT: 'খসড়া',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

const SALE_STATUS_CLASS: Record<SaleSummary['status'], string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

const PAYMENT_LABEL: Record<SaleSummary['paymentStatus'], string> = {
  PAID: 'পরিশোধিত',
  PARTIALLY_PAID: 'আংশিক',
  UNPAID: 'বাকি',
}

const numberFormat = new Intl.NumberFormat('en-IN')

function taka(value: number): string {
  return `৳ ${numberFormat.format(value)}`
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB')
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const buttonClass =
  'rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40'

export function CustomersPage({ canManage }: { canManage: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<{ customer: Customer | null } | null>(null)
  const [details, setDetails] = useState<Customer | null>(null)

  // খোঁজার লেখা লেখা শেষ হওয়ার ৩০০ মিলিসেকেন্ড পরে অনুসন্ধান শুরু হয়
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

    try {
      const response = await apiRequest<CustomersResponse>(`/customers?${params.toString()}`)
      setCustomers(response.data)
      setTotal(response.total ?? response.data.length)
      setTotalPages(Math.max(response.totalPages ?? 1, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'গ্রাহকের তালিকা আনা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  async function toggleActive(customer: Customer) {
    const action = customer.isActive ? 'বন্ধ' : 'চালু'
    if (!window.confirm(`"${customer.name}" গ্রাহককে ${action} করতে চান?`)) return

    setError('')
    setNotice('')
    setBusyId(customer._id)

    try {
      await apiRequest(`/customers/${customer._id}`, {
        method: 'PATCH',
        body: { isActive: !customer.isActive },
      })
      setNotice(`গ্রাহককে ${action} করা হয়েছে।`)
      loadCustomers()
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
          <p className="eyebrow">Workspace / Customers</p>
          <h1>গ্রাহক</h1>
          <p className="subheading">গ্রাহকের তালিকা, যোগাযোগের তথ্য ও বাকির হিসাব।</p>
        </div>
        <button className="primary-button" onClick={() => setForm({ customer: null })}>
          <Plus /> নতুন গ্রাহক
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>গ্রাহকের তালিকা</h2>
            <span>মোট {total} জন</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="নাম, ফোন বা ইমেইল খুঁজুন..."
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
                <th>ফোন</th>
                <th>ইমেইল</th>
                <th>অবস্থা</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5}>লোড হচ্ছে...</td></tr>}
              {!loading && customers.length === 0 && <tr><td colSpan={5}>কোনো গ্রাহক পাওয়া যায়নি।</td></tr>}
              {!loading && customers.map((customer) => (
                <tr key={customer._id}>
                  <td><strong>{customer.name}</strong></td>
                  <td>{customer.phone || '—'}</td>
                  <td>{customer.email || '—'}</td>
                  <td>
                    <span className={`status ${customer.isActive ? 'in-stock' : 'out-of-stock'}`}>
                      {customer.isActive ? 'সক্রিয়' : 'বন্ধ'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className={buttonClass} onClick={() => setDetails(customer)}>বিস্তারিত</button>
                      {canManage && (
                        <>
                          <button className={buttonClass} onClick={() => setForm({ customer })}>
                            <Pencil className="inline size-3" /> সম্পাদনা
                          </button>
                          <button
                            className={buttonClass}
                            disabled={busyId === customer._id}
                            onClick={() => toggleActive(customer)}
                          >
                            <Power className="inline size-3" /> {customer.isActive ? 'বন্ধ' : 'চালু'}
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
        <CustomerModal
          customer={form.customer}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            setNotice(message)
            loadCustomers()
          }}
        />
      )}

      {details && (
        <CustomerDetailModal
          customer={details}
          canManage={canManage}
          onClose={() => setDetails(null)}
          onEdit={() => {
            setForm({ customer: details })
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

function CustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    customer
      ? {
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          notes: customer.notes ?? '',
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
      setFormError('গ্রাহকের নাম লিখুন।')
      return
    }

    const email = form.email.trim()
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setFormError('ইমেইল সঠিক ফরম্যাটে লিখুন, যেমন name@example.com।')
      return
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email,
      address: form.address.trim(),
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      if (customer) {
        await apiRequest(`/customers/${customer._id}`, { method: 'PATCH', body: payload })
        onSaved('গ্রাহকের তথ্য হালনাগাদ করা হয়েছে।')
      } else {
        await apiRequest('/customers', { method: 'POST', body: payload })
        onSaved('নতুন গ্রাহক যোগ করা হয়েছে।')
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={customer ? 'গ্রাহক সম্পাদনা' : 'নতুন গ্রাহক'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="নাম *">
          <input className={inputClass} value={form.name} onChange={setField('name')} />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

function CustomerDetailModal({
  customer,
  canManage,
  onClose,
  onEdit,
}: {
  customer: Customer
  canManage: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [sales, setSales] = useState<SaleSummary[]>([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [salesError, setSalesError] = useState('')

  useEffect(() => {
    apiRequest<SalesResponse>(`/sales?customer=${customer._id}&limit=100`)
      .then((response) => setSales(response.data))
      .catch((err) => setSalesError(err instanceof ApiError ? err.message : 'বিক্রির তথ্য আনা যায়নি।'))
      .finally(() => setLoadingSales(false))
  }, [customer._id])

  // হিসাব শুধু সম্পন্ন বিক্রি থেকে। খসড়া ও বাতিল বিক্রি বাদ যায়
  const completed = sales.filter((sale) => sale.status === 'COMPLETED')
  const totalPurchased = completed.reduce((sum, sale) => sum + sale.grandTotal, 0)
  const totalOutstanding = completed.reduce((sum, sale) => sum + sale.outstandingAmount, 0)

  return (
    <ModalShell title={customer.name} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">ফোন: </span>{customer.phone || '—'}</p>
        <p><span className="text-gray-500">ইমেইল: </span>{customer.email || '—'}</p>
        <p><span className="text-gray-500">ঠিকানা: </span>{customer.address || '—'}</p>
        <p><span className="text-gray-500">অবস্থা: </span>{customer.isActive ? 'সক্রিয়' : 'বন্ধ'}</p>
        {customer.notes && <p className="md:col-span-2"><span className="text-gray-500">মন্তব্য: </span>{customer.notes}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">সম্পন্ন বিক্রি</p>
          <strong>{completed.length} টি</strong>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">মোট কেনা</p>
          <strong>{taka(totalPurchased)}</strong>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">মোট বাকি</p>
          <strong className={totalOutstanding > 0 ? 'text-red-600' : ''}>{taka(totalOutstanding)}</strong>
        </div>
      </div>

      <p className="text-xs text-gray-500">সর্বশেষ ১০০টি বিক্রির ভিত্তিতে হিসাব।</p>

      {loadingSales && <p className="text-sm text-gray-500">বিক্রির তথ্য লোড হচ্ছে...</p>}
      {salesError && <p className="text-sm text-red-600">{salesError}</p>}

      {!loadingSales && !salesError && (
        sales.length === 0 ? (
          <p className="text-sm text-gray-500">এই গ্রাহকের কোনো বিক্রি নেই।</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>বিক্রি নম্বর</th>
                  <th>তারিখ</th>
                  <th>মোট</th>
                  <th>বাকি</th>
                  <th>অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale._id}>
                    <td><strong className="ref-code">{sale.saleNumber}</strong></td>
                    <td>{formatDate(sale.saleDate)}</td>
                    <td>{taka(sale.grandTotal)}</td>
                    <td>{sale.status === 'COMPLETED' ? taka(sale.outstandingAmount) : '—'}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={`status ${SALE_STATUS_CLASS[sale.status]}`}>{SALE_STATUS_LABEL[sale.status]}</span>
                        {sale.status === 'COMPLETED' && (
                          <span className="text-xs text-gray-500">{PAYMENT_LABEL[sale.paymentStatus]}</span>
                        )}
                      </div>
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
