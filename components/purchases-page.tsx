'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { rowAction } from '@/components/ui/row-action'
import {
  STATUS_CLASS,
  STATUS_LABEL,
  SUPPLIER_PAYMENT_LABEL,
  formatDate,
  inputClass,
  purchaseOutstanding,
  supplierPaymentStatus,
  type ProductRef,
  type PurchaseDetail,
  type PurchaseRow,
  type SupplierRef,
} from '@/components/purchases-shared'
import { PurchaseDetailModal, SupplierPaymentModal } from '@/components/purchases-modals'
import { ProductPicker } from '@/components/product-picker'

type ListResponse<T> = {
  success: boolean
  data: T[]
  total?: number
  totalPages?: number
}

export function PurchasesPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Purchases</p>
            <h1>Purchases</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">Only Managers and Administrators can view purchases.</p>
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
  const [payRow, setPayRow] = useState<PurchaseRow | null>(null)

  useEffect(() => {
    apiRequest<ListResponse<SupplierRef>>('/suppliers')
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
      setError(err instanceof ApiError ? err.message : 'Could not load the purchase list.')
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
        ? `${purchase.purchaseNumber} will increase stock when completed. Are you sure?`
        : `Do you want to cancel purchase ${purchase.purchaseNumber}?`
    if (!window.confirm(confirmText)) return

    setError('')
    setNotice('')
    setBusyId(purchase._id)

    try {
      await apiRequest(`/purchases/${purchase._id}/${action}`, { method: 'POST' })
      reload(
        action === 'complete'
          ? `${purchase.purchaseNumber} completed. Stock has been increased.`
          : `${purchase.purchaseNumber} cancelled.`
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete the action.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Purchases</p>
          <h1>Purchases</h1>
          <p className="subheading">Buy products from suppliers, complete purchases and increase stock.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> New purchase
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Purchase list</h2>
            <span>Total {total}</span>
          </div>
          <div className="toolbar-actions">
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={statusFilter}
              onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Purchase no.</th>
                <th>Supplier</th>
                <th>Date</th>
                <th>Total</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}>Loading...</td></tr>}
              {!loading && purchases.length === 0 && <tr><td colSpan={7}>No purchases found.</td></tr>}
              {!loading && purchases.map((purchase) => (
                <tr key={purchase._id}>
                  <td><strong className="ref-code">{purchase.purchaseNumber}</strong></td>
                  <td>{supplierLabel(purchase)}</td>
                  <td>{formatDate(purchase.purchaseDate)}</td>
                  <td>{formatMoney(purchase.grandTotal)}</td>
                  <td>{purchase.status === 'COMPLETED' ? formatMoney(purchaseOutstanding(purchase)) : '—'}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[purchase.status]}`}>{STATUS_LABEL[purchase.status]}</span>
                    {purchase.status === 'COMPLETED' && (
                      <span className="mt-1 block text-xs text-gray-500">{SUPPLIER_PAYMENT_LABEL[supplierPaymentStatus(purchase)]}</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className={rowAction.view} onClick={() => setDetailRow(purchase)}>Details</button>
                      {purchase.status === 'DRAFT' && (
                        <button className={rowAction.success} disabled={busyId === purchase._id} onClick={() => runAction(purchase, 'complete')}>
                          Complete
                        </button>
                      )}
                      {purchase.status === 'COMPLETED' && purchaseOutstanding(purchase) > 0 && (
                        <button className={rowAction.success} onClick={() => setPayRow(purchase)}>Pay supplier</button>
                      )}
                      {purchase.status === 'DRAFT' && (
                        <button className={rowAction.danger} disabled={busyId === purchase._id} onClick={() => runAction(purchase, 'cancel')}>
                          Cancel
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
          <span>Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Next
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
            reload(`Draft purchase created: ${purchaseNumber}`)
          }}
        />
      )}

      {payRow && (
        <SupplierPaymentModal
          purchase={payRow}
          supplierName={supplierLabel(payRow)}
          onClose={() => setPayRow(null)}
          onPaid={(message) => {
            setPayRow(null)
            reload(message)
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

type DraftRow = { product: ProductRef | null; quantity: string; unitPrice: string }

function NewPurchaseModal({
  suppliers,
  onClose,
  onCreated,
}: {
  suppliers: SupplierRef[]
  onClose: () => void
  onCreated: (purchaseNumber: string) => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [rows, setRows] = useState<DraftRow[]>([{ product: null, quantity: '1', unitPrice: '' }])
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // This is only for display. The server calculates the final total itself
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

  // When a product is chosen, its current purchase price is filled in automatically. It can still be changed
  function chooseProduct(index: number, product: ProductRef | null) {
    updateRow(index, {
      product,
      unitPrice: product ? String(product.purchasePrice) : '',
    })
  }

  function addRow() {
    setRows((previous) => [...previous, { product: null, quantity: '1', unitPrice: '' }])
  }

  function removeRow(index: number) {
    setRows((previous) => previous.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!supplierId) {
      setFormError('Select a supplier.')
      return
    }

    const selected = rows.filter((row): row is DraftRow & { product: ProductRef } => row.product !== null)
    if (selected.length === 0) {
      setFormError('Select at least one product.')
      return
    }

    const ids = selected.map((row) => row.product._id)
    if (new Set(ids).size !== ids.length) {
      setFormError('The same product cannot be added twice.')
      return
    }

    for (const row of selected) {
      const quantity = Number(row.quantity)
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setFormError('Quantity must be a whole number of 1 or more.')
        return
      }
      const unitPrice = Number(row.unitPrice)
      if (row.unitPrice.trim() === '' || !Number.isFinite(unitPrice) || unitPrice < 0) {
        setFormError('Enter a valid purchase price.')
        return
      }
    }

    if (safeDiscount < 0 || safeDiscount > subtotal) {
      setFormError('Discount must be between 0 and the total price.')
      return
    }

    setSaving(true)
    try {
      const response = await apiRequest<{ data: PurchaseDetail }>('/purchases', {
        method: 'POST',
        body: {
          supplier: supplierId,
          items: selected.map((row) => ({
            productId: row.product._id,
            quantity: Number(row.quantity),
            unitPrice: Number(row.unitPrice),
          })),
          discount: safeDiscount,
          notes: notes.trim(),
        },
      })
      onCreated(response.data.purchaseNumber)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not create the purchase.')
      setSaving(false)
    }
  }

  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive !== false)

  return (
    <ModalShell title="New purchase" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Supplier *">
          <select className={inputClass + ' bg-white'} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Select</option>
            {activeSuppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}
          </select>
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Products</p>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-12 items-start gap-2">
              <div className="col-span-5">
                <ProductPicker<ProductRef> value={row.product} onChange={(picked) => chooseProduct(index, picked)} />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Qty"
                  className={inputClass}
                  value={row.quantity}
                  onChange={(event) => updateRow(index, { quantity: event.target.value })}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Unit price"
                  className={inputClass}
                  value={row.unitPrice}
                  onChange={(event) => updateRow(index, { unitPrice: event.target.value })}
                />
              </div>
              <div className="col-span-2 pt-2 text-right text-sm">{formatMoney(lineTotals[index])}</div>
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
            + Add another product
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Discount ($)">
            <input type="number" min="0" className={inputClass} value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>

        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>- {formatMoney(safeDiscount)}</span></div>
          <div className="flex justify-between font-semibold"><span>Payable</span><span>{formatMoney(payable)}</span></div>
        </div>

        <p className="text-xs text-gray-500">
          This will be created as a draft. Stock will increase only when you complete it.
        </p>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create draft'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
