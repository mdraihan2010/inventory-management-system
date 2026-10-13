'use client'

import { useMemo, useState } from 'react'
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
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

const summary = [
  { label: 'Total products', value: '1,248', change: '+12.5%', icon: Package, tone: 'blue' },
  { label: 'Total sales', value: '$48,290', change: '+8.2%', icon: CircleDollarSign, tone: 'green' },
  { label: 'Purchase orders', value: '186', change: '+4.3%', icon: ClipboardList, tone: 'purple' },
  { label: 'Low stock items', value: '24', change: '-6.8%', icon: Boxes, tone: 'orange' },
]

function App() {
  const [activePage, setActivePage] = useState<PageKey>('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase())), [query])

  const selectPage = (page: PageKey) => {
    setActivePage(page)
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><div className="brand-mark"><Boxes /></div><div><strong>StockPilot</strong><span>Inventory Suite</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X /></button></div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {['Overview', 'Catalog', 'Operations', 'People', 'Finance', 'System'].map((group) => <div className="nav-group" key={group}><p>{group}</p>{navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activePage === label ? 'active' : ''}`} onClick={() => selectPage(label)}><Icon /><span>{label}</span>{label === 'Inventory' && <b>24</b>}</button>)}</div>)}
        </nav>
        <div className="sidebar-help"><div className="help-icon"><CreditCard /></div><strong>Need help?</strong><p>Check our documentation for quick tips.</p><button>View guide <span>→</span></button></div>
        <div className="sidebar-footer"><div className="avatar">RA</div><div><strong>Raihan Ahmed</strong><span>Administrator</span></div><ChevronDown /></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div><div className="topbar-actions"><label className="global-search"><Search /><input placeholder="Search anything..." aria-label="Search" /></label><button className="icon-button" aria-label="Notifications"><Bell /><i /></button><div className="top-avatar">RA</div></div></header>
        <div className="page-content">
          {activePage === 'Dashboard' ? <Dashboard onNavigate={selectPage} /> : <SectionPage page={activePage} query={query} setQuery={setQuery} filteredProducts={filteredProducts} onNavigate={selectPage} />}
        </div>
      </main>
    </div>
  )
}

function Dashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">Monday, October 14, 2024</p><h1>Good morning, Raihan</h1><p className="subheading">Here&apos;s what&apos;s happening with your inventory today.</p></div><button className="primary-button" onClick={() => onNavigate('Products')}><Plus /> Add product</button></div>
    <section className="summary-grid">{summary.map(({ label, value, change, icon: Icon, tone }) => <article className="summary-card" key={label}><div className={`metric-icon ${tone}`}><Icon /></div><div className="metric-info"><span>{label}</span><strong>{value}</strong><small className={change.startsWith('-') ? 'negative' : ''}>{change} <em>vs last month</em></small></div><div className="metric-menu">•••</div></article>)}</section>
    <section className="dashboard-grid"><article className="panel sales-panel"><div className="panel-heading"><div><h2>Sales overview</h2><p>Revenue performance for the last 7 months</p></div><select aria-label="Sales period"><option>Last 7 months</option><option>Last 30 days</option></select></div><div className="chart-wrap"><div className="chart-y"><span>$60k</span><span>$40k</span><span>$20k</span><span>$0</span></div><div className="chart"><div className="grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 640 220" preserveAspectRatio="none" aria-label="Sales line chart" role="img"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2f6fed" stopOpacity=".22" /><stop offset="1" stopColor="#2f6fed" stopOpacity="0" /></linearGradient></defs><path d="M0 170 C70 150 80 155 120 130 S205 128 240 95 S310 110 350 80 S420 115 460 72 S540 75 585 42 S620 55 640 30 L640 220 L0 220Z" fill="url(#area)" /><path d="M0 170 C70 150 80 155 120 130 S205 128 240 95 S310 110 350 80 S420 115 460 72 S540 75 585 42 S620 55 640 30" fill="none" stroke="#2f6fed" strokeWidth="3" strokeLinecap="round" /></svg><div className="chart-x"><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span></div></div></div><div className="chart-legend"><span><i className="dot blue" /> Revenue <b>$48,290</b></span><span><i className="dot gray" /> Orders <b>1,842</b></span></div></article><article className="panel stock-panel"><div className="panel-heading"><div><h2>Stock status</h2><p>Current inventory health</p></div><button className="more-button" onClick={() => onNavigate('Inventory')}>View all <span>→</span></button></div><div className="donut-row"><div className="donut"><div><strong>1,248</strong><span>Total items</span></div></div><div className="stock-legend"><span><i className="dot green" /> In stock <b>1,096</b></span><span><i className="dot orange" /> Low stock <b>128</b></span><span><i className="dot red" /> Out of stock <b>24</b></span></div></div><div className="stock-alert"><div><Boxes /><span><strong>24 items</strong> need your attention</span></div><button onClick={() => onNavigate('Inventory')}>Review</button></div></article></section>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent products</h2><p>Latest products added to your catalog</p></div><button className="more-button" onClick={() => onNavigate('Products')}>View all products <span>→</span></button></div><ProductTable rows={products.slice(0, 4)} /></section>
  </>
}

function SectionPage({ page, query, setQuery, filteredProducts, onNavigate }: { page: PageKey; query: string; setQuery: (query: string) => void; filteredProducts: typeof products; onNavigate: (page: PageKey) => void }) {
  const isProducts = page === 'Products' || page === 'Inventory'
  return <><div className="page-heading"><div><p className="eyebrow">Workspace / {page}</p><h1>{page}</h1><p className="subheading">Manage and monitor your {page.toLowerCase()} in one place.</p></div><button className="primary-button"><Plus /> Add {page === 'Products' ? 'product' : 'record'}</button></div><div className="section-stat-row"><div className="small-stat"><span>Total records</span><strong>{page === 'Products' ? '1,248' : '186'}</strong><small>Updated just now</small></div><div className="small-stat"><span>Active this month</span><strong>{page === 'Customers' ? '892' : '94%'}</strong><small className="positive">↑ 8.4% from last month</small></div><div className="small-stat"><span>Pending action</span><strong>{page === 'Inventory' ? '24' : '12'}</strong><small>Requires review</small></div></div><section className="panel table-panel"><div className="table-toolbar"><div className="table-title"><h2>{isProducts ? (page === 'Inventory' ? 'Inventory levels' : 'Product catalog') : `${page} list`}</h2><span>{isProducts ? filteredProducts.length : 12} records</span></div><div className="toolbar-actions"><label className="table-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." /></label><button className="filter-button">Filter <ChevronDown /></button></div></div>{isProducts ? <ProductTable rows={filteredProducts} /> : <GenericTable page={page} />}</section><button className="back-dashboard" onClick={() => onNavigate('Dashboard')}>← Back to dashboard</button></>
}

function ProductTable({ rows }: { rows: typeof products }) { return <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Brand</th><th>Stock</th><th>Price</th><th>Status</th><th /></tr></thead><tbody>{rows.map((product) => <tr key={product.sku}><td><div className="product-cell"><div className="product-thumb"><Package /></div><div><strong>{product.name}</strong><span>{product.sku}</span></div></div></td><td>{product.category}</td><td>{product.brand}</td><td><strong className={product.stock < 20 ? 'stock-low' : ''}>{product.stock}</strong></td><td>{product.price}</td><td><span className={`status ${product.status.toLowerCase().replaceAll(' ', '-')}`}>{product.status}</span></td><td><button className="row-menu" aria-label={`Actions for ${product.name}`}>•••</button></td></tr>)}</tbody></table></div> }

function GenericTable({ page }: { page: PageKey }) { const names = page === 'Customers' ? ['Ayesha Rahman', 'Nabil Hasan', 'Maya Chowdhury', 'Omar Faruk'] : page === 'Suppliers' ? ['TechSource Ltd.', 'OfficeMart BD', 'Global Goods'] : ['PO-2024-0186', 'SO-2024-0912', 'RET-2024-0042', 'INV-2024-0221']; return <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Name</th><th>Date</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{names.map((name, index) => <tr key={name}><td><strong className="ref-code">{page.slice(0, 3).toUpperCase()}-{String(186 - index).padStart(4, '0')}</strong></td><td>{name}</td><td>Oct {14 - index}, 2024</td><td>${(3200 - index * 418).toLocaleString()}</td><td><span className={`status ${index === 2 ? 'pending' : 'in-stock'}`}>{index === 2 ? 'Pending' : 'Completed'}</span></td><td><button className="row-menu" aria-label={`Actions for ${name}`}>•••</button></td></tr>)}</tbody></table></div> }

export default App
