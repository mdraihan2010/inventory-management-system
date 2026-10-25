'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CircleDollarSign, ShoppingCart, TrendingUp, Truck, WalletCards } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'

type RangeKey = 'today' | 'month' | 'lastMonth' | 'all' | 'custom'

type Envelope<T> = { success: boolean; data: T }

type SalesSummary = {
  count: number
  totalSales: number
  totalPaid: number
  totalOutstanding: number
}

type PurchaseSummary = {
  count: number
  totalPurchases: number
}

type ProfitSummary = {
  revenue: number
  cost: number
  grossProfit: number
  linesWithCostPrice: number
  linesWithoutCostPrice: number
  revenueWithoutCostPrice: number
}

type StockItem = {
  name: string
  sku: string
  currentStock: number
  purchasePrice: number
  stockValue: number
}

type StockValue = {
  totalValue: number
  items: StockItem[]
}

type SectionKey = 'sales' | 'purchases' | 'profit' | 'stock'

const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  month: 'This month',
  lastMonth: 'Last month',
  all: 'All time',
  custom: 'Custom dates',
}

const RANGE_KEYS: RangeKey[] = ['today', 'month', 'lastMonth', 'all', 'custom']

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function rangeFor(key: RangeKey, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date()
  switch (key) {
    case 'today':
      return { from: toIso(now), to: toIso(now) }
    case 'month':
      return { from: toIso(new Date(now.getFullYear(), now.getMonth(), 1)), to: toIso(now) }
    case 'lastMonth':
      return {
        from: toIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toIso(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    case 'custom':
      return { from: customFrom || undefined, to: customTo || undefined }
    default:
      return {}
  }
}

function buildQuery(range: { from?: string; to?: string }): string {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  const text = params.toString()
  return text ? `?${text}` : ''
}

function errorText(reason: unknown): string {
  return reason instanceof ApiError ? reason.message : 'Could not load the information.'
}

export function ReportsPage({ canManage }: { canManage: boolean }) {
  if (!canManage) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Workspace / Reports</p>
            <h1>Reports</h1>
          </div>
        </div>
        <section className="panel table-panel">
          <p className="p-6 text-sm text-gray-600">Only Managers and Administrators can view reports.</p>
        </section>
      </>
    )
  }

  return <ReportsManager />
}

