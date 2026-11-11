'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, Receipt, Truck, WalletCards } from 'lucide-react'
import { ApiError, apiRequest, apiRequestAll } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { purchaseOutstanding, type PurchaseRow } from '@/components/purchases-shared'

type Tab = 'payments' | 'dues' | 'suppliers'

type SupplierDue = {
  key: string
  name: string
  company: string
  count: number
  paid: number
  outstanding: number
  oldest: string
}

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [purchases, setPurchases] = useState<PurchaseRow[] | null>(null)

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
      const allSales = await apiRequestAll<SaleRow>('/sales?status=COMPLETED')
      setSales(allSales)
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

  // Completed purchases are loaded once: they give the supplier card at the top and the supplier dues tab
  const loadPurchases = useCallback(async () => {
    try {
      setPurchases(await apiRequestAll<PurchaseRow>('/purchases?status=COMPLETED'))
    } catch (err) {
      setPurchases([])
      setError(errorText(err))
    }
  }, [])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  // Group what we owe by supplier
  const supplierDues = useMemo<SupplierDue[]>(() => {
    const groups = new Map<string, SupplierDue>()
    for (const purchase of purchases ?? []) {
      const outstanding = purchaseOutstanding(purchase)
      if (outstanding <= 0) continue
      const supplier = typeof purchase.supplier === 'object' && purchase.supplier ? purchase.supplier : null
      const key = supplier?._id ?? String(purchase.supplier ?? 'unknown')
      const date = purchase.purchaseDate ?? ''
      const existing = groups.get(key)
      if (existing) {
        existing.count += 1
        existing.paid += purchase.paidAmount ?? 0
        existing.outstanding += outstanding
        if (date && date < existing.oldest) existing.oldest = date
      } else {
        groups.set(key, {
          key,
          name: supplier?.name ?? 'Unknown supplier',
          company: (supplier as { companyName?: string } | null)?.companyName ?? '',
          count: 1,
          paid: purchase.paidAmount ?? 0,
          outstanding,
          oldest: date,
        })
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.outstanding - a.outstanding)
  }, [purchases])

  const owedToSuppliers = purchases === null ? null : supplierDues.reduce((sum, group) => sum + group.outstanding, 0)

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
          <p className="subheading">Payment history, who still owes us money, and what we still owe suppliers.</p>
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
        <article className="summary-card">
          <div className="metric-icon purple"><Truck /></div>
          <div className="metric-info">
            <span>Owed to suppliers</span>
            <strong>{owedToSuppliers === null ? '—' : formatMoney(owedToSuppliers)}</strong>
            <small>Unpaid part of completed purchases</small>
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
            <button
              onClick={() => setTab('suppliers')}
              className={`${buttonClass} ${tab === 'suppliers' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Supplier dues
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
                {dueGroups.some((group) => group.key === 'walkin') && (
                  <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                    The walk-in amount comes from older sales, made before walk-in sales had to be paid in full.
                    New walk-in sales are always paid when they are completed. For credit sales, select a customer.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'suppliers' && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Company</th>
                    <th>Unpaid purchases</th>
                    <th>Paid so far</th>
                    <th>We still owe</th>
                    <th>Oldest unpaid date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases === null && <tr><td colSpan={6}>Loading...</td></tr>}
                  {purchases !== null && supplierDues.length === 0 && (
                    <tr><td colSpan={6}>Nothing is owed to suppliers. All completed purchases are paid.</td></tr>
                  )}
                  {supplierDues.map((group) => (
                    <tr key={group.key}>
                      <td><strong>{group.name}</strong></td>
                      <td>{group.company || '—'}</td>
                      <td>{group.count}</td>
                      <td>{formatMoney(group.paid)}</td>
                      <td><strong className="text-red-600">{formatMoney(group.outstanding)}</strong></td>
                      <td>{formatDate(group.oldest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {supplierDues.length > 0 && (
              <p className="px-4 py-3 text-xs text-gray-500">
                To pay a supplier, open Purchases and press Pay supplier on the purchase.
              </p>
            )}
          </>
        )}
      </section>
    </>
  )
}
