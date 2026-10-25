'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'

export type Customer = {
  _id: string
  name: string
  phone: string
  email?: string
  address: string
  notes: string
  isActive: boolean
}

export type SaleSummary = {
  _id: string
  saleNumber: string
  saleDate: string
  grandTotal: number
  outstandingAmount: number
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'
}

type SalesResponse = { success: boolean; data: SaleSummary[] }

const SALE_STATUS_LABEL: Record<SaleSummary['status'], string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const SALE_STATUS_CLASS: Record<SaleSummary['status'], string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

const PAYMENT_LABEL: Record<SaleSummary['paymentStatus'], string> = {
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partly paid',
  UNPAID: 'Unpaid',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB')
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

export function CustomerDetailModal({
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
      .catch((err) => setSalesError(err instanceof ApiError ? err.message : 'Could not load sales.'))
      .finally(() => setLoadingSales(false))
  }, [customer._id])

  // Totals use completed sales only. Draft and cancelled sales are left out
  const completed = sales.filter((sale) => sale.status === 'COMPLETED')
  const totalPurchased = completed.reduce((sum, sale) => sum + sale.grandTotal, 0)
  const totalOutstanding = completed.reduce((sum, sale) => sum + sale.outstandingAmount, 0)

  return (
    <ModalShell title={customer.name} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">Phone: </span>{customer.phone || '—'}</p>
        <p><span className="text-gray-500">Email: </span>{customer.email || '—'}</p>
        <p><span className="text-gray-500">Address: </span>{customer.address || '—'}</p>
        <p><span className="text-gray-500">Status: </span>{customer.isActive ? 'Active' : 'Inactive'}</p>
        {customer.notes && <p className="md:col-span-2"><span className="text-gray-500">Notes: </span>{customer.notes}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">Completed sales</p>
          <strong>{completed.length}</strong>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">Total purchases</p>
          <strong>{formatMoney(totalPurchased)}</strong>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">Total outstanding</p>
          <strong className={totalOutstanding > 0 ? 'text-red-600' : ''}>{formatMoney(totalOutstanding)}</strong>
        </div>
      </div>

      <p className="text-xs text-gray-500">Based on the latest 100 sales.</p>

      {loadingSales && <p className="text-sm text-gray-500">Loading sales...</p>}
      {salesError && <p className="text-sm text-red-600">{salesError}</p>}

      {!loadingSales && !salesError && (
        sales.length === 0 ? (
          <p className="text-sm text-gray-500">This customer has no sales.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sale no.</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale._id}>
                    <td><strong className="ref-code">{sale.saleNumber}</strong></td>
                    <td>{formatDate(sale.saleDate)}</td>
                    <td>{formatMoney(sale.grandTotal)}</td>
                    <td>{sale.status === 'COMPLETED' ? formatMoney(sale.outstandingAmount) : '—'}</td>
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
            Edit customer
          </button>
        </div>
      )}
    </ModalShell>
  )
}
