'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'
import {
  KIND_LABEL,
  METHOD_LABEL,
  REFUND_METHODS,
  errorText,
  inputClass,
  roundMoney,
  sourceFromPurchase,
  sourceFromSale,
  type PurchaseSource,
  type ReturnKind,
  type ReturnableItem,
  type ReturnableRaw,
  type SaleSource,
  type Source,
} from '@/components/returns-shared'

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

export function NewReturnModal({
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

  // Only completed sales or purchases are shown. Drafts and cancelled records cannot be returned
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
      .catch((err) => setFormError(errorText(err, 'Could not load the list.')))
      .finally(() => setLoadingSources(false))
  }, [kind])

  // When the sale or purchase changes, the returnable products are loaded again
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
        setFormError(errorText(err, 'Could not load returnable products.'))
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
      setFormError(kind === 'CUSTOMER' ? 'Select a sale.' : 'Select a purchase.')
      return
    }

    if (lines.length === 0) {
      setFormError('Enter the quantity to return for at least one product.')
      return
    }

    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity > line.item.remaining) {
        setFormError(`${line.item.productName}: you can return at most ${line.item.remaining}. Enter a whole number.`)
        return
      }
    }

    if (!reason.trim()) {
      setFormError('Enter the reason for the return.')
      return
    }

    if (kind === 'CUSTOMER' && cashPreview > 0 && !REFUND_METHODS.includes(refundMethod)) {
      setFormError('Select a cash refund method.')
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
      onSaved(`${KIND_LABEL[kind]} ${response.data.return.returnNumber} saved.`)
    } catch (err) {
      setFormError(errorText(err, 'Could not save the return.'))
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`New ${KIND_LABEL[kind].toLowerCase()}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">
            {kind === 'CUSTOMER' ? 'Completed sale *' : 'Completed purchase *'}
          </span>
          <select
            className={inputClass + ' bg-white'}
            value={sourceId}
            disabled={loadingSources}
            onChange={(event) => setSourceId(event.target.value)}
          >
            <option value="">{loadingSources ? 'Loading...' : 'Select'}</option>
            {sources.map((item) => (
              <option key={item._id} value={item._id}>
                {item.number} · {item.party} · {formatMoney(item.total)}
              </option>
            ))}
          </select>
        </label>

        {source && kind === 'CUSTOMER' && (
          <p className="text-sm text-gray-600">
            Sale total {formatMoney(source.total)} · Current balance {formatMoney(source.outstanding)}
          </p>
        )}

        {loadingItems && <p className="text-sm text-gray-500">Loading returnable products...</p>}

        {items.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Returnable</th>
                  <th>Price</th>
                  <th>Returning</th>
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
                    <td>{item.remaining} / {item.totalQuantity}</td>
                    <td>{formatMoney(item.unitPrice)}</td>
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
          <span className="text-sm font-medium text-gray-700">Reason *</span>
          <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>

        {kind === 'CUSTOMER' && cashPreview > 0 && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Cash refund method *</span>
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
              <span>Total return value</span>
              <span>{formatMoney(totalValue)}</span>
            </div>
            {kind === 'CUSTOMER' ? (
              <>
                <div className="flex justify-between">
                  <span>Adjusted against balance</span>
                  <span>{formatMoney(creditPreview)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash refund due</span>
                  <span>{formatMoney(cashPreview)}</span>
                </div>
              </>
            ) : (
              <p className="pt-2 text-xs text-gray-600">
                There is no cash transaction with the supplier. Only the products are returned and stock decreases.
              </p>
            )}
          </div>
        )}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving || lines.length === 0}>
            {saving ? 'Saving...' : 'Save return'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
