'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type ReturnKind = 'CUSTOMER' | 'SUPPLIER'

type ReturnRow = {
  _id: string
  returnNumber: string
  kind: ReturnKind
  sale: { _id: string; saleNumber: string } | null
  purchase: { _id: string; purchaseNumber: string } | null
  customer: { _id: string; name: string } | null
  supplier: { _id: string; name: string; companyName?: string } | null
  items: { productName: string; sku: string; quantity: number; lineTotal: number }[]
  totalValue: number
  creditApplied: number
  cashRefund: number
  refundMethod: string | null
  reason: string
  createdAt: string
}

type ListResponse<T> = {
  success: boolean
  total: number
  page: number
  totalPages: number
  data: T[]
}

type SaleSource = {
  _id: string
  saleNumber: string
  grandTotal: number
  outstandingAmount: number
  status: string
  saleDate: string
  customer: { name: string } | null
}

type PurchaseSource = {
  _id: string
  purchaseNumber: string
  grandTotal: number
  status: string
  purchaseDate?: string
  supplier: string | { _id: string; name?: string } | null
}

// বিক্রি ও ক্রয়কে একই রূপে আনার জন্য
type Source = {
  _id: string
  number: string
  total: number
  outstanding: number
  date?: string
  party: string
}

type ReturnableRaw = {
  productId: string
  productName: string
  sku: string
  unitPrice: number
  remaining: number
  soldQuantity?: number
  purchasedQuantity?: number
  returnedQuantity: number
}

type ReturnableItem = {
  productId: string
  productName: string
  sku: string
  unitPrice: number
  remaining: number
  totalQuantity: number
}

const KIND_LABEL: Record<ReturnKind, string> = {
  CUSTOMER: 'গ্রাহকের ফেরত',
  SUPPLIER: 'সরবরাহকারীকে ফেরত',
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'নগদ',
  MOBILE_BANKING: 'মোবাইল ব্যাংকিং',
  CARD: 'কার্ড',
  BANK_TRANSFER: 'ব্যাংক ট্রান্সফার',
}

const REFUND_METHODS = ['CASH', 'MOBILE_BANKING', 'CARD', 'BANK_TRANSFER']

const numberFormat = new Intl.NumberFormat('en-IN')

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

function taka(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `৳ ${numberFormat.format(value)}`
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

function sourceFromSale(sale: SaleSource): Source {
  return {
    _id: sale._id,
    number: sale.saleNumber,
    total: sale.grandTotal,
    outstanding: sale.outstandingAmount,
    date: sale.saleDate,
    party: sale.customer?.name ?? 'খুচরা গ্রাহক',
  }
}

function sourceFromPurchase(purchase: PurchaseSource): Source {
  const party =
    purchase.supplier && typeof purchase.supplier === 'object' ? purchase.supplier.name ?? '—' : '—'
  return {
    _id: purchase._id,
    number: purchase.purchaseNumber,
    total: purchase.grandTotal,
    outstanding: 0,
    date: purchase.purchaseDate,
    party,
  }
}

function partyLabel(row: ReturnRow): string {
  if (row.kind === 'CUSTOMER') return row.customer?.name ?? 'খুচরা গ্রাহক'
  if (row.supplier) return row.supplier.companyName || row.supplier.name
  return '—'
}

export function ReturnsPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Returns</p>
            <h1>ফেরত</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">ফেরতের হিসাব শুধু Manager ও Administrator দেখতে ও করতে পারবেন।</p>
        </section>
      </>
    )
  }

  return <ReturnsManager />
}

