'use client'

import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiRequest } from '@/lib/api'

type AuditLog = {
  _id: string
  user: { _id: string; name: string; email: string } | null
  action: string
  entityType: string
  entityId: string
  summary: string
  createdAt: string
}

type AuditResponse = {
  success: boolean
  total: number
  page: number
  totalPages: number
  data: AuditLog[]
}

const AREA_OPTIONS = ['Sale', 'Purchase', 'Payment', 'Return', 'Product', 'Customer', 'Supplier', 'Category', 'Brand', 'User']

const selectClass = 'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900'

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditPage({ isAdmin }: { isAdmin: boolean }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Audit Log</p>
          <h1>Audit Log</h1>
          <p className="subheading">Who changed what, and when. Only administrators can see this page.</p>
        </div>
      </div>

      {isAdmin ? (
        <AuditList />
      ) : (
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">Only administrators can view the audit log.</p>
        </section>
      )}
    </>
  )
}

function AuditList() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [area, setArea] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const areaFilter = area ? `&entityType=${encodeURIComponent(area)}` : ''
      const response = await apiRequest<AuditResponse>(`/audit-logs?page=${page}&limit=15${areaFilter}`)
      setLogs(response.data)
      setTotal(response.total)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the audit log.')
    } finally {
      setLoading(false)
    }
  }, [page, area])

  useEffect(() => {
    load()
  }, [load])

  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div className="table-title">
          <h2>Recent changes</h2>
          <span>{total} records</span>
        </div>
        <div className="toolbar-actions">
          <select
            className={selectClass}
            value={area}
            onChange={(event) => {
              setArea(event.target.value)
              setPage(1)
            }}
          >
            <option value="">All areas</option>
            {AREA_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Area</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5}>Loading...</td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={5}>No records found.</td></tr>}
            {!loading && logs.map((log) => (
              <tr key={log._id}>
                <td>{formatWhen(log.createdAt)}</td>
                <td>
                  {log.user ? (
                    <>
                      <strong>{log.user.name}</strong>
                      <p className="text-xs text-gray-500">{log.user.email}</p>
                    </>
                  ) : (
                    <span className="text-gray-400">Unknown user</span>
                  )}
                </td>
                <td><strong>{log.action}</strong></td>
                <td>{log.entityType}</td>
                <td>{log.summary || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span>Page {page} / {totalPages}</span>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <button
            className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
