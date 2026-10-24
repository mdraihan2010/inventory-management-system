'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type PurchaseStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

type SupplierRef = { _id: string; name: string; isActive?: boolean }

type ProductRef = {
  _id: string
  name: string
  sku: string
  purchasePrice: number
  currentStock: number
  unit: string
}

type PurchaseRow = {
  _id: string
  purchaseNumber: string
  supplier: string | { _id: string; name?: string } | null
  grandTotal: number
  status: PurchaseStatus
  purchaseDate?: string
}

type PurchaseItem = {
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type PurchaseDetail = PurchaseRow & {
  items: PurchaseItem[]
  subtotal: number
  discount: number
  paidAmount: number
  notes?: string
}

type ListResponse<T> = {
  success: boolean
  data: T[]
  total?: number
  totalPages?: number
}

const STATUS_LABEL: Record<PurchaseStatus, string> = {
  DRAFT: 'খসড়া',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

const STATUS_CLASS: Record<PurchaseStatus, string> = {
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

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

const buttonClass =
  'rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40'

export function PurchasesPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Purchases</p>
            <h1>ক্রয়</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">ক্রয়ের তথ্য শুধু Manager ও Administrator দেখতে পারবেন।</p>
        </section>
      </>
    )
  }

  return <PurchasesManager />
}