function ReturnsManager() {
  const [filter, setFilter] = useState<'' | ReturnKind>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState<ReturnKind | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (filter) params.set('kind', filter)

    try {
      const response = await apiRequest<ListResponse<ReturnRow>>(`/returns?${params.toString()}`)
      setRows(response.data)
      setTotal(response.total)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setError(errorText(err, 'ফেরতের তালিকা আনা যায়নি।'))
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    load()
  }, [load])

  function changeFilter(next: '' | ReturnKind) {
    setFilter(next)
    setPage(1)
  }

  const filterButtons: ('' | ReturnKind)[] = ['', 'CUSTOMER', 'SUPPLIER']

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Returns</p>
          <h1>ফেরত</h1>
          <p className="subheading">গ্রাহকের ফেরত ও সরবরাহকারীকে ফেরতের হিসাব। স্টক ও বাকি এখান থেকে সমন্বয় হয়।</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" onClick={() => setCreating('CUSTOMER')}>
            <Plus /> গ্রাহকের ফেরত
          </button>
          <button className="primary-button" onClick={() => setCreating('SUPPLIER')}>
            <Plus /> সরবরাহকারীকে ফেরত
          </button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map((key) => (
              <button
                key={key || 'all'}
                onClick={() => changeFilter(key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  filter === key
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {key === '' ? 'সব' : KIND_LABEL[key]}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">মোট {total} টি</span>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ফেরত নম্বর</th>
                <th>ধরন</th>
                <th>সূত্র</th>
                <th>পক্ষ</th>
                <th>পণ্য</th>
                <th>মূল্য</th>
                <th>বাকি সমন্বয়</th>
                <th>নগদ ফেরত</th>
                <th>তারিখ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9}>লোড হচ্ছে...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9}>কোনো ফেরত পাওয়া যায়নি।</td></tr>}
              {!loading && rows.map((row) => (
                <tr key={row._id}>
                  <td><strong className="ref-code">{row.returnNumber}</strong></td>
                  <td>{KIND_LABEL[row.kind]}</td>
                  <td>{row.sale?.saleNumber ?? row.purchase?.purchaseNumber ?? '—'}</td>
                  <td>{partyLabel(row)}</td>
                  <td>{row.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</td>
                  <td>{taka(row.totalValue)}</td>
                  <td>{row.kind === 'CUSTOMER' ? taka(row.creditApplied) : '—'}</td>
                  <td>
                    {row.cashRefund > 0
                      ? `${taka(row.cashRefund)} (${METHOD_LABEL[row.refundMethod ?? ''] ?? '—'})`
                      : '—'}
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
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
        <NewReturnModal
          kind={creating}
          onClose={() => setCreating(null)}
          onSaved={(message) => {
            setCreating(null)
            setNotice(message)
            load()
          }}
        />
      )}
    </>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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

function NewReturnModal({
  kind,
  onClose,
  onSaved,
}: {
  kind: ReturnKind
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [sources, setSources] = useState<Source[]>([])
  const [loadingSources, setLoadingSources] = useState(true)
  const [sourceId, setSourceId] = useState('')
  const [items, setItems] = useState<ReturnableItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('CASH')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // কেবল সম্পন্ন বিক্রি বা ক্রয় দেখানো হয়। খসড়া ও বাতিলে ফেরতের প্রশ্ন ওঠে না
  useEffect(() => {
    setLoadingSources(true)
    const path =
      kind === 'CUSTOMER'
        ? '/sales?status=COMPLETED&limit=100'
        : '/purchases?status=COMPLETED&limit=100'

    apiRequest<{ data: (SaleSource | PurchaseSource)[] }>(path)
      .then((response) => {
        const completed = response.data.filter((row) => row.status === 'COMPLETED')
        setSources(
          kind === 'CUSTOMER'
            ? (completed as SaleSource[]).map(sourceFromSale)
            : (completed as PurchaseSource[]).map(sourceFromPurchase)
        )
      })
      .catch((err) => setFormError(errorText(err, 'তালিকা আনা যায়নি।')))
      .finally(() => setLoadingSources(false))
  }, [kind])

  // বিক্রি বা ক্রয় বদলালে ফেরতযোগ্য পণ্য নতুন করে আনা হয়
  useEffect(() => {
    setQuantities({})
    if (!sourceId) {
      setItems([])
      return
    }

    setLoadingItems(true)
    setFormError('')
    const path =
      kind === 'CUSTOMER'
        ? `/returns/sales/${sourceId}/returnable`
        : `/returns/purchases/${sourceId}/returnable`

    apiRequest<{ data: { items: ReturnableRaw[] } }>(path)
      .then((response) => {
        setItems(
          response.data.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unitPrice: item.unitPrice,
            remaining: item.remaining,
            totalQuantity: item.soldQuantity ?? item.purchasedQuantity ?? 0,
          }))
        )
      })
      .catch((err) => {
        setItems([])
        setFormError(errorText(err, 'ফেরতযোগ্য পণ্য আনা যায়নি।'))
      })
      .finally(() => setLoadingItems(false))
  }, [sourceId, kind])

  const source = sources.find((item) => item._id === sourceId)

  const lines = items
    .map((item) => ({ item, quantity: Number(quantities[item.productId] || 0) }))
    .filter((line) => line.quantity > 0)

  const totalValue = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.item.unitPrice, 0))
  const creditPreview =
    kind === 'CUSTOMER' && source ? roundMoney(Math.min(totalValue, source.outstanding)) : 0
  const cashPreview = kind === 'CUSTOMER' ? roundMoney(totalValue - creditPreview) : 0

  function setQuantity(productId: string, value: string) {
    setQuantities((previous) => ({ ...previous, [productId]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!sourceId) {
      setFormError(kind === 'CUSTOMER' ? 'একটি বিক্রি বেছে নিন।' : 'একটি ক্রয় বেছে নিন।')
      return
    }

    if (lines.length === 0) {
      setFormError('কমপক্ষে একটি পণ্যের ফেরতের পরিমাণ লিখুন।')
      return
    }

    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity > line.item.remaining) {
        setFormError(`${line.item.productName}: সর্বোচ্চ ${line.item.remaining} টি ফেরত দেওয়া যাবে। পূর্ণ সংখ্যায় লিখুন।`)
        return
      }
    }

    if (!reason.trim()) {
      setFormError('ফেরতের কারণ লিখুন।')
      return
    }

    if (kind === 'CUSTOMER' && cashPreview > 0 && !REFUND_METHODS.includes(refundMethod)) {
      setFormError('নগদ ফেরতের পদ্ধতি বেছে নিন।')
      return
    }

    const payloadItems = lines.map((line) => ({
      productId: line.item.productId,
      quantity: line.quantity,
    }))

    const body =
      kind === 'CUSTOMER'
        ? {
            saleId: sourceId,
            items: payloadItems,
            reason: reason.trim(),
            ...(cashPreview > 0 ? { refundMethod } : {}),
          }
        : {
            purchaseId: sourceId,
            items: payloadItems,
            reason: reason.trim(),
          }

    setSaving(true)
    try {
      const response = await apiRequest<{ data: { return: { returnNumber: string } } }>(
        kind === 'CUSTOMER' ? '/returns/customer' : '/returns/supplier',
        { method: 'POST', body }
      )
      onSaved(`${KIND_LABEL[kind]} ${response.data.return.returnNumber} সংরক্ষণ হয়েছে।`)
    } catch (err) {
      setFormError(errorText(err, 'ফেরত সংরক্ষণ করা যায়নি।'))
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`নতুন ${KIND_LABEL[kind]}`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            {kind === 'CUSTOMER' ? 'সম্পন্ন বিক্রি *' : 'সম্পন্ন ক্রয় *'}
          </span>
          <select
            className={inputClass + ' bg-white'}
            value={sourceId}
            disabled={loadingSources}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="">{loadingSources ? 'লোড হচ্ছে...' : 'বেছে নিন'}</option>
            {sources.map((item) => (
              <option key={item._id} value={item._id}>
                {item.number} · {item.party} · {taka(item.total)}
              </option>
            ))}
          </select>
        </label>

        {source && kind === 'CUSTOMER' && (
          <p className="text-sm text-gray-600">
            বিক্রির মোট {taka(source.total)} · বর্তমান বাকি {taka(source.outstanding)}
          </p>
        )}

        {loadingItems && <p className="text-sm text-gray-500">ফেরতযোগ্য পণ্য লোড হচ্ছে...</p>}

        {items.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>পণ্য</th>
                  <th>ফেরতযোগ্য</th>
                  <th>মূল্য</th>
                  <th>ফেরত দিচ্ছেন</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <strong>{item.productName}</strong>
                      <br />
                      <span className="text-xs text-gray-500">{item.sku}</span>
                    </td>
                    <td>{item.remaining} / {item.totalQuantity} টি</td>
                    <td>{taka(item.unitPrice)}</td>
                    <td>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={item.remaining}
                        step="1"
                        disabled={item.remaining === 0}
                        className={inputClass + ' max-w-[7rem]'}
                        value={quantities[item.productId] ?? ''}
                        onChange={(event) => setQuantity(item.productId, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">কারণ *</span>
          <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>

        {kind === 'CUSTOMER' && cashPreview > 0 && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">নগদ ফেরতের পদ্ধতি *</span>
            <select className={inputClass + ' bg-white'} value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
              {REFUND_METHODS.map((method) => (
                <option key={method} value={method}>{METHOD_LABEL[method]}</option>
              ))}
            </select>
          </label>
        )}

        {lines.length > 0 && (
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>মোট ফেরত মূল্য</span>
              <span>{taka(totalValue)}</span>
            </div>
            {kind === 'CUSTOMER' ? (
              <>
                <div className="flex justify-between">
                  <span>বাকি থেকে সমন্বয় হবে</span>
                  <span>{taka(creditPreview)}</span>
                </div>
                <div className="flex justify-between">
                  <span>নগদ ফেরত যাবে</span>
                  <span>{taka(cashPreview)}</span>
                </div>
              </>
            ) : (
              <p className="pt-2 text-xs text-gray-600">
                সরবরাহকারীর সাথে নগদ লেনদেন নেই। শুধু পণ্য ফেরত যাবে এবং স্টক কমবে।
              </p>
            )}
          </div>
        )}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving || lines.length === 0}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'ফেরত সংরক্ষণ করুন'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
