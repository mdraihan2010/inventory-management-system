'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowAction } from '@/components/ui/row-action'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { NewReturnModal } from '@/components/returns-modal'
import {
  KIND_LABEL,
  METHOD_LABEL,
  errorText,
  formatDate,
  partyLabel,
  type ReturnKind,
  type ReturnRow,
} from '@/components/returns-shared'

type ListResponse<T> = {
  success: boolean
  total: number
  page: number
  totalPages: number
  data: T[]
}

export function ReturnsPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Returns</p>
            <h1>Returns</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">Only Managers and Administrators can view and create returns.</p>
        </section>
      </>
    )
  }

  return <ReturnsManager />
}

function ReturnsManager() {
  const [filter, setFilter] = useState<'' | ReturnKind>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [creating, setCreating] = useState<ReturnKind | null>(null)
  const [cancelling, setCancelling] = useState<ReturnRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (filter) params.set('kind', filter)

    try {
      const response = await apiRequest<ListResponse<ReturnRow>>(`/returns?${params.toString()}`)
      setRows(response.data)
      setTotal(response.total)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setError(errorText(err, 'Could not load the returns list.'))
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    load()
  }, [load])

  function changeFilter(next: '' | ReturnKind) {
    setFilter(next)
    setPage(1)
  }

  const filterButtons: ('' | ReturnKind)[] = ['', 'CUSTOMER', 'SUPPLIER']

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Returns</p>
          <h1>Returns</h1>
          <p className="subheading">Customer returns and returns to suppliers. Stock and balances are adjusted from here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="primary-button" onClick={() => setCreating('CUSTOMER')}>
            <Plus /> Customer return
          </button>
          <button className="primary-button" onClick={() => setCreating('SUPPLIER')}>
            <Plus /> Return to supplier
          </button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            {filterButtons.map((key) => (
              <button
                key={key || 'all'}
                onClick={() => changeFilter(key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  filter === key
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {key === '' ? 'All' : KIND_LABEL[key]}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">Total {total}</span>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Return no.</th>
                <th>Type</th>
                <th>Source</th>
                <th>Party</th>
                <th>Products</th>
                <th>Value</th>
                <th>Balance adjusted</th>
                <th>Cash refund</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11}>Loading...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={11}>No returns found.</td></tr>}
              {!loading && rows.map((row) => {
                const isCancelled = row.status === 'CANCELLED'
                return (
                <tr key={row._id} className={isCancelled ? 'opacity-60' : ''}>
                  <td className="whitespace-nowrap"><strong className="ref-code">{row.returnNumber}</strong></td>
                  <td>{KIND_LABEL[row.kind]}</td>
                  <td>{row.sale?.saleNumber ?? row.purchase?.purchaseNumber ?? '—'}</td>
                  <td>{partyLabel(row)}</td>
                  <td>{row.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</td>
                  <td>{formatMoney(row.totalValue)}</td>
                  <td>{row.kind === 'CUSTOMER' ? formatMoney(row.creditApplied) : '—'}</td>
                  <td>
                    {row.cashRefund > 0
                      ? `${formatMoney(row.cashRefund)} (${METHOD_LABEL[row.refundMethod ?? ''] ?? '—'})`
                      : '—'}
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    {isCancelled ? (
                      <>
                        <span className="status out-of-stock">Cancelled</span>
                        {row.cancelReason && <span className="mt-1 block text-xs text-gray-500">{row.cancelReason}</span>}
                      </>
                    ) : (
                      <span className="status in-stock">Active</span>
                    )}
                  </td>
                  <td>
                    {!isCancelled && row.cashRefund <= 0 && (
                      <button className={rowAction.danger} onClick={() => setCancelling(row)}>Cancel</button>
                    )}
                    {!isCancelled && row.cashRefund > 0 && (
                      <span className="text-xs text-gray-500" title="Cash was handed back, so this return cannot be cancelled">
                        Cash refunded
                      </span>
                    )}
                  </td>
                </tr>
                )
              })}
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

      {cancelling && (
        <CancelReturnModal
          row={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={(message) => {
            setCancelling(null)
            setNotice(message)
            load()
          }}
        />
      )}

      {creating && (
        <NewReturnModal
          kind={creating}
          onClose={() => setCreating(null)}
          onSaved={(message) => {
            setCreating(null)
            setNotice(message)
            load()
          }}
        />
      )}
    </>
  )
}

// Asks for a reason, then cancels the return. The server undoes the stock and balance changes
function CancelReturnModal({
  row,
  onClose,
  onCancelled,
}: {
  row: ReturnRow
  onClose: () => void
  onCancelled: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!reason.trim()) {
      setFormError('Write why this return is being cancelled.')
      return
    }

    setSaving(true)
    try {
      await apiRequest(`/returns/${row._id}/cancel`, { method: 'POST', body: { reason: reason.trim() } })
      onCancelled(`${row.returnNumber} cancelled. Stock and balances have been restored.`)
    } catch (err) {
      setFormError(errorText(err, 'Could not cancel the return.'))
      setSaving(false)
    }
  }

  const effect =
    row.kind === 'CUSTOMER'
      ? `The products go out of stock again and ${formatMoney(row.creditApplied)} is added back to the customer's balance.`
      : 'The products come back into stock, and the purchase is no longer reduced by this return.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Cancel {row.returnNumber}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p><span className="text-gray-500">Products: </span>{row.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</p>
            <p><span className="text-gray-500">Value: </span>{formatMoney(row.totalValue)}</p>
            <p className="mt-2">{effect}</p>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">Reason *</span>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
              value={reason}
              maxLength={300}
              placeholder="For example: saved against the wrong sale"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
              Keep return
            </button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Cancelling...' : 'Cancel return'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
