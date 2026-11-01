'use client'

import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { formatMoney } from '@/lib/money'

export type InvoiceLine = {
  name: string
  sku: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type InvoiceProps = {
  heading: string
  number: string
  date?: string
  partyLabel: string
  partyName: string
  partyDetail?: string
  status: string
  lines: InvoiceLine[]
  subtotal: number
  discount: number
  total: number
  paid: number
  outstanding?: number
}

// The button only opens the browser print dialog. The invoice is shown only when printing
export function PrintInvoiceButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
      disabled={disabled}
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4" />
      Print invoice
    </button>
  )
}

function formatInvoiceDate(value?: string) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// The invoice is placed at the end of <body>, so the print styles can show it alone
export function PrintableInvoice(props: InvoiceProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="invoice-print">
      <header className="invoice-head">
        <div>
          <strong className="invoice-brand">StockPilot</strong>
          <p>Inventory Suite</p>
        </div>
        <div className="invoice-meta">
          <h2>{props.heading}</h2>
          <p>No. {props.number}</p>
          <p>Date: {formatInvoiceDate(props.date)}</p>
        </div>
      </header>

      <section className="invoice-party">
        <p className="invoice-label">{props.partyLabel}</p>
        <strong>{props.partyName}</strong>
        {props.partyDetail && <p>{props.partyDetail}</p>}
        <p>Status: {props.status}</p>
      </section>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.map((line, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{line.name}</td>
              <td>{line.sku}</td>
              <td>{line.quantity}</td>
              <td>{formatMoney(line.unitPrice)}</td>
              <td>{formatMoney(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div><span>Subtotal</span><span>{formatMoney(props.subtotal)}</span></div>
        <div><span>Discount</span><span>- {formatMoney(props.discount)}</span></div>
        <div className="invoice-grand"><span>Total</span><span>{formatMoney(props.total)}</span></div>
        <div><span>Paid</span><span>{formatMoney(props.paid)}</span></div>
        {props.outstanding !== undefined && (
          <div><span>Outstanding</span><span>{formatMoney(props.outstanding)}</span></div>
        )}
      </div>

      <p className="invoice-foot">Thank you.</p>
    </div>,
    document.body
  )
}
