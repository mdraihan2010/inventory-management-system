'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleDollarSign, Receipt, WalletCards } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'

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
  CASH: 'নগদ',
  MOBILE_BANKING: 'মোবাইল ব্যাংকিং',
  CARD: 'কার্ড',
  BANK_TRANSFER: 'ব্যাংক ট্রান্সফার',
}

const numberFormat = new Intl.NumberFormat('en-IN')

function taka(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `৳ ${numberFormat.format(value)}`
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'তথ্য আনা যায়নি।'
}

const buttonClass = 'rounded-md border px-3 py-1.5 text-sm'

export function PaymentsPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Payments &amp; Dues</p>
            <h1>পরিশোধ ও বাকি</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">পরিশোধ ও বাকির হিসাব শুধু Manager ও Administrator দেখতে পারবেন।</p>
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

  // গ্রাহক অনুযায়ী বাকি। গ্রাহক না থাকলে খুচরা বিক্রি হিসেবে আলাদা করা হয়
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
          name: sale.customer?.name ?? 'খুচরা গ্রাহক',
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
          <h1>পরিশোধ ও বাকি</h1>
          <p className="subheading">গ্রাহকের পরিশোধের ইতিহাস ও কার কাছে কত বাকি আছে।</p>
        </div>
      </div>

      <section className="summary-grid">
        <article className="summary-card">
          <div className="metric-icon green"><CircleDollarSign /></div>
          <div className="metric-info">
            <span>মোট পরিশোধ</span>
            <strong>{taka(totals.totalPaid)}</strong>
            <small>সব সময়ের সম্পন্ন বিক্রি থেকে</small>
          </div>
        </article>
        <article className="summary-card">
          <div className="metric-icon orange"><WalletCards /></div>
          <div className="metric-info">
            <span>বর্তমান বাকি</span>
            <strong>{taka(totals.totalOutstanding)}</strong>
            <small>গ্রাহকদের কাছে পাওনা</small>
          </div>
        </article>
        <article className="summary-card">
          <div className="metric-icon blue"><Receipt /></div>
          <div className="metric-info">
            <span>পরিশোধের সংখ্যা</span>
            <strong>{totals.paymentCount === null ? '—' : numberFormat.format(totals.paymentCount)}</strong>
            <small>মোট পরিশোধের রেকর্ড</small>
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
              পরিশোধের তালিকা
            </button>
            <button
              onClick={() => setTab('dues')}
              className={`${buttonClass} ${tab === 'dues' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              বাকির তালিকা
            </button>
          </div>
          {loading && <span className="text-sm text-gray-500">লোড হচ্ছে...</span>}
        </div>

        {error && <p className="px-4 pb-3 text-sm text-red-600">{error}</p>}

        {tab === 'payments' && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>তারিখ</th>
                    <th>বিক্রি নম্বর</th>
                    <th>গ্রাহক</th>
                    <th>পরিমাণ</th>
                    <th>পদ্ধতি</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && payments.length === 0 && <tr><td colSpan={6}>কোনো পরিশোধ পাওয়া যায়নি।</td></tr>}
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{formatDate(payment.createdAt)}</td>
                      <td><strong className="ref-code">{payment.sale?.saleNumber ?? '—'}</strong></td>
                      <td>{payment.customer?.name ?? 'খুচরা গ্রাহক'}</td>
                      <td><strong>{taka(payment.amount)}</strong></td>
                      <td>{METHOD_LABEL[payment.method] ?? payment.method}</td>
                      <td>{payment.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span>পৃষ্ঠা {page} / {totalPages}</span>
              <div className="flex gap-2">
                <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                  আগের
                </button>
                <button className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
                  পরের
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'dues' && (
          <>
            {salesTruncated && (
              <p className="px-4 pb-3 text-xs text-amber-700">
                সর্বশেষ ১০০টি সম্পন্ন বিক্রির ভিত্তিতে এই তালিকা তৈরি হয়েছে।
              </p>
            )}

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>গ্রাহক</th>
                    <th>ফোন</th>
                    <th>বাকি বিক্রি</th>
                    <th>মোট বাকি</th>
                    <th>প্রথম বাকির তারিখ</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && dueGroups.length === 0 && <tr><td colSpan={5}>কোনো বাকি নেই। সব বিক্রি পরিশোধিত।</td></tr>}
                  {dueGroups.map((group) => (
                    <tr key={group.key}>
                      <td><strong>{group.name}</strong></td>
                      <td>{group.phone || '—'}</td>
                      <td>{group.count} টি</td>
                      <td><strong className="text-red-600">{taka(group.outstanding)}</strong></td>
                      <td>{formatDate(group.oldest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {dueGroups.length > 0 && (
              <div className="space-y-2 px-4 py-3 text-sm">
                <div className="flex justify-between font-semibold">
                  <span>মোট বাকি</span>
                  <span>{taka(dueTotal)}</span>
                </div>
                <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  খুচরা গ্রাহকের বাকির জন্য গ্রাহক বেছে নেওয়া হয়নি, তাই কার কাছে পাওনা তা জানা যায় না।
                  ভবিষ্যতে বাকিতে বিক্রি করলে গ্রাহক বেছে নেওয়া ভালো।
                </p>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