function PurchasesManager() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState(false)
  const [detailRow, setDetailRow] = useState<PurchaseRow | null>(null)

  useEffect(() => {
    apiRequest<ListResponse<SupplierRef>>('/suppliers?limit=100')
      .then((response) => setSuppliers(response.data ?? []))
      .catch(() => setSuppliers([]))
  }, [])

  const loadPurchases = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (statusFilter) params.set('status', statusFilter)

    try {
      const response = await apiRequest<ListResponse<PurchaseRow>>(`/purchases?${params.toString()}`)
      setPurchases(response.data)
      setTotal(response.total ?? response.data.length)
      setTotalPages(Math.max(response.totalPages ?? 1, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ক্রয়ের তালিকা আনা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  function reload(message: string) {
    setNotice(message)
    loadPurchases()
  }

  const supplierNameById = new Map(suppliers.map((supplier) => [supplier._id, supplier.name]))

  function supplierLabel(purchase: PurchaseRow): string {
    if (purchase.supplier && typeof purchase.supplier === 'object') {
      return purchase.supplier.name ?? '—'
    }
    if (typeof purchase.supplier === 'string') {
      return supplierNameById.get(purchase.supplier) ?? '—'
    }
    return '—'
  }

  async function runAction(purchase: PurchaseRow, action: 'complete' | 'cancel') {
    const confirmText =
      action === 'complete'
        ? `${purchase.purchaseNumber} সম্পন্ন করলে পণ্যের স্টক বেড়ে যাবে। নিশ্চিত?`
        : `${purchase.purchaseNumber} ক্রয়টি বাতিল করতে চান?`
    if (!window.confirm(confirmText)) return

    setError('')
    setNotice('')
    setBusyId(purchase._id)

    try {
      await apiRequest(`/purchases/${purchase._id}/${action}`, { method: 'POST' })
      reload(
        action === 'complete'
          ? `${purchase.purchaseNumber} সম্পন্ন করা হয়েছে, স্টক বাড়ানো হয়েছে।`
          : `${purchase.purchaseNumber} বাতিল করা হয়েছে।`
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
          <p className="eyebrow">Workspace / Purchases</p>
          <h1>ক্রয়</h1>
          <p className="subheading">সরবরাহকারীর কাছ থেকে পণ্য ক্রয়, সম্পন্ন করা ও স্টক বাড়ানো।</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> নতুন ক্রয়
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>ক্রয়ের তালিকা</h2>
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
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ক্রয় নম্বর</th>
                <th>সরবরাহকারী</th>
                <th>তারিখ</th>
                <th>মোট</th>
                <th>অবস্থা</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6}>লোড হচ্ছে...</td></tr>}
              {!loading && purchases.length === 0 && <tr><td colSpan={6}>কোনো ক্রয় পাওয়া যায়নি।</td></tr>}
              {!loading && purchases.map((purchase) => (
                <tr key={purchase._id}>
                  <td><strong className="ref-code">{purchase.purchaseNumber}</strong></td>
                  <td>{supplierLabel(purchase)}</td>
                  <td>{formatDate(purchase.purchaseDate)}</td>
                  <td>{taka(purchase.grandTotal)}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[purchase.status]}`}>{STATUS_LABEL[purchase.status]}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className={buttonClass} onClick={() => setDetailRow(purchase)}>বিস্তারিত</button>
                      {purchase.status === 'DRAFT' && (
                        <button className={buttonClass} disabled={busyId === purchase._id} onClick={() => runAction(purchase, 'complete')}>
                          সম্পন্ন করুন
                        </button>
                      )}
                      {purchase.status === 'DRAFT' && (
                        <button className={buttonClass} disabled={busyId === purchase._id} onClick={() => runAction(purchase, 'cancel')}>
                          বাতিল
                        </button>
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
        <NewPurchaseModal
          suppliers={suppliers}
          onClose={() => setCreating(false)}
          onCreated={(purchaseNumber) => {
            setCreating(false)
            reload(`খসড়া ক্রয় তৈরি হয়েছে: ${purchaseNumber}`)
          }}
        />
      )}

      {detailRow && (
        <PurchaseDetailModal
          purchase={detailRow}
          supplierName={supplierLabel(detailRow)}
          onClose={() => setDetailRow(null)}
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

type DraftRow = { productId: string; quantity: string; unitPrice: string }

function NewPurchaseModal({
  suppliers,
  onClose,
  onCreated,
}: {
  suppliers: SupplierRef[]
  onClose: () => void
  onCreated: (purchaseNumber: string) => void
}) {
  const [products, setProducts] = useState<ProductRef[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([{ productId: '', quantity: '1', unitPrice: '' }])
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest<ListResponse<ProductRef>>('/products?isActive=true&limit=100')
      .then((response) => setProducts(response.data ?? []))
      .catch(() => setProducts([]))
  }, [])

  const productById = new Map(products.map((product) => [product._id, product]))

  // এই হিসাব শুধু দেখানোর জন্য। চূড়ান্ত হিসাব সার্ভার নিজে করে
  const lineTotals = rows.map((row) => {
    const quantity = Number(row.quantity)
    const unitPrice = Number(row.unitPrice)
    return Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0
  })
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0)
  const discountValue = Number(discount || 0)
  const safeDiscount = Number.isFinite(discountValue) ? discountValue : 0
  const payable = subtotal - safeDiscount

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((previous) => previous.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  // পণ্য বাছলে তার বর্তমান ক্রয়মূল্য আপনাআপনি বসে, পরে বদলানো যাবে
  function chooseProduct(index: number, productId: string) {
    const product = productById.get(productId)
    updateRow(index, {
      productId,
      unitPrice: product ? String(product.purchasePrice) : '',
    })
  }

  function addRow() {
    setRows((previous) => [...previous, { productId: '', quantity: '1', unitPrice: '' }])
  }

  function removeRow(index: number) {
    setRows((previous) => previous.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!supplierId) {
      setFormError('সরবরাহকারী বেছে নিন।')
      return
    }

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
      const unitPrice = Number(row.unitPrice)
      if (row.unitPrice.trim() === '' || !Number.isFinite(unitPrice) || unitPrice < 0) {
        setFormError('ক্রয়মূল্য সঠিকভাবে লিখুন।')
        return
      }
    }

    if (safeDiscount < 0 || safeDiscount > subtotal) {
      setFormError('ছাড় ০ থেকে মোট দামের মধ্যে হতে হবে।')
      return
    }

    setSaving(true)
    try {
      const response = await apiRequest<{ data: PurchaseDetail }>('/purchases', {
        method: 'POST',
        body: {
          supplier: supplierId,
          items: selected.map((row) => ({
            productId: row.productId,
            quantity: Number(row.quantity),
            unitPrice: Number(row.unitPrice),
          })),
          discount: safeDiscount,
          notes: notes.trim(),
        },
      })
      onCreated(response.data.purchaseNumber)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'ক্রয় তৈরি করা যায়নি।')
      setSaving(false)
    }
  }

  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive !== false)

  return (
    <ModalShell title="নতুন ক্রয়" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="সরবরাহকারী *">
          <select className={inputClass + ' bg-white'} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">বেছে নিন</option>
            {activeSuppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
          </select>
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">পণ্য</p>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-12 items-start gap-2">
              <div className="col-span-5">
                <select className={inputClass + ' bg-white'} value={row.productId} onChange={(event) => chooseProduct(index, event.target.value)}>
                  <option value="">পণ্য বেছে নিন</option>
                  {products.map((product) => <option key={product._id} value={product._id}>{product.name} ({product.sku})</option>)}
                </select>
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
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={row.unitPrice}
                  onChange={(event) => updateRow(index, { unitPrice: event.target.value })}
                />
              </div>
              <div className="col-span-2 pt-2 text-right text-sm">{taka(lineTotals[index])}</div>
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
          ))}
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
          <div className="flex justify-between"><span>মোট</span><span>{taka(subtotal)}</span></div>
          <div className="flex justify-between"><span>ছাড়</span><span>- {taka(safeDiscount)}</span></div>
          <div className="flex justify-between font-semibold"><span>পরিশোধযোগ্য</span><span>{taka(payable)}</span></div>
        </div>

        <p className="text-xs text-gray-500">
          এটি খসড়া হিসেবে তৈরি হবে। সম্পন্ন করলে তবেই পণ্যের স্টক বাড়বে।
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

function PurchaseDetailModal({
  purchase,
  supplierName,
  onClose,
}: {
  purchase: PurchaseRow
  supplierName: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    apiRequest<{ data: PurchaseDetail }>(`/purchases/${purchase._id}`)
      .then((response) => setDetail(response.data))
      .catch((err) => setDetailError(err instanceof ApiError ? err.message : 'বিস্তারিত আনা যায়নি।'))
      .finally(() => setLoading(false))
  }, [purchase._id])

  return (
    <ModalShell title={purchase.purchaseNumber} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">সরবরাহকারী: </span>{supplierName}</p>
        <p><span className="text-gray-500">তারিখ: </span>{formatDate(purchase.purchaseDate)}</p>
        <p><span className="text-gray-500">অবস্থা: </span>{STATUS_LABEL[purchase.status]}</p>
        {detail?.notes && <p className="md:col-span-2"><span className="text-gray-500">মন্তব্য: </span>{detail.notes}</p>}
      </div>

      {loading && <p className="text-sm text-gray-500">লোড হচ্ছে...</p>}
      {detailError && <p className="text-sm text-red-600">{detailError}</p>}

      {detail && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>পণ্য</th>
                  <th>পরিমাণ</th>
                  <th>ক্রয়মূল্য</th>
                  <th>মোট</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, index) => (
                  <tr key={index}>
                    <td><strong>{item.productName}</strong><br /><span>{item.sku}</span></td>
                    <td>{item.quantity}</td>
                    <td>{taka(item.unitPrice)}</td>
                    <td>{taka(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between"><span>মোট</span><span>{taka(detail.subtotal)}</span></div>
            <div className="flex justify-between"><span>ছাড়</span><span>- {taka(detail.discount)}</span></div>
            <div className="flex justify-between font-semibold"><span>মোট বিল</span><span>{taka(detail.grandTotal)}</span></div>
          </div>
        </>
      )}
    </ModalShell>
  )
}
