'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { PrintableInvoice, PrintInvoiceButton } from '@/components/invoice-print'
import { METHOD_LABEL, type PaymentMethod } from '@/components/sales-shared'
import {
  STATUS_LABEL,
  SUPPLIER_PAYMENT_LABEL,
  formatDate,
  inputClass,
  purchaseOutstanding,
  supplierPaymentStatus,
  type PurchaseDetail,
  type PurchaseRow,
} from '@/components/purchases-shared'

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

export function PurchaseDetailModal({
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
  const [payments, setPayments] = useState<SupplierPaymentRow[]>([])

  useEffect(() => {
    apiRequest<{ data: PurchaseDetail }>(`/purchases/${purchase._id}`)
      .then((response) => setDetail(response.data))
      .catch((err) => setDetailError(err instanceof ApiError ? err.message : 'Could not load the details.'))
      .finally(() => setLoading(false))
    apiRequest<{ data: SupplierPaymentRow[] }>(`/purchases/${purchase._id}/payments`)
      .then((response) => setPayments(response.data))
      .catch(() => setPayments([]))
  }, [purchase._id])

  return (
    <ModalShell title={purchase.purchaseNumber} onClose={onClose} wide>
      <div className="flex justify-end">
        <PrintInvoiceButton disabled={!detail} />
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">Supplier: </span>{supplierName}</p>
        <p><span className="text-gray-500">Date: </span>{formatDate(purchase.purchaseDate)}</p>
        <p><span className="text-gray-500">Status: </span>{STATUS_LABEL[purchase.status]}</p>
        {detail?.notes && <p className="md:col-span-2"><span className="text-gray-500">Notes: </span>{detail.notes}</p>}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {detailError && <p className="text-sm text-red-600">{detailError}</p>}

      {detail && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Purchase price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, index) => (
                  <tr key={index}>
                    <td><strong>{item.productName}</strong><br /><span>{item.sku}</span></td>
                    <td>{item.quantity}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
                    <td>{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(detail.subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>- {formatMoney(detail.discount)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total bill</span><span>{formatMoney(detail.grandTotal)}</span></div>
            {detail.status === 'COMPLETED' && (
              <>
                {(detail.returnedAmount ?? 0) > 0 && (
                  <div className="flex justify-between"><span>Returned to supplier</span><span>- {formatMoney(detail.returnedAmount ?? 0)}</span></div>
                )}
                <div className="flex justify-between"><span>Paid to supplier</span><span>- {formatMoney(detail.paidAmount ?? 0)}</span></div>
                <div className="flex justify-between font-semibold">
                  <span>Outstanding ({SUPPLIER_PAYMENT_LABEL[supplierPaymentStatus(detail)]})</span>
                  <span>{formatMoney(purchaseOutstanding(detail))}</span>
                </div>
              </>
            )}
          </div>

          {detail.status === 'COMPLETED' && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Payments to supplier</h3>
              {payments.length === 0 ? (
                <p className="text-sm text-gray-500">No payments yet.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>By</th></tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment._id}>
                          <td>{formatDate(payment.createdAt)}</td>
                          <td>{formatMoney(payment.amount)}</td>
                          <td>{METHOD_LABEL[payment.method] ?? payment.method}</td>
                          <td>{payment.reference || '—'}</td>
                          <td>{payment.createdBy?.name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {detail && (
        <PrintableInvoice
          heading="Purchase invoice"
          number={purchase.purchaseNumber}
          date={purchase.purchaseDate}
          partyLabel="Supplier"
          partyName={supplierName}
          status={STATUS_LABEL[purchase.status]}
          lines={detail.items.map((item) => ({
            name: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          }))}
          subtotal={detail.subtotal}
          discount={detail.discount}
          total={detail.grandTotal}
          paid={detail.paidAmount}
          outstanding={detail.status === 'COMPLETED' ? purchaseOutstanding(detail) : undefined}
        />
      )}
    </ModalShell>
  )
}

type SupplierPaymentRow = {
  _id: string
  amount: number
  method: PaymentMethod
  reference?: string
  createdAt: string
  createdBy?: { name: string } | null
}

// Records money paid to the supplier of a completed purchase
export function SupplierPaymentModal({
  purchase,
  supplierName,
  onClose,
  onPaid,
}: {
  purchase: PurchaseRow
  supplierName: string
  onClose: () => void
  onPaid: (message: string) => void
}) {
  const outstanding = purchaseOutstanding(purchase)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    const value = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setFormError('Payment amount must be greater than zero.')
      return
    }
    if (value > outstanding) {
      setFormError(`Payment cannot be more than the outstanding amount. Maximum ${formatMoney(outstanding)}.`)
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/purchases/${purchase._id}/payments`, {
        method: 'POST',
        body: { amount: value, method, reference: reference.trim() },
      })
      onPaid(`Paid ${formatMoney(value)} to ${supplierName} for ${purchase.purchaseNumber}.`)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not record the payment.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Pay supplier" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>Purchase</span><strong>{purchase.purchaseNumber}</strong></div>
          <div className="flex justify-between"><span>Supplier</span><span>{supplierName}</span></div>
          <div className="flex justify-between"><span>Total bill</span><span>{formatMoney(purchase.grandTotal)}</span></div>
          {(purchase.returnedAmount ?? 0) > 0 && (
            <div className="flex justify-between"><span>Returned to supplier</span><span>- {formatMoney(purchase.returnedAmount ?? 0)}</span></div>
          )}
          <div className="flex justify-between"><span>Paid so far</span><span>{formatMoney(purchase.paidAmount ?? 0)}</span></div>
          <div className="flex justify-between font-semibold"><span>Outstanding</span><span>{formatMoney(outstanding)}</span></div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Amount ($) *</span>
          <div className="flex gap-2">
            <input type="number" min="0" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} />
            <button
              type="button"
              onClick={() => setAmount(String(outstanding))}
              className="whitespace-nowrap rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Full outstanding
            </button>
          </div>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Method *</span>
          <select className={inputClass + ' bg-white'} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((key) => (
              <option key={key} value={key}>{METHOD_LABEL[key]}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Reference (optional, for example a bank transfer or cheque number)</span>
          <input className={inputClass} maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Pay supplier'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