function ReportsManager() {
  const [range, setRange] = useState<RangeKey>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [sales, setSales] = useState<SalesSummary | null>(null)
  const [purchases, setPurchases] = useState<PurchaseSummary | null>(null)
  const [profit, setProfit] = useState<ProfitSummary | null>(null)
  const [stock, setStock] = useState<StockValue | null>(null)
  const [errors, setErrors] = useState<Record<SectionKey, string>>({
    sales: '',
    purchases: '',
    profit: '',
    stock: '',
  })
  const [loading, setLoading] = useState(false)

  const period = rangeFor(range, customFrom, customTo)

  const load = useCallback(async () => {
    setLoading(true)
    const query = buildQuery(rangeFor(range, customFrom, customTo))

    const [salesRes, purchasesRes, profitRes, stockRes] = await Promise.allSettled([
      apiRequest<Envelope<SalesSummary>>(`/reports/sales${query}`),
      apiRequest<Envelope<PurchaseSummary>>(`/reports/purchases${query}`),
      apiRequest<Envelope<ProfitSummary>>(`/reports/profit${query}`),
      apiRequest<Envelope<StockValue>>('/reports/stock-value'),
    ])

    setSales(salesRes.status === 'fulfilled' ? salesRes.value.data : null)
    setPurchases(purchasesRes.status === 'fulfilled' ? purchasesRes.value.data : null)
    setProfit(profitRes.status === 'fulfilled' ? profitRes.value.data : null)
    setStock(stockRes.status === 'fulfilled' ? stockRes.value.data : null)

    setErrors({
      sales: salesRes.status === 'rejected' ? errorText(salesRes.reason) : '',
      purchases: purchasesRes.status === 'rejected' ? errorText(purchasesRes.reason) : '',
      profit: profitRes.status === 'rejected' ? errorText(profitRes.reason) : '',
      stock: stockRes.status === 'rejected' ? errorText(stockRes.reason) : '',
    })

    setLoading(false)
  }, [range, customFrom, customTo])

  useEffect(() => {
    // Nothing loads until both dates are chosen for a custom range
    if (range === 'custom' && (!customFrom || !customTo)) return
    load()
  }, [load, range, customFrom, customTo])

  const margin =
    profit && profit.revenue > 0 ? (profit.grossProfit / profit.revenue) * 100 : null

  const sortedStock = stock
    ? [...stock.items].sort((a, b) => b.stockValue - a.stockValue)
    : []

  const periodText =
    range === 'all'
      ? 'All-time figures'
      : period.from && period.to
        ? `${period.from} to ${period.to}`
        : 'Choose dates'

  const cards = [
    {
      label: 'Total sales',
      value: formatMoney(sales?.totalSales),
      note: errors.sales || (sales ? `${sales.count} completed sales` : 'No data available'),
      icon: ShoppingCart,
      tone: 'green',
      isError: Boolean(errors.sales),
    },
    {
      label: 'Total purchases',
      value: formatMoney(purchases?.totalPurchases),
      note: errors.purchases || (purchases ? `${purchases.count} completed purchases` : 'No data available'),
      icon: Truck,
      tone: 'blue',
      isError: Boolean(errors.purchases),
    },
    {
      label: 'Gross profit',
      value: formatMoney(profit?.grossProfit),
      note: errors.profit || (margin !== null ? `Profit margin ${margin.toFixed(1)}%` : 'No data available'),
      icon: TrendingUp,
      tone: 'purple',
      isError: Boolean(errors.profit),
    },
    {
      label: 'Outstanding balance',
      value: formatMoney(sales?.totalOutstanding),
      note: errors.sales || 'Unpaid amount from completed sales in this period',
      icon: WalletCards,
      tone: 'orange',
      isError: Boolean(errors.sales),
    },
  ]

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Reports</p>
          <h1>Reports</h1>
          <p className="subheading">Summary of sales, purchases, profit and stock value.</p>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  range === key
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {RANGE_LABEL[key]}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" className={inputClass + ' max-w-[11rem]'} value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
              <span className="text-sm text-gray-500">to</span>
              <input type="date" className={inputClass + ' max-w-[11rem]'} value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          )}
        </div>
        <p className="px-4 pb-3 text-sm text-gray-500">
          Period: {periodText}{loading ? ' · Loading...' : ''}
        </p>
      </section>

      <section className="summary-grid">
        {cards.map(({ label, value, note, icon: Icon, tone, isError }) => (
          <article className="summary-card" key={label}>
            <div className={`metric-icon ${tone}`}><Icon /></div>
            <div className="metric-info">
              <span>{label}</span>
              <strong>{value}</strong>
              <small className={isError ? 'text-red-600' : ''}>{note}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Profit and loss summary</h2>
            <span>{periodText}</span>
          </div>
        </div>

        {errors.profit && <p className="px-4 pb-4 text-sm text-red-600">{errors.profit}</p>}

        {profit && (
          <div className="space-y-4 px-4 pb-4">
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <Row label="Total revenue (from sales)" value={formatMoney(profit.revenue)} />
              <Row label="Cost of goods sold" value={formatMoney(profit.cost)} />
              <Row label="Gross profit" value={formatMoney(profit.grossProfit)} strong />
            </div>

            {profit.linesWithoutCostPrice > 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                {profit.linesWithoutCostPrice} sale lines in this period have no saved cost price (older sales).
                Their revenue ({formatMoney(profit.revenueWithoutCostPrice)}) is therefore not included in the profit calculation.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Current stock value</h2>
            <span>{stock ? `Total ${formatMoney(stock.totalValue)}` : ''}</span>
          </div>
        </div>

        {errors.stock && <p className="px-4 pb-4 text-sm text-red-600">{errors.stock}</p>}

        {stock && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Purchase price</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {sortedStock.length === 0 && <tr><td colSpan={5}>No products found.</td></tr>}
                {sortedStock.map((item) => (
                  <tr key={item.sku}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.sku}</td>
                    <td>{item.currentStock}</td>
                    <td>{formatMoney(item.purchasePrice)}</td>
                    <td>{formatMoney(item.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Row({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <p className="text-gray-500">{label}</p>
      <strong className={strong ? 'text-base' : ''}>{value}</strong>
    </div>
  )
}
