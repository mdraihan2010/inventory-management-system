'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
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
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9}>Loading...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={9}>No returns found.</td></tr>}
              {!loading && rows.map((row) => (
                <tr key={row._id}>
                  <td><strong className="ref-code">{row.returnNumber}</strong></td>
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
