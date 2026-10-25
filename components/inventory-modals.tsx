'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  ADJUST_TYPES,
  inputClass,
  type AdjustType,
  type ProductRow,
} from '@/components/inventory-shared'

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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

export function AdjustModal({
  products,
  initialProductId,
  onClose,
  onSaved,
}: {
  products: ProductRow[]
  initialProductId: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [productId, setProductId] = useState(initialProductId)
  const [type, setType] = useState<AdjustType>('DAMAGED')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((item) => item._id === productId)
  const meta = ADJUST_TYPES.find((item) => item.value === type)
  const qty = Number(quantity)
  const validQty = Number.isInteger(qty) && qty > 0
  const preview =
    product && meta && validQty
      ? product.currentStock + (meta.increase ? qty : -qty)
      : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!productId) {
      setFormError('Select a product.')
      return
    }
    if (!validQty) {
      setFormError('Quantity must be a whole number of 1 or more.')
      return
    }
    if (product && meta && !meta.increase && qty > product.currentStock) {
      setFormError(`Current stock is ${product.currentStock}. You cannot reduce by more than this.`)
      return
    }

    setSaving(true)
    try {
      const response = await apiRequest<{ data: { product: { name: string; currentStock: number } } }>(
        '/inventory/adjustments',
        {
          method: 'POST',
          body: { productId, type, quantity: qty, reason: reason.trim() },
        }
      )
      const updated = response.data.product
      onSaved(`New stock of ${updated.name}: ${updated.currentStock}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('Not enough stock.')
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Could not adjust stock. Please try again.')
      }
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Adjust stock" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Product *</span>
          <select className={inputClass + ' bg-white'} value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Select</option>
            {products.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku})</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Type *</span>
          <select className={inputClass + ' bg-white'} value={type} onChange={(event) => setType(event.target.value as AdjustType)}>
            {ADJUST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {type === 'PURCHASE' && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            To record a purchase from a supplier, use the Purchases page. This screen only adjusts the record.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Quantity *</span>
            <input type="number" min="1" step="1" className={inputClass} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Reason (optional)</span>
            <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>

        {product && (
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Current stock</span>
              <strong>{product.currentStock} {product.unit}</strong>
            </div>
            <div className="flex justify-between">
              <span>After adjustment</span>
              <strong className={preview !== null && preview < 0 ? 'text-red-600' : ''}>
                {preview ?? '—'} {product.unit}
              </strong>
            </div>
          </div>
        )}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Adjust stock'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
