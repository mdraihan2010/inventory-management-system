'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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

const products = [
  { sku: 'PRD-1001', name: 'Wireless Headphones', category: 'Electronics', brand: 'SoundMax', stock: 128, price: '$89.00', status: 'In stock' },
  { sku: 'PRD-1002', name: 'Ergonomic Office Chair', category: 'Furniture', brand: 'WorkWell', stock: 42, price: '$249.00', status: 'In stock' },
  { sku: 'PRD-1003', name: 'Mechanical Keyboard', category: 'Electronics', brand: 'Keychron', stock: 9, price: '$129.00', status: 'Low stock' },
  { sku: 'PRD-1004', name: 'Canvas Backpack', category: 'Accessories', brand: 'UrbanCarry', stock: 0, price: '$68.00', status: 'Out of stock' },
  { sku: 'PRD-1005', name: 'USB-C Docking Station', category: 'Electronics', brand: 'ConnectPro', stock: 76, price: '$159.00', status: 'In stock' },
]

const ROLE_LABEL: Record<string, string> = {
  ADMINISTRATOR: 'Administrator',
  MANAGER: 'Manager',
  STAFF: 'Staff',
}

type CurrentUser = { name: string; role: string }

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
  DRAFT: 'খসড়া',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

const SALE_STATUS_CLASS: Record<SaleStatus, string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

const numberFormat = new Intl.NumberFormat('en-IN')

function taka(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `৳ ${numberFormat.format(value)}`
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

// সব তথ্য একসাথে আনা হয়। একটা ব্যর্থ হলেও বাকিগুলো দেখানো হয়, যেমন Staff-এর রিপোর্ট নেই
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
  const [query, setQuery] = useState('')
  const [me, setMe] = useState<CurrentUser | null>(null)

  useEffect(() => {
    apiRequest<{ success: boolean; user: CurrentUser }>('/auth/me')
      .then((response) => setMe(response.user))
      .catch(() => setMe(null))
  }, [])

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [query])

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

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><div className="brand-mark"><Boxes /></div><div><strong>StockPilot</strong><span>Inventory Suite</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {['Overview', 'Catalog', 'Operations', 'People', 'Finance', 'System'].map((group) => <div className="nav-group" key={group}><p>{group}</p>{navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} onClick={() => selectPage(label)}><Icon /><span>{label}</span></button>)}</div>)}
        </nav>
        <div className="sidebar-help"><div className="help-icon"><CreditCard /></div><strong>Need help?</strong><p>Check our documentation for quick tips.</p><button>View guide <span>→</span></button></div>
        <div className="sidebar-footer"><div className="avatar">{initials}</div><div><strong>{userName || 'লোড হচ্ছে...'}</strong><span>{roleLabel}</span></div><button className="icon-button" onClick={handleLogout} aria-label="Logout"><LogOut /></button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div><div className="topbar-actions"><label className="global-search"><Search /><input placeholder="Search anything..." aria-label="Search" /></label><button className="icon-button" aria-label="Notifications"><Bell /><i /></button><div className="top-avatar">{initials}</div></div></header>
        <div className="page-content">
          {activePage === 'Dashboard' ? <Dashboard onNavigate={selectPage} userName={userName} /> : activePage === 'Products' ? <ProductsPage canManage={canManage} /> : activePage === 'Sales' ? <SalesPage canManage={canManage} /> : activePage === 'Customers' ? <CustomersPage canManage={canManage} /> : activePage === 'Suppliers' ? <SuppliersPage canManage={canManage} /> : activePage === 'Purchases' ? <PurchasesPage canManage={canManage} /> : activePage === 'Categories' ? <CategoriesPage canManage={canManage} /> : activePage === 'Brands' ? <BrandsPage canManage={canManage} /> : activePage === 'Inventory' ? <InventoryPage canManage={canManage} /> : activePage === 'User Management' ? <UsersPage isAdmin={isAdmin} /> : activePage === 'Reports' ? <ReportsPage canManage={canManage} /> : activePage === 'Payments & Dues' ? <PaymentsPage canManage={canManage} /> : <SectionPage page={activePage} query={query} setQuery={setQuery} filteredProducts={filteredProducts} onNavigate={selectPage} />}
        </div>
      </main>
    </div>
  )
}

