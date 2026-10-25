'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { apiRequest, clearToken, getToken } from '@/lib/api'
import { ProductsPage } from '@/components/products-page'
import { SalesPage } from '@/components/sales-page'
import { CustomersPage } from '@/components/customers-page'
import { SuppliersPage } from '@/components/suppliers-page'
import { PurchasesPage } from '@/components/purchases-page'
import { CategoriesPage, BrandsPage } from '@/components/catalog-page'
import { InventoryPage } from '@/components/inventory-page'
import { UsersPage } from '@/components/users-page'
import { ReportsPage } from '@/components/reports-page'
import { PaymentsPage } from '@/components/payments-page'
import { ReturnsPage } from '@/components/returns-page'
import { AccountSettingsModal } from '@/components/account-settings'
import { ThemeToggle } from '@/components/theme-toggle'

type PageKey = 'Dashboard' | 'Products' | 'Categories' | 'Brands' | 'Inventory' | 'Purchases' | 'Sales' | 'Customers' | 'Suppliers' | 'Returns' | 'Payments & Dues' | 'Reports' | 'User Management'

type IconType = typeof LayoutDashboard

const navigation: { label: PageKey; icon: IconType; group: string }[] = [
  { label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { label: 'Products', icon: Package, group: 'Catalog' },
  { label: 'Categories', icon: Tags, group: 'Catalog' },
  { label: 'Brands', icon: Archive, group: 'Catalog' },
  { label: 'Inventory', icon: Boxes, group: 'Operations' },
  { label: 'Purchases', icon: ArrowDownToLine, group: 'Operations' },
  { label: 'Sales', icon: ArrowUpFromLine, group: 'Operations' },
  { label: 'Customers', icon: Users, group: 'People' },
  { label: 'Suppliers', icon: Truck, group: 'People' },
  { label: 'Returns', icon: RotateCcw, group: 'Finance' },
  { label: 'Payments & Dues', icon: WalletCards, group: 'Finance' },
  { label: 'Reports', icon: BarChart3, group: 'Finance' },
  { label: 'User Management', icon: Settings, group: 'System' },
]

const ROLE_LABEL: Record<string, string> = {
  ADMINISTRATOR: 'Administrator',
  MANAGER: 'Manager',
  STAFF: 'Staff',
}

type CurrentUser = { name: string; role: string; email: string }

type SalesReport = { count: number; totalSales: number; totalPaid: number; totalOutstanding: number }
type PurchasesReport = { count: number; totalPurchases: number }
type ReportResponse<T> = { success: boolean; data: T }
type AlertProduct = { _id: string; name: string; sku: string; currentStock: number; minStockLevel: number }
type AlertsResponse = {
  outOfStock: { count: number; data: AlertProduct[] }
  lowStock: { count: number; data: AlertProduct[] }
}
type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
type SaleRow = {
  _id: string
  saleNumber: string
  grandTotal: number
  status: SaleStatus
  saleDate: string
  customer: { name: string } | null
}

type DashboardData = {
  totalProducts: number | null
  today: SalesReport | null
  month: SalesReport | null
  monthPurchases: PurchasesReport | null
  allTime: SalesReport | null
  alerts: AlertsResponse | null
  recentSales: SaleRow[] | null
}

const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const SALE_STATUS_CLASS: Record<SaleStatus, string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function taka(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `$${numberFormat.format(value)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function todayText(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function monthStartText(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

// Load all dashboard data together. If one request fails, the others still show
async function loadDashboard(): Promise<DashboardData> {
  const todayDate = todayText()
  const monthStart = monthStartText()

  const [productsRes, todayRes, monthRes, purchasesRes, allTimeRes, alertsRes, salesRes] =
    await Promise.allSettled([
      apiRequest<{ total: number }>('/products?limit=1'),
      apiRequest<ReportResponse<SalesReport>>(`/reports/sales?from=${todayDate}&to=${todayDate}`),
      apiRequest<ReportResponse<SalesReport>>(`/reports/sales?from=${monthStart}&to=${todayDate}`),
      apiRequest<ReportResponse<PurchasesReport>>(`/reports/purchases?from=${monthStart}&to=${todayDate}`),
      apiRequest<ReportResponse<SalesReport>>('/reports/sales'),
      apiRequest<AlertsResponse>('/inventory/alerts'),
      apiRequest<{ data: SaleRow[] }>('/sales?limit=5'),
    ])

  return {
    totalProducts: productsRes.status === 'fulfilled' ? productsRes.value.total : null,
    today: todayRes.status === 'fulfilled' ? todayRes.value.data : null,
    month: monthRes.status === 'fulfilled' ? monthRes.value.data : null,
    monthPurchases: purchasesRes.status === 'fulfilled' ? purchasesRes.value.data : null,
    allTime: allTimeRes.status === 'fulfilled' ? allTimeRes.value.data : null,
    alerts: alertsRes.status === 'fulfilled' ? alertsRes.value : null,
    recentSales: salesRes.status === 'fulfilled' ? salesRes.value.data : null,
  }
}

function App() {
  const [activePage, setActivePage] = useState<PageKey>('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    apiRequest<{ success: boolean; user: CurrentUser }>('/auth/me')
      .then((response) => setMe(response.user))
      .catch(() => setMe(null))
  }, [])

  const selectPage = (page: PageKey) => {
    setActivePage(page)
    setSidebarOpen(false)
  }

  const handleLogout = () => {
    clearToken()
    window.location.reload()
  }

  const canManage = me?.role === 'ADMINISTRATOR' || me?.role === 'MANAGER'
  const isAdmin = me?.role === 'ADMINISTRATOR'
  const userName = me?.name ?? ''
  const roleLabel = ROLE_LABEL[me?.role ?? ''] ?? ''
  const initials = userName
    ? userName.split(' ').map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase()
    : 'U'

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard onNavigate={selectPage} userName={userName} />
      case 'Products':
        return <ProductsPage canManage={canManage} />
      case 'Categories':
        return <CategoriesPage canManage={canManage} />
      case 'Brands':
        return <BrandsPage canManage={canManage} />
      case 'Inventory':
        return <InventoryPage canManage={canManage} />
      case 'Purchases':
        return <PurchasesPage canManage={canManage} />
      case 'Sales':
        return <SalesPage canManage={canManage} />
      case 'Customers':
        return <CustomersPage canManage={canManage} />
      case 'Suppliers':
        return <SuppliersPage canManage={canManage} />
      case 'Payments & Dues':
        return <PaymentsPage canManage={canManage} />
      case 'Reports':
        return <ReportsPage canManage={canManage} />
      case 'User Management':
        return <UsersPage isAdmin={isAdmin} />
      case 'Returns':
        return <ReturnsPage canManage={canManage} />
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Boxes /></div>
          <div><strong>StockPilot</strong><span>Inventory Suite</span></div>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {['Overview', 'Catalog', 'Operations', 'People', 'Finance', 'System'].map((group) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {navigation
                .filter((item) => item.group === group)
                .map(({ label, icon: Icon }) => (
                  <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} onClick={() => selectPage(label)}>
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{initials}</div>
          <div><strong>{userName || 'Loading...'}</strong><span>{roleLabel}</span></div>
          <button className="icon-button" onClick={() => setAccountOpen(true)} aria-label="My account" title="My account"><Settings /></button>
          <button className="icon-button" onClick={handleLogout} aria-label="Logout"><LogOut /></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button>
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div>
          <div className="topbar-actions"><ThemeToggle /><div className="top-avatar">{initials}</div></div>
        </header>
        <div className="page-content">{renderPage()}</div>
        {accountOpen && me && (
          <AccountSettingsModal
            currentEmail={me.email}
            onClose={() => setAccountOpen(false)}
            onEmailChanged={(email) => setMe((previous) => (previous ? { ...previous, email } : previous))}
          />
        )}
      </main>
    </div>
  )
}

function Dashboard({ onNavigate, userName }: { onNavigate: (page: PageKey) => void; userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await loadDashboard()
    setData(result)
    setUpdatedAt(new Date())
    setLoading(false)

    // If a request reports an invalid token, apiRequest clears it. Then send the user back to login
    if (!getToken()) {
      window.location.reload()
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const totalProducts = data?.totalProducts ?? null
  const lowCount = data?.alerts ? data.alerts.lowStock.count : null
  const outCount = data?.alerts ? data.alerts.outOfStock.count : null
  const healthyCount =
    totalProducts !== null && lowCount !== null && outCount !== null
      ? Math.max(0, totalProducts - lowCount - outCount)
      : null

  const alertRows = data?.alerts
    ? [
        ...data.alerts.outOfStock.data.map((product) => ({ product, out: true })),
        ...data.alerts.lowStock.data.map((product) => ({ product, out: false })),
      ]
    : []

  const cards = [
    {
      label: 'Total products',
      value: totalProducts === null ? (loading ? '...' : '—') : numberFormat.format(totalProducts),
      note: 'All products in the catalog',
      icon: Package,
      tone: 'blue',
    },
    {
      label: "Today's sales",
      value: taka(data?.today?.totalSales),
      note: data?.today ? `${data.today.count} completed sales` : 'No data available',
      icon: ShoppingCart,
      tone: 'green',
    },
    {
      label: 'This month\u2019s sales',
      value: taka(data?.month?.totalSales),
      note: data?.month ? `${data.month.count} completed sales` : 'No data available',
      icon: CircleDollarSign,
      tone: 'purple',
    },
    {
      label: 'Total outstanding',
      value: taka(data?.allTime?.totalOutstanding),
      note: 'Amount receivable from customers',
      icon: WalletCards,
      tone: 'orange',
    },
  ]

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>Welcome, {userName || 'user'}</h1>
          <p className="subheading">Here is the latest status of your inventory and sales.</p>
        </div>
        <div className="toolbar-actions">
          <span className="text-xs text-gray-500">
            {updatedAt ? `Last updated: ${updatedAt.toLocaleTimeString('en-GB')}` : 'Not updated yet'}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="primary-button" onClick={() => onNavigate('Products')}><Plus /> New product</button>
        </div>
      </div>

      <section className="summary-grid">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="summary-card" key={label}>
            <div className={`metric-icon ${tone}`}><Icon /></div>
            <div className="metric-info">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel sales-panel">
          <div className="panel-heading">
            <div><h2>Recent sales</h2><p>Latest 5 sales</p></div>
            <button className="more-button" onClick={() => onNavigate('Sales')}>View all <span>→</span></button>
          </div>
          {data?.recentSales ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Sale no.</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recentSales.map((sale) => (
                    <tr key={sale._id}>
                      <td><strong className="ref-code">{sale.saleNumber}</strong></td>
                      <td>{sale.customer?.name ?? 'Walk-in customer'}</td>
                      <td>{new Date(sale.saleDate).toLocaleDateString('en-GB')}</td>
                      <td>{taka(sale.grandTotal)}</td>
                      <td><span className={`status ${SALE_STATUS_CLASS[sale.status]}`}>{SALE_STATUS_LABEL[sale.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subheading">{loading ? 'Loading...' : 'No sales data available'}</p>
          )}
        </article>

        <article className="panel stock-panel">
          <div className="panel-heading">
            <div><h2>Stock status</h2><p>Current inventory health</p></div>
            <button className="more-button" onClick={() => onNavigate('Inventory')}>Details <span>→</span></button>
          </div>
          <div className="donut-row">
            <div className="donut"><div><strong>{totalProducts ?? '—'}</strong><span>Total products</span></div></div>
            <div className="stock-legend">
              <span><i className="dot green" /> Healthy <b>{healthyCount ?? '—'}</b></span>
              <span><i className="dot orange" /> Low stock <b>{lowCount ?? '—'}</b></span>
              <span><i className="dot red" /> Out of stock <b>{outCount ?? '—'}</b></span>
            </div>
          </div>
          <div className="stock-alert">
            <div><Boxes /><span><strong>{(lowCount ?? 0) + (outCount ?? 0)} products</strong> need attention</span></div>
            <button onClick={() => onNavigate('Inventory')}>View</button>
          </div>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2>Low stock and out-of-stock products</h2><p>Products that need to be restocked</p></div>
        </div>
        {data?.alerts ? (
          alertRows.length > 0 ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Product</th><th>SKU</th><th>Current stock</th><th>Minimum</th><th>Status</th></tr></thead>
                <tbody>
                  {alertRows.map(({ product, out }) => (
                    <tr key={product._id}>
                      <td><strong>{product.name}</strong></td>
                      <td>{product.sku}</td>
                      <td><strong className={out ? 'stock-low' : ''}>{product.currentStock}</strong></td>
                      <td>{product.minStockLevel}</td>
                      <td><span className={`status ${out ? 'out-of-stock' : 'low-stock'}`}>{out ? 'Out of stock' : 'Low stock'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subheading">No alerts right now. All products are in stock.</p>
          )
        ) : (
          <p className="subheading">{loading ? 'Loading...' : 'Alert data is not available'}</p>
        )}
      </section>
    </>
  )
}

export default App
