'use client'

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { rowAction } from '@/components/ui/row-action'
import {
  PAYMENT_LABEL,
  STATUS_CLASS,
  STATUS_LABEL,
  formatDate,
  inputClass,
  type Product,
  type Ref,
  type Sale,
} from '@/components/sales-shared'
import { PaymentModal, SaleDetailModal } from '@/components/sales-modals'

type SalesResponse = { success: boolean; total: number; page: number; totalPages: number; data: Sale[] }
type ListResponse<T> = { success: boolean; data: T[] }

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
      setError(err instanceof ApiError ? err.message : 'Could not load the sales list.')
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
        ? `${sale.saleNumber} will reduce stock when completed. Are you sure?`
        : `Do you want to cancel sale ${sale.saleNumber}?`
    if (!window.confirm(confirmText)) return

    setError('')
    setNotice('')
    setBusyId(sale._id)

    try {
      await apiRequest(`/sales/${sale._id}/${action}`, { method: 'POST' })
      reload(action === 'complete' ? `${sale.saleNumber} completed.` : `${sale.saleNumber} cancelled.`)
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
          <p className="eyebrow">Workspace / Sales</p>
          <h1>Sales</h1>
          <p className="subheading">Create, complete, collect payments and view outstanding sales.</p>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus /> New sale
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Sales list</h2>
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
            <select
              className={inputClass + ' max-w-[12rem] bg-white'}
              value={customerFilter}
              onChange={(event) => { setCustomerFilter(event.target.value); setPage(1) }}
            >
              <option value="">All customers</option>
              <option value="walkin">Walk-in customer</option>
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
                <th>Sale no.</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}>Loading...</td></tr>}
              {!loading && sales.length === 0 && <tr><td colSpan={7}>No sales found.</td></tr>}
              {!loading && sales.map((sale) => (
                <tr key={sale._id}>
                  <td><strong className="ref-code">{sale.saleNumber}</strong></td>
                  <td>{sale.customer?.name ?? 'Walk-in customer'}</td>
                  <td>{formatDate(sale.saleDate)}</td>
                  <td>{formatMoney(sale.grandTotal)}</td>
                  <td>{sale.status === 'COMPLETED' ? formatMoney(sale.outstandingAmount) : '—'}</td>
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
                      <button className={rowAction.view} onClick={() => setDetailSale(sale)}>Details</button>
                      {sale.status === 'DRAFT' && (
                        <button className={rowAction.success} disabled={busyId === sale._id} onClick={() => runAction(sale, 'complete')}>
                          Complete
                        </button>
                      )}
                      {sale.status === 'DRAFT' && canManage && (
                        <button className={rowAction.danger} disabled={busyId === sale._id} onClick={() => runAction(sale, 'cancel')}>
                          Cancel
                        </button>
                      )}
                      {sale.status === 'COMPLETED' && sale.outstandingAmount > 0 && (
                        <button className={rowAction.success} onClick={() => setPaySale(sale)}>Collect payment</button>
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
        <NewSaleModal
          customers={customers}
          onClose={() => setCreating(false)}
          onCreated={(saleNumber) => {
            setCreating(false)
            reload(`Draft sale created: ${saleNumber}`)
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

  // This is only for display. The server calculates the final price itself
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
      setFormError('Select at least one product.')
      return
    }

    const ids = selected.map((row) => row.productId)
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
    }

    if (safeDiscount < 0 || safeDiscount > subtotal) {
      setFormError('Discount must be between 0 and the total price.')
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
      setFormError(err instanceof ApiError ? err.message : 'Could not create the sale.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="New sale" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Customer (optional, leave empty for a walk-in sale)">
          <select className={inputClass + ' bg-white'} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Walk-in customer</option>
            {customers
              .filter((customer) => customer.isActive !== false)
              .map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
          </select>
        </Field>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Products</p>
          {rows.map((row, index) => {
            const product = productById.get(row.productId)
            const quantity = Number(row.quantity)
            const notEnough = product !== undefined && Number.isFinite(quantity) && quantity > product.currentStock

            return (
              <div key={index} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-6">
                  <select className={inputClass + ' bg-white'} value={row.productId} onChange={(event) => updateRow(index, { productId: event.target.value })}>
                    <option value="">Select product</option>
                    {products.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku})</option>)}
                  </select>
                  {product && (
                    <p className={`mt-1 text-xs ${notEnough ? 'text-red-600' : 'text-gray-500'}`}>
                      Stock: {product.currentStock} {product.unit}{notEnough ? ' (not enough)' : ''}
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
                <div className="col-span-3 pt-2 text-right text-sm">{formatMoney(lineTotals[index])}</div>
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
          This will be created as a draft. Stock will not reduce until you complete it.
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
