'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, Receipt, WalletCards } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'

type Tab = 'payments' | 'dues'

type PaymentMethod = 'CASH' | 'MOBILE_BANKING' | 'CARD' | 'BANK_TRANSFER'

type PaymentRow = {
  _id: string
  amount: number
  method: PaymentMethod
  reference: string
  createdAt: string
  sale: { saleNumber: string; grandTotal: number } | null
  customer: { name: string } | null
}

type PaymentsResponse = {
  success: boolean
  total: number
  page: number
  totalPages: number
  data: PaymentRow[]
}

type SalesReport = {
  count: number
  totalSales: number
  totalPaid: number
  totalOutstanding: number
}

type SaleRow = {
  _id: string
  saleNumber: string
  saleDate: string
  grandTotal: number
  paidAmount: number
  outstandingAmount: number
  customer: { _id: string; name: string; phone?: string } | null
}

type SalesResponse = { success: boolean; total: number; data: SaleRow[] }

type DueGroup = {
  key: string
  name: string
  phone: string
  count: number
  outstanding: number
  oldest: string
}

type Totals = {
  totalPaid: number | null
  totalOutstanding: number | null
  paymentCount: number | null
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  MOBILE_BANKING: 'Mobile banking',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
}

const numberFormat = new Intl.NumberFormat('en-US')

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Could not load the information.'
}

const buttonClass = 'rounded-md border px-3 py-1.5 text-sm'

export function PaymentsPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Payments &amp; Dues</p>
            <h1>Payments &amp; Dues</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">Only Managers and Administrators can view payments and dues.</p>
        </section>
      </>
    )
  }

  return <PaymentsManager />
}

function PaymentsManager() {
  const [tab, setTab] = useState<Tab>('payments')
  const [totals, setTotals] = useState<Totals>({ totalPaid: null, totalOutstanding: null, paymentCount: null })
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sales, setSales] = useState<SaleRow[]>([])
  const [salesTruncated, setSalesTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.allSettled([
      apiRequest<{ data: SalesReport }>('/reports/sales'),
      apiRequest<PaymentsResponse>('/payments?limit=1'),
    ]).then(([salesRes, paymentsRes]) => {
      setTotals({
        totalPaid: salesRes.status === 'fulfilled' ? salesRes.value.data.totalPaid : null,
        totalOutstanding: salesRes.status === 'fulfilled' ? salesRes.value.data.totalOutstanding : null,
        paymentCount: paymentsRes.status === 'fulfilled' ? paymentsRes.value.total : null,
      })
    })
  }, [])

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest<PaymentsResponse>(`/payments?page=${page}&limit=10`)
      setPayments(response.data)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [page])

  const loadDues = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest<SalesResponse>('/sales?status=COMPLETED&limit=100')
      setSales(response.data)
      setSalesTruncated(response.total > response.data.length)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'payments') loadPayments()
  }, [tab, loadPayments])

  useEffect(() => {
    if (tab === 'dues') loadDues()
  }, [tab, loadDues])

  // Group the dues by customer. Walk-in sales are shown separately
  const dueGroups = useMemo<DueGroup[]>(() => {
    const groups = new Map<string, DueGroup>()

    for (const sale of sales) {
      if (sale.outstandingAmount <= 0) continue

      const key = sale.customer?._id ?? 'walkin'
      const existing = groups.get(key)

      if (existing) {
        existing.count += 1
        existing.outstanding += sale.outstandingAmount
        if (sale.saleDate < existing.oldest) existing.oldest = sale.saleDate
      } else {
        groups.set(key, {
          key,
          name: sale.customer?.name ?? 'Walk-in customer',
          phone: sale.customer?.phone ?? '',
          count: 1,
          outstanding: sale.outstandingAmount,
          oldest: sale.saleDate,
        })
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.outstanding - a.outstanding)
  }, [sales])

  const dueTotal = dueGroups.reduce((sum, group) => sum + group.outstanding, 0)

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Payments &amp; Dues</p>
          <h1>Payments &amp; Dues</h1>
          <p className="subheading">Payment history and who still owes money.</p>
        </div>
      </div>

      <section className="summary-grid">
        <article className="summary-card">
          <div className="metric-icon green"><CircleDollarSign /></div>
          <div className="metric-info">
            <span>Total paid</span>
            <strong>{formatMoney(totals.totalPaid)}</strong>
            <small>From all completed sales, all time</small>
          </div>
        </article>
        <article className="summary-card">
          <div className="metric-icon orange"><WalletCards /></div>
          <div className="metric-info">
            <span>Outstanding balance</span>
            <strong>{formatMoney(totals.totalOutstanding)}</strong>
            <small>Amount owed by customers</small>
          </div>
        </article>
        <article className="summary-card">
          <div className="metric-icon blue"><Receipt /></div>
          <div className="metric-info">
            <span>Number of payments</span>
            <strong>{totals.paymentCount === null ? '—' : numberFormat.format(totals.paymentCount)}</strong>
            <small>Total payment records</small>
          </div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('payments')}
              className={`${buttonClass} ${tab === 'payments' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Payment list
            </button>
            <button
              onClick={() => setTab('dues')}
              className={`${buttonClass} ${tab === 'dues' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Dues list
            </button>
          </div>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
        </div>

        {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}

        {tab === 'payments' && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sale no.</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && payments.length === 0 && <tr><td colSpan={6}>No payments found.</td></tr>}
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{formatDate(payment.createdAt)}</td>
                      <td><strong className="ref-code">{payment.sale?.saleNumber ?? '—'}</strong></td>
                      <td>{payment.customer?.name ?? 'Walk-in customer'}</td>
                      <td><strong>{formatMoney(payment.amount)}</strong></td>
                      <td>{METHOD_LABEL[payment.method] ?? payment.method}</td>
                      <td>{payment.reference || '—'}</td>
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
          </>
        )}

        {tab === 'dues' && (
          <>
            {salesTruncated && (
              <p className="px-4 pb-3 text-xs text-amber-700">
                This list is based on the latest 100 completed sales.
              </p>
            )}

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Unpaid sales</th>
                    <th>Total outstanding</th>
                    <th>Oldest unpaid date</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && dueGroups.length === 0 && <tr><td colSpan={5}>No outstanding balances. All sales are paid.</td></tr>}
                  {dueGroups.map((group) => (
                    <tr key={group.key}>
                      <td><strong>{group.name}</strong></td>
                      <td>{group.phone || '—'}</td>
                      <td>{group.count}</td>
                      <td><strong className="text-red-600">{formatMoney(group.outstanding)}</strong></td>
                      <td>{formatDate(group.oldest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {dueGroups.length > 0 && (
              <div className="space-y-2 px-4 py-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>Total outstanding</span>
                  <span>{formatMoney(dueTotal)}</span>
                </div>
                <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  No customer was selected for walk-in sales, so it is not known who owes this amount.
                  For future credit sales, select a customer.
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
