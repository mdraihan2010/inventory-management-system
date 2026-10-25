'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'

export type Supplier = {
  _id: string
  name: string
  companyName: string
  phone: string
  email?: string
  address: string
  notes: string
  isActive: boolean
}

export type PurchaseSummary = {
  _id: string
  purchaseNumber: string
  purchaseDate?: string
  grandTotal: number
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED'
  supplier: string | { _id: string; name?: string } | null
}

type PurchasesResponse = { success: boolean; data: PurchaseSummary[] }

const PURCHASE_STATUS_LABEL: Record<PurchaseSummary['status'], string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const PURCHASE_STATUS_CLASS: Record<PurchaseSummary['status'], string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

// A purchase's supplier is sometimes only an id, and sometimes a populated object
export function supplierIdOf(purchase: PurchaseSummary): string | null {
  if (!purchase.supplier) return null
  return typeof purchase.supplier === 'string' ? purchase.supplier : purchase.supplier._id
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

export function SupplierDetailModal({
  supplier,
  canManage,
  onClose,
  onEdit,
}: {
  supplier: Supplier
  canManage: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(true)
  const [purchaseError, setPurchaseError] = useState('')

  useEffect(() => {
    apiRequest<PurchasesResponse>('/purchases?limit=100')
      .then((response) => {
        setPurchases(response.data.filter((purchase) => supplierIdOf(purchase) === supplier._id))
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setPurchaseError('You do not have permission to view purchases.')
        } else {
          setPurchaseError(err instanceof ApiError ? err.message : 'Could not load purchases.')
        }
      })
      .finally(() => setLoadingPurchases(false))
  }, [supplier._id])

  // Totals use completed purchases only. Draft and cancelled purchases are left out
  const completed = purchases.filter((purchase) => purchase.status === 'COMPLETED')
  const totalPurchased = completed.reduce((sum, purchase) => sum + purchase.grandTotal, 0)

  return (
    <ModalShell title={supplier.name} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p><span className="text-gray-500">Company: </span>{supplier.companyName || '—'}</p>
        <p><span className="text-gray-500">Phone: </span>{supplier.phone || '—'}</p>
        <p><span className="text-gray-500">Email: </span>{supplier.email || '—'}</p>
        <p><span className="text-gray-500">Status: </span>{supplier.isActive ? 'Active' : 'Inactive'}</p>
        <p className="md:col-span-2"><span className="text-gray-500">Address: </span>{supplier.address || '—'}</p>
        {supplier.notes && <p className="md:col-span-2"><span className="text-gray-500">Notes: </span>{supplier.notes}</p>}
      </div>

      {!purchaseError && (
        <>
          <div className="grid grid-cols-2 gap-3 text-center text-sm">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-gray-500">Completed purchases</p>
              <strong>{completed.length}</strong>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-gray-500">Total purchase value</p>
              <strong>{formatMoney(totalPurchased)}</strong>
            </div>
          </div>

          <p className="text-xs text-gray-500">Based on the latest 100 purchases.</p>
        </>
      )}

      {loadingPurchases && <p className="text-sm text-gray-500">Loading purchases...</p>}
      {purchaseError && <p className="text-sm text-red-600">{purchaseError}</p>}

      {!loadingPurchases && !purchaseError && (
        purchases.length === 0 ? (
          <p className="text-sm text-gray-500">This supplier has no purchases.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Purchase no.</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase._id}>
                    <td><strong className="ref-code">{purchase.purchaseNumber}</strong></td>
                    <td>{formatDate(purchase.purchaseDate)}</td>
                    <td>{formatMoney(purchase.grandTotal)}</td>
                    <td>
                      <span className={`status ${PURCHASE_STATUS_CLASS[purchase.status]}`}>
                        {PURCHASE_STATUS_LABEL[purchase.status]}
                      </span>
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
            Edit supplier
          </button>
        </div>
      )}
    </ModalShell>
  )
}
