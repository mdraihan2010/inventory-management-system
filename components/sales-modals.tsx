'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import {
  METHOD_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
  formatDate,
  inputClass,
  type Payment,
  type PaymentMethod,
  type Sale,
} from '@/components/sales-shared'

type PaymentsResponse = { success: boolean; totalPaid: number; data: Payment[] }

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

export function PaymentModal({
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
      setFormError('Payment amount must be greater than zero.')
      return
    }
    if (value > sale.outstandingAmount) {
      setFormError(`Payment cannot be more than the outstanding amount. Maximum ${formatMoney(sale.outstandingAmount)}.`)
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/sales/${sale._id}/payments`, {
        method: 'POST',
        body: { amount: value, method, reference: reference.trim() },
      })
      onPaid(`Payment of ${formatMoney(value)} received for ${sale.saleNumber}.`)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not collect the payment.')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Collect payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <div className="flex justify-between"><span>Sale</span><strong>{sale.saleNumber}</strong></div>
          <div className="flex justify-between"><span>Total</span><span>{formatMoney(sale.grandTotal)}</span></div>
          <div className="flex justify-between"><span>Paid so far</span><span>{formatMoney(sale.paidAmount)}</span></div>
          <div className="flex justify-between font-semibold"><span>Outstanding</span><span>{formatMoney(sale.outstandingAmount)}</span></div>
        </div>

        <Field label="Amount ($) *">
          <div className="flex gap-2">
            <input type="number" min="0" className={inputClass} value={amount} onChange={(event) => setAmount(event.target.value)} />
            <button
              type="button"
              onClick={() => setAmount(String(sale.outstandingAmount))}
              className="whitespace-nowrap rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Full outstanding
            </button>
          </div>
        </Field>

        <Field label="Method *">
          <select className={inputClass + ' bg-white'} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((key) => (
              <option key={key} value={key}>{METHOD_LABEL[key]}</option>
            ))}
          </select>
        </Field>

        <Field label="Reference (optional, for example a bKash transaction ID)">
          <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} />
        </Field>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Collect payment'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}

export function SaleDetailModal({
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
        <p><span className="text-gray-500">Customer: </span>{sale.customer?.name ?? 'Walk-in customer'}</p>
        <p><span className="text-gray-500">Date: </span>{formatDate(sale.saleDate)}</p>
        <p><span className="text-gray-500">Status: </span>{STATUS_LABEL[sale.status]}</p>
        <p><span className="text-gray-500">Payment: </span>{sale.status === 'COMPLETED' ? PAYMENT_LABEL[sale.paymentStatus] : '—'}</p>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Total</th>
              {canManage && <th>Purchase cost</th>}
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={index}>
                <td><strong>{item.productName}</strong><br /><span>{item.sku}</span></td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.unitPrice)}</td>
                <td>{formatMoney(item.lineTotal)}</td>
                {canManage && <td>{item.costPrice === null ? '—' : formatMoney(item.costPrice)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md bg-gray-50 p-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>- {formatMoney(sale.discount)}</span></div>
        <div className="flex justify-between font-semibold"><span>Payable</span><span>{formatMoney(sale.grandTotal)}</span></div>
        <div className="flex justify-between"><span>Paid</span><span>{formatMoney(sale.paidAmount)}</span></div>
        <div className="flex justify-between"><span>Outstanding</span><span>{formatMoney(sale.outstandingAmount)}</span></div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Payment history</p>
        {loadingPayments && <p className="text-sm text-gray-500">Loading...</p>}
        {!loadingPayments && payments.length === 0 && (
          <p className="text-sm text-gray-500">No payments yet.</p>
        )}
        {!loadingPayments && payments.length > 0 && (
          <ul className="divide-y text-sm">
            {payments.map((payment) => (
              <li key={payment._id} className="flex justify-between py-2">
                <span>
                  {formatDate(payment.createdAt)} · {METHOD_LABEL[payment.method]}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
                <strong>{formatMoney(payment.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}
