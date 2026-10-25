'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import {
  STATUS_LABEL,
  formatDate,
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

  useEffect(() => {
    apiRequest<{ data: PurchaseDetail }>(`/purchases/${purchase._id}`)
      .then((response) => setDetail(response.data))
      .catch((err) => setDetailError(err instanceof ApiError ? err.message : 'Could not load the details.'))
      .finally(() => setLoading(false))
  }, [purchase._id])

  return (
    <ModalShell title={purchase.purchaseNumber} onClose={onClose} wide>
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
          </div>
        </>
      )}
    </ModalShell>
  )
}
