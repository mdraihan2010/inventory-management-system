'use client'
import { rowAction } from '@/components/ui/row-action'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type Ref = { _id: string; name: string; isActive?: boolean }

type Product = {
  _id: string
  name: string
  sku: string
  sellingPrice: number
  currentStock: number
  unit: string
}

type PaymentMethod = 'CASH' | 'MOBILE_BANKING' | 'CARD' | 'BANK_TRANSFER'
type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'

type SaleItem = {
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  lineTotal: number
  costPrice: number | null
}

type Sale = {
  _id: string
  saleNumber: string
  customer: { _id: string; name: string; phone?: string } | null
  items: SaleItem[]
  subtotal: number
  discount: number
  grandTotal: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: PaymentStatus
  status: SaleStatus
  saleDate: string
  notes: string
}

type Payment = {
  _id: string
  amount: number
  method: PaymentMethod
  reference: string
  createdAt: string
}

type SalesResponse = { success: boolean; total: number; page: number; totalPages: number; data: Sale[] }
type ListResponse<T> = { success: boolean; data: T[] }
type PaymentsResponse = { success: boolean; totalPaid: number; data: Payment[] }

const STATUS_LABEL: Record<SaleStatus, string> = {
  DRAFT: 'খসড়া',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

const STATUS_CLASS: Record<SaleStatus, string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PAID: 'পরিশোধিত',
  PARTIALLY_PAID: 'আংশিক',
  UNPAID: 'বাকি',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'নগদ',
  MOBILE_BANKING: 'মোবাইল ব্যাংকিং',
  CARD: 'কার্ড',
  BANK_TRANSFER: 'ব্যাংক ট্রান্সফার',
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

export function SalesPage({ canManage }: { canManage: boolean }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [customers, setCustomers] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [paySale, setPaySale] = useState<Sale | null>(null)

  useEffect(() => {
    apiRequest<ListResponse<Ref>>('/customers?limit=100')
      .then((response) => setCustomers(response.data ?? []))
      .catch(() => setCustomers([]))
  }, [])

  const loadSales = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (statusFilter) params.set('status', statusFilter)
    if (customerFilter) params.set('customer', customerFilter)

    try {
      const response = await apiRequest<SalesResponse>(`/sales?${params.toString()}`)
      setSales(response.data)
      setTotal(response.total)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'বিক্রির তালিকা আনা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, customerFilter])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  function reload(message: string) {
    setNotice(message)
    loadSales()
  }

  async function runAction(sale: Sale, action: 'complete' | 'cancel') {
    const confirmText =
      action === 'complete'
        ? `${sale.saleNumber} সম্পন্ন করলে পণ্যের স্টক কমে যাবে। নিশ্চিত?`
        : `${sale.saleNumber} বিক্রিটি বাতিল করতে চান?`
    if (!window.confirm(confirmText)) return

    setError('')
    setNotice('')
    setBusyId(sale._id)

    try {
      await apiRequest(`/sales/${sale._id}/${action}`, { method: 'POST' })
      reload(
        action === 'complete'
          ? `${sale.saleNumber} সম্পন্ন করা হয়েছে।`
          : `${sale.saleNumber} বাতিল করা হয়েছে।`
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'কাজটি সম্পন্ন করা যায়নি।')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Sales</p>
          <h1>বিক্রি</h1>
          <p className="subheading">বিক্রি তৈরি, সম্পন্ন করা, পরিশোধ নেওয়া ও বাকি দেখা।</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> নতুন বিক্রি
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>বিক্রির তালিকা</h2>
            <span>মোট {total} টি</span>
          </div>
          <div className="toolbar-actions">
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            >
              <option value="">সব অবস্থা</option>
              <option value="DRAFT">খসড়া</option>
              <option value="COMPLETED">সম্পন্ন</option>
              <option value="CANCELLED">বাতিল</option>
            </select>
            <select
              className={inputClass + ' max-w-[12rem] bg-white'}
              value={customerFilter}
              onChange={(event) => { setCustomerFilter(event.target.value); setPage(1) }}
            >
              <option value="">সব গ্রাহক</option>
              <option value="walkin">খুচরা গ্রাহক</option>
              {customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
            </select>
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>বিক্রি নম্বর</th>
                <th>গ্রাহক</th>
                <th>তারিখ</th>
                <th>মোট</th>
                <th>বাকি</th>
                <th>অবস্থা</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}>লোড হচ্ছে...</td></tr>}
              {!loading && sales.length === 0 && <tr><td colSpan={7}>কোনো বিক্রি পাওয়া যায়নি।</td></tr>}
              {!loading && sales.map((sale) => (
                <tr key={sale._id}>
                  <td><strong className="ref-code">{sale.saleNumber}</strong></td>
                  <td>{sale.customer?.name ?? 'খুচরা গ্রাহক'}</td>
                  <td>{formatDate(sale.saleDate)}</td>
                  <td>{taka(sale.grandTotal)}</td>
                  <td>{sale.status === 'COMPLETED' ? taka(sale.outstandingAmount) : '—'}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className={`status ${STATUS_CLASS[sale.status]}`}>{STATUS_LABEL[sale.status]}</span>
                      {sale.status === 'COMPLETED' && (
                        <span className="text-xs text-gray-500">{PAYMENT_LABEL[sale.paymentStatus]}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className={rowAction.view} onClick={() => setDetailSale(sale)}>বিস্তারিত</button>
                      {sale.status === 'DRAFT' && (
                        <button className={rowAction.success} disabled={busyId === sale._id} onClick={() => runAction(sale, 'complete')}>
                          সম্পন্ন করুন
                        </button>
                      )}
                      {sale.status === 'DRAFT' && canManage && (
                        <button className={rowAction.danger} disabled={busyId === sale._id} onClick={() => runAction(sale, 'cancel')}>
                          বাতিল
                        </button>
                      )}
                      {sale.status === 'COMPLETED' && sale.outstandingAmount > 0 && (
                        <button className={rowAction.success} onClick={() => setPaySale(sale)}>পরিশোধ নিন</button>
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

      {creating && (
        <NewSaleModal
          customers={customers}
          onClose={() => setCreating(false)}
          onCreated={(saleNumber) => {
            setCreating(false)
            reload(`খসড়া বিক্রি তৈরি হয়েছে: ${saleNumber}`)
          }}
        />
      )}

      {detailSale && (
        <SaleDetailModal sale={detailSale} canManage={canManage} onClose={() => setDetailSale(null)} />
      )}

      {paySale && (
        <PaymentModal
          sale={paySale}
          onClose={() => setPaySale(null)}
          onPaid={(message) => {
            setPaySale(null)
            reload(message)
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

type DraftRow = { productId: string; quantity: string }

function NewSaleModal({
  customers,
  onClose,
  onCreated,
}: {
  customers: Ref[]
  onClose: () => void
  onCreated: (saleNumber: string) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [customerId, setCustomerId] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([{ productId: '', quantity: '1' }])
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest<ListResponse<Product>>('/products?isActive=true&limit=100')
      .then((response) => setProducts(response.data ?? []))
      .catch(() => setProducts([]))
  }, [])

  const productById = new Map(products.map((product) => [product._id, product]))

  // এই হিসাব শুধু দেখানোর জন্য। চূড়ান্ত দাম সার্ভার নিজে হিসাব করে
  const lineTotals = rows.map((row) => {
    const product = productById.get(row.productId)
    const quantity = Number(row.quantity)
    return product && Number.isFinite(quantity) ? product.sellingPrice * quantity : 0
  })
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0)
  const discountValue = Number(discount || 0)
  const safeDiscount = Number.isFinite(discountValue) ? discountValue : 0
  const payable = subtotal - safeDiscount

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addRow() {
    setRows((previous) => [...previous, { productId: '', quantity: '1' }])
  }

  function removeRow(index: number) {
    setRows((previous) => previous.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const selected = rows.filter((row) => row.productId)
    if (selected.length === 0) {
      setFormError('কমপক্ষে একটি পণ্য বেছে নিন।')
      return
    }

    const ids = selected.map((row) => row.productId)
    if (new Set(ids).size !== ids.length) {
      setFormError('একই পণ্য দুবার যোগ করা যাবে না।')
      return
    }

    for (const row of selected) {
      const quantity = Number(row.quantity)
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setFormError('পরিমাণ ১ বা তার বেশি পূর্ণ সংখ্যা হতে হবে।')
        return
      }
    }

    if (safeDiscount < 0 || safeDiscount > subtotal) {
      setFormError('ছাড় ০ থেকে মোট দামের মধ্যে হতে হবে।')
      return
    }

    setSaving(true)
    try {
      const response = await apiRequest<{ data: Sale }>('/sales', {
        method: 'POST',
        body: {
          customer: customerId || null,
          items: selected.map((row) => ({ productId: row.productId, quantity: Number(row.quantity) })),
          discount: safeDiscount,
          notes: notes.trim(),
        },
      })
      onCreated(response.data.saleNumber)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'বিক্রি তৈরি করা যায়নি।')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="নতুন বিক্রি" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="গ্রাহক (ঐচ্ছিক, না দিলে খুচরা বিক্রি)">
          <select className={inputClass + ' bg-white'} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">খুচরা গ্রাহক</option>
            {customers
              .filter((customer) => customer.isActive !== false)
              .map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
          </select>
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">পণ্য</p>
          {rows.map((row, index) => {
            const product = productById.get(row.productId)
            const quantity = Number(row.quantity)
            const notEnough = product !== undefined && Number.isFinite(quantity) && quantity > product.currentStock

            return (
              <div key={index} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-6">
                  <select className={inputClass + ' bg-white'} value={row.productId} onChange={(event) => updateRow(index, { productId: event.target.value })}>
                    <option value="">পণ্য বেছে নিন</option>
                    {products.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku})</option>)}
                  </select>
                  {product && (
                    <p className={`mt-1 text-xs ${notEnough ? 'text-red-600' : 'text-gray-500'}`}>
                      স্টক: {product.currentStock} {product.unit}{notEnough ? ' (যথেষ্ট নয়)' : ''}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className={inputClass}
                    value={row.quantity}
                    onChange={(event) => updateRow(index, { quantity: event.target.value })}
                  />
                </div>
                <div className="col-span-3 pt-2 text-right text-sm">{taka(lineTotals[index])}</div>
                <div className="col-span-1 pt-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                    aria-label="Remove row"
                    className="text-gray-500 disabled:opacity-30"
                  >
                    <X />
                  </button>
                </div>
              </div>
            )
          })}
          <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:underline">
            + আরেকটি পণ্য যোগ করুন
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="ছাড় (৳)">
            <input type="number" min="0" className={inputClass} value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </Field>
          <Field label="মন্তব্য (ঐচ্ছিক)">
            <input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>

        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>মোট দাম</span><span>{taka(subtotal)}</span></div>
          <div className="flex justify-between"><span>ছাড়</span><span>- {taka(safeDiscount)}</span></div>
          <div className="flex justify-between font-semibold"><span>পরিশোধযোগ্য</span><span>{taka(payable)}</span></div>
        </div>

        <p className="text-xs text-gray-500">
          এটি খসড়া হিসেবে তৈরি হবে। সম্পন্ন করার আগে স্টক কমবে না।
        </p>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'তৈরি হচ্ছে...' : 'খসড়া তৈরি করুন'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}

function PaymentModal({
  sale,
  onClose,
  onPaid,
}: {
  sale: Sale
  onClose: () => void
  onPaid: (message: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const value = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setFormError('পরিশোধের পরিমাণ শূন্যের বেশি হতে হবে।')
      return
    }
    if (value > sale.outstandingAmount) {
      setFormError(`বাকির বেশি নেওয়া যাবে না। সর্বোচ্চ ${taka(sale.outstandingAmount)}।`)
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/sales/${sale._id}/payments`, {
        method: 'POST',
        body: { amount: value, method, reference: reference.trim() },
      })
      onPaid(`${sale.saleNumber}-এ ${taka(value)} পরিশোধ নেওয়া হয়েছে।`)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'পরিশোধ নেওয়া যায়নি।')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="পরিশোধ নিন" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>বিক্রি</span><strong>{sale.saleNumber}</strong></div>
          <div className="flex justify-between"><span>মোট দাম</span><span>{taka(sale.grandTotal)}</span></div>
          <div className="flex justify-between"><span>এখন পর্যন্ত পরিশোধ</span><span>{taka(sale.paidAmount)}</span></div>
          <div className="flex justify-between font-semibold"><span>বাকি</span><span>{taka(sale.outstandingAmount)}</span></div>
        </div>

        <Field label="পরিমাণ (৳) *">
          <div className="flex gap-2">
            <input type="number" min="0" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} />
            <button type="button" onClick={() => setAmount(String(sale.outstandingAmount))} className={buttonClass + ' whitespace-nowrap'}>
              পুরো বাকি
            </button>
          </div>
        </Field>

        <Field label="পদ্ধতি *">
          <select className={inputClass + ' bg-white'} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((key) => (
              <option key={key} value={key}>{METHOD_LABEL[key]}</option>
            ))}
          </select>
        </Field>

        <Field label="Reference (ঐচ্ছিক, যেমন bKash TRX ID)">
          <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'পরিশোধ নিন'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}

function SaleDetailModal({
  sale,
  canManage,
  onClose,
}: {
  sale: Sale
  canManage: boolean
  onClose: () => void
}) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)

  useEffect(() => {
    apiRequest<PaymentsResponse>(`/sales/${sale._id}/payments`)
      .then((response) => setPayments(response.data))
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false))
  }, [sale._id])

  return (
    <ModalShell title={sale.saleNumber} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">গ্রাহক: </span>{sale.customer?.name ?? 'খুচরা গ্রাহক'}</p>
        <p><span className="text-gray-500">তারিখ: </span>{formatDate(sale.saleDate)}</p>
        <p><span className="text-gray-500">অবস্থা: </span>{STATUS_LABEL[sale.status]}</p>
        <p><span className="text-gray-500">পরিশোধ: </span>{sale.status === 'COMPLETED' ? PAYMENT_LABEL[sale.paymentStatus] : '—'}</p>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>পণ্য</th>
              <th>পরিমাণ</th>
              <th>দর</th>
              <th>মোট</th>
              {canManage && <th>ক্রয়মূল্য</th>}
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={index}>
                <td><strong>{item.productName}</strong><br /><span>{item.sku}</span></td>
                <td>{item.quantity}</td>
                <td>{taka(item.unitPrice)}</td>
                <td>{taka(item.lineTotal)}</td>
                {canManage && <td>{item.costPrice === null ? '—' : taka(item.costPrice)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md bg-gray-50 p-3 text-sm">
        <div className="flex justify-between"><span>মোট দাম</span><span>{taka(sale.subtotal)}</span></div>
        <div className="flex justify-between"><span>ছাড়</span><span>- {taka(sale.discount)}</span></div>
        <div className="flex justify-between font-semibold"><span>পরিশোধযোগ্য</span><span>{taka(sale.grandTotal)}</span></div>
        <div className="flex justify-between"><span>পরিশোধ হয়েছে</span><span>{taka(sale.paidAmount)}</span></div>
        <div className="flex justify-between"><span>বাকি</span><span>{taka(sale.outstandingAmount)}</span></div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">পরিশোধের ইতিহাস</p>
        {loadingPayments && <p className="text-sm text-gray-500">লোড হচ্ছে...</p>}
        {!loadingPayments && payments.length === 0 && (
          <p className="text-sm text-gray-500">এখনো কোনো পরিশোধ নেই।</p>
        )}
        {!loadingPayments && payments.length > 0 && (
          <ul className="divide-y text-sm">
            {payments.map((payment) => (
              <li key={payment._id} className="flex justify-between py-2">
                <span>
                  {formatDate(payment.createdAt)} · {METHOD_LABEL[payment.method]}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
                <strong>{taka(payment.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}