function Dashboard({ onNavigate, userName }: { onNavigate: (page: PageKey) => void; userName: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await loadDashboard()
    setData(result)
    setLoading(false)

    // কোনো request-এ token অবৈধ পাওয়া গেলে apiRequest তা মুছে দেয়। তখন login পর্দায় ফেরত যাওয়া দরকার
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
      label: 'মোট পণ্য',
      value: totalProducts === null ? (loading ? '...' : '—') : numberFormat.format(totalProducts),
      note: 'ক্যাটালগে সব পণ্য',
      icon: Package,
      tone: 'blue',
    },
    {
      label: 'আজকের বিক্রি',
      value: taka(data?.today?.totalSales),
      note: data?.today ? `${data.today.count} টি সম্পন্ন বিক্রি` : 'তথ্য পাওয়া যায়নি',
      icon: ShoppingCart,
      tone: 'green',
    },
    {
      label: 'এই মাসের বিক্রি',
      value: taka(data?.month?.totalSales),
      note: data?.month ? `${data.month.count} টি সম্পন্ন বিক্রি` : 'তথ্য পাওয়া যায়নি',
      icon: CircleDollarSign,
      tone: 'purple',
    },
    {
      label: 'মোট বাকি',
      value: taka(data?.allTime?.totalOutstanding),
      note: 'গ্রাহকদের কাছে পাওনা',
      icon: WalletCards,
      tone: 'orange',
    },
  ]

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>স্বাগতম, {userName || 'ব্যবহারকারী'}</h1>
          <p className="subheading">আপনার ইনভেন্টরি ও বিক্রির সর্বশেষ অবস্থা।</p>
        </div>
        <div className="toolbar-actions">
          <button className="icon-button" onClick={refresh} aria-label="Refresh dashboard"><RefreshCw /></button>
          <button className="primary-button" onClick={() => onNavigate('Products')}><Plus /> নতুন পণ্য</button>
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
            <div><h2>সাম্প্রতিক বিক্রি</h2><p>সর্বশেষ ৫টি বিক্রি</p></div>
            <button className="more-button" onClick={() => onNavigate('Sales')}>সব দেখুন <span>→</span></button>
          </div>
          {data?.recentSales ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>বিক্রি নম্বর</th><th>গ্রাহক</th><th>তারিখ</th><th>মোট</th><th>অবস্থা</th></tr></thead>
                <tbody>
                  {data.recentSales.map((sale) => (
                    <tr key={sale._id}>
                      <td><strong className="ref-code">{sale.saleNumber}</strong></td>
                      <td>{sale.customer?.name ?? 'খুচরা গ্রাহক'}</td>
                      <td>{new Date(sale.saleDate).toLocaleDateString('en-GB')}</td>
                      <td>{taka(sale.grandTotal)}</td>
                      <td><span className={`status ${SALE_STATUS_CLASS[sale.status]}`}>{SALE_STATUS_LABEL[sale.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subheading">{loading ? 'তথ্য লোড হচ্ছে...' : 'বিক্রির তথ্য পাওয়া যায়নি'}</p>
          )}
        </article>

        <article className="panel stock-panel">
          <div className="panel-heading">
            <div><h2>স্টক অবস্থা</h2><p>বর্তমান ইনভেন্টরির স্বাস্থ্য</p></div>
            <button className="more-button" onClick={() => onNavigate('Inventory')}>বিস্তারিত <span>→</span></button>
          </div>
          <div className="donut-row">
            <div className="donut"><div><strong>{totalProducts ?? '—'}</strong><span>মোট পণ্য</span></div></div>
            <div className="stock-legend">
              <span><i className="dot green" /> স্বাভাবিক <b>{healthyCount ?? '—'}</b></span>
              <span><i className="dot orange" /> কম স্টক <b>{lowCount ?? '—'}</b></span>
              <span><i className="dot red" /> স্টক শেষ <b>{outCount ?? '—'}</b></span>
            </div>
          </div>
          <div className="stock-alert">
            <div><Boxes /><span><strong>{(lowCount ?? 0) + (outCount ?? 0)} টি পণ্য</strong> মনোযোগ দরকার</span></div>
            <button onClick={() => onNavigate('Inventory')}>দেখুন</button>
          </div>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2>কম স্টক ও শেষ হওয়া পণ্য</h2><p>যেসব পণ্যের পুনরায় ক্রয় প্রয়োজন</p></div>
        </div>
        {data?.alerts ? (
          alertRows.length > 0 ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>পণ্য</th><th>SKU</th><th>বর্তমান স্টক</th><th>সর্বনিম্ন</th><th>অবস্থা</th></tr></thead>
                <tbody>
                  {alertRows.map(({ product, out }) => (
                    <tr key={product._id}>
                      <td><strong>{product.name}</strong></td>
                      <td>{product.sku}</td>
                      <td><strong className={out ? 'stock-low' : ''}>{product.currentStock}</strong></td>
                      <td>{product.minStockLevel}</td>
                      <td><span className={`status ${out ? 'out-of-stock' : 'low-stock'}`}>{out ? 'শেষ' : 'কম স্টক'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="subheading">এখন কোনো সতর্কতা নেই। সব পণ্যের স্টক ঠিক আছে।</p>
          )
        ) : (
          <p className="subheading">{loading ? 'তথ্য লোড হচ্ছে...' : 'সতর্কতার তথ্য পাওয়া যায়নি'}</p>
        )}
      </section>
    </>
  )
}

function SectionPage({ page, query, setQuery, filteredProducts, onNavigate }: { page: PageKey; query: string; setQuery: (query: string) => void; filteredProducts: typeof products; onNavigate: (page: PageKey) => void }) {
  const isProducts = page === 'Products' || page === 'Inventory'
  return <><div className="page-heading"><div><p className="eyebrow">Workspace / {page}</p><h1>{page}</h1><p className="subheading">Manage and monitor your {page.toLowerCase()} in one place.</p></div><button className="primary-button"><Plus /> Add {page === 'Products' ? 'product' : 'record'}</button></div><div className="section-stat-row"><div className="small-stat"><span>Total records</span><strong>{page === 'Products' ? '1,248' : '186'}</strong><small>Updated just now</small></div><div className="small-stat"><span>Active this month</span><strong>{page === 'Customers' ? '892' : '94%'}</strong><small className="positive">↑ 8.4% from last month</small></div><div className="small-stat"><span>Pending action</span><strong>{page === 'Inventory' ? '24' : '12'}</strong><small>Requires review</small></div></div><section className="panel table-panel"><div className="table-toolbar"><div className="table-title"><h2>{isProducts ? (page === 'Inventory' ? 'Inventory levels' : 'Product catalog') : `${page} list`}</h2><span>{isProducts ? filteredProducts.length : 12} records</span></div><div className="toolbar-actions"><label className="table-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." /></label><button className="filter-button">Filter <ChevronDown /></button></div></div>{isProducts ? <ProductTable rows={filteredProducts} /> : <GenericTable page={page} />}</section><button className="back-dashboard" onClick={() => onNavigate('Dashboard')}>← Back to dashboard</button></>
}

function ProductTable({ rows }: { rows: typeof products }) { return <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Stock</th><th>Price</th><th>Status</th><th /></tr></thead><tbody>{rows.map((product) => <tr key={product.sku}><td><div className="product-cell"><div className="product-thumb"><Package /></div><div><strong>{product.name}</strong><span>{product.sku}</span></div></div></td><td>{product.category}</td><td>{product.brand}</td><td><strong className={product.stock < 20 ? 'stock-low' : ''}>{product.stock}</strong></td><td>{product.price}</td><td><span className={`status ${product.status.toLowerCase().replaceAll(' ', '-')}`}>{product.status}</span></td><td><button className="row-menu" aria-label={`Actions for ${product.name}`}>•••</button></td></tr>)}</tbody></table></div> }

function GenericTable({ page }: { page: PageKey }) { const names = ['PO-2024-0186', 'SO-2024-0912', 'RET-2024-0042', 'INV-2024-0221']; return <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Name</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{names.map((name, index) => <tr key={name}><td><strong className="ref-code">{page.slice(0, 3).toUpperCase()}-{String(186 - index).padStart(4, '0')}</strong></td><td>{name}</td><td>Oct {14 - index}, 2024</td><td>${(3200 - index * 418).toLocaleString()}</td><td><span className={`status ${index === 2 ? 'pending' : 'in-stock'}`}>{index === 2 ? 'Pending' : 'Completed'}</span></td><td><button className="row-menu" aria-label={`Actions for ${name}`}>•••</button></td></tr>)}</tbody></table></div> }

export default App