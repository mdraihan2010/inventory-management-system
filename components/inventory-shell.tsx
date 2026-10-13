'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react'

const navGroups = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/', icon: LayoutDashboard }] },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', href: '/products', icon: Package },
      { label: 'Categories', href: '/categories', icon: Boxes },
      { label: 'Brands', href: '/brands', icon: Tags },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Inventory / Stock', href: '/inventory', icon: ClipboardList },
      { label: 'Purchases', href: '/purchases', icon: ShoppingCart },
      { label: 'Sales', href: '/sales', icon: CircleDollarSign },
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'Suppliers', href: '/suppliers', icon: Truck },
      { label: 'Returns', href: '/returns', icon: RotateCcw },
    ],
  },
  {
    label: 'Finance & Admin',
    items: [
      { label: 'Payments and Dues', href: '/payments', icon: WalletCards },
      { label: 'Reports', href: '/reports', icon: FileBarChart },
      { label: 'User Management', href: '/users', icon: UserRound },
    ],
  },
]

const products = [
  { name: 'Wireless Keyboard', sku: 'SKU-1048', category: 'Accessories', stock: 128, price: '$48.00', status: 'In stock' },
  { name: 'Ergonomic Office Chair', sku: 'SKU-2041', category: 'Furniture', stock: 24, price: '$189.00', status: 'In stock' },
  { name: 'USB-C Hub 7-in-1', sku: 'SKU-3092', category: 'Accessories', stock: 8, price: '$59.00', status: 'Low stock' },
  { name: '27" 4K Monitor', sku: 'SKU-4017', category: 'Electronics', stock: 0, price: '$429.00', status: 'Out of stock' },
  { name: 'Mechanical Mouse', sku: 'SKU-5120', category: 'Accessories', stock: 76, price: '$36.00', status: 'In stock' },
]

const activity = [
  ['New purchase order', 'PO-2024-089 · TechSource Ltd.', '12 min ago', 'purchase'],
  ['Stock adjustment', 'USB-C Hub 7-in-1 · -4 units', '45 min ago', 'stock'],
  ['New sale completed', 'INV-2024-318 · $1,240.00', '2 hours ago', 'sale'],
  ['Return received', 'RET-2024-021 · 2 items', 'Yesterday', 'return'],
]

function statusClass(status: string) {
  if (status === 'In stock') return 'bg-emerald-50 text-emerald-700'
  if (status === 'Low stock') return 'bg-amber-50 text-amber-700'
  return 'bg-rose-50 text-rose-700'
}

export function InventoryShell() {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const currentTitle = pathname === '/' ? 'Dashboard' : navGroups.flatMap((group) => group.items).find((item) => item.href === pathname)?.label ?? 'Dashboard'

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[82px]' : ''}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm"><Boxes className="size-5" /></div>
          {!collapsed && <div><p className="text-sm font-bold tracking-tight text-slate-900">StockPilot</p><p className="text-[11px] font-medium text-slate-400">Inventory Suite</p></div>}
          <button aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50 lg:hidden"><X className="size-4" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {navGroups.map((group) => <div key={group.label} className="mb-6"><p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ${collapsed ? 'lg:hidden' : ''}`}>{group.label}</p><div className="flex flex-col gap-1">{group.items.map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} title={collapsed ? item.label : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}><Icon className="size-[18px] shrink-0" />{!collapsed && <span>{item.label}</span>}{active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-indigo-600" />}</Link> })}</div></div>)}
        </nav>
        <div className={`border-t border-slate-100 p-3 ${collapsed ? 'lg:px-2' : ''}`}><Link href="/login" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"><LogOut className="size-[18px]" />{!collapsed && 'Sign out'}</Link></div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-[82px]' : 'lg:pl-[260px]'}`}>
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-sm sm:px-8">
          <div className="flex items-center gap-3"><button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden"><Menu className="size-5" /></button><button aria-label="Toggle sidebar" onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-50 lg:block">{collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}</button><div><p className="text-xs font-medium text-slate-400">Workspace / <span className="text-slate-500">{currentTitle}</span></p><h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">{currentTitle}</h1></div></div>
          <div className="flex items-center gap-2 sm:gap-5"><button aria-label="Search" className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-50 sm:block"><Search className="size-[18px]" /></button><button aria-label="Notifications" className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-50"><Bell className="size-[18px]" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-indigo-600" /></button><div className="hidden h-7 w-px bg-slate-200 sm:block" /><button className="flex items-center gap-2 rounded-lg py-1 text-left"><div className="grid size-9 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">AR</div><div className="hidden sm:block"><p className="text-xs font-bold text-slate-800">Alex Rahman</p><p className="text-[11px] text-slate-400">Administrator</p></div><ChevronDown className="hidden size-4 text-slate-400 sm:block" /></button></div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-8">{pathname === '/' ? <Dashboard /> : <ListingPage title={currentTitle} />}</main>
      </div>
    </div>
  )
}

function Dashboard() {
  return <div className="flex flex-col gap-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-slate-500">Tuesday, October 13, 2026</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Good morning, Alex</h2><p className="mt-1 text-sm text-slate-500">Here's what's happening with your inventory today.</p></div><button className="inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"><Plus className="size-4" /> Add new product</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Total products','1,284','+12.8%','from last month',Package,'text-indigo-600','bg-indigo-50'],['Inventory value','$84,280.00','+8.4%','from last month',CircleDollarSign,'text-emerald-600','bg-emerald-50'],['Low stock items','18','-4.2%','from last month',AlertTriangle,'text-amber-600','bg-amber-50'],['Pending orders','32','+18.6%','from last month',ShoppingCart,'text-violet-600','bg-violet-50']].map(([label,value,change,sub,Icon,color,bg]) => <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-slate-500">{label as string}</p><p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value as string}</p></div><div className={`grid size-10 place-items-center rounded-lg ${bg as string}`}><Icon className={`size-5 ${color as string}`} /></div></div><div className="mt-4 flex items-center gap-1.5 text-xs"><span className={`flex items-center font-semibold ${(change as string).startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}`}>{(change as string).startsWith('-') ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}{change as string}</span><span className="text-slate-400">{sub as string}</span></div></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Sales overview</h3><p className="mt-0.5 text-xs text-slate-400">Revenue performance over the last 7 days</p></div><select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none"><option>This week</option><option>This month</option></select></div><div className="p-5"><div className="flex items-end justify-between"><div><p className="text-3xl font-bold tracking-tight text-slate-900">$12,840.00</p><p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600"><ArrowUpRight className="size-3.5" /> 12.8% vs last week</p></div><div className="flex items-center gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-600" />Sales</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-200" />Purchases</span></div></div><div className="mt-8 flex h-48 items-end gap-2 border-b border-slate-100 sm:gap-4">{[48,70,52,82,64,96,75].map((height,index) => <div key={index} className="group flex flex-1 flex-col items-center gap-2"><div className="relative flex h-full w-full items-end gap-1"><div className="w-1/2 rounded-t bg-slate-200" style={{height: `${Math.max(30,height-18)}%`}} /><div className="w-1/2 rounded-t bg-indigo-600 transition-all group-hover:bg-indigo-500" style={{height: `${height}%`}} /></div><span className="text-[11px] text-slate-400">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index]}</span></div>)}</div></div></div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Recent activity</h3><p className="mt-0.5 text-xs text-slate-400">Latest updates across your store</p></div><button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button></div><div className="p-5">{activity.map(([title,detail,time,type],index) => <div key={title} className={`flex gap-3 ${index ? 'mt-5' : ''}`}><div className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${type === 'purchase' ? 'bg-violet-50 text-violet-600' : type === 'sale' ? 'bg-emerald-50 text-emerald-600' : type === 'stock' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>{type === 'purchase' ? <ShoppingCart className="size-4" /> : type === 'sale' ? <CircleDollarSign className="size-4" /> : type === 'stock' ? <Boxes className="size-4" /> : <RotateCcw className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{title}</p><span className="shrink-0 text-[11px] text-slate-400">{time}</span></div><p className="mt-1 truncate text-xs text-slate-500">{detail}</p></div></div>)}</div></div>
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">Product inventory</h3><p className="mt-0.5 text-xs text-slate-400">Current stock levels and availability</p></div><Link href="/products" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all products</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Product</th><th className="px-5 py-3 font-semibold">Category</th><th className="px-5 py-3 font-semibold">Stock</th><th className="px-5 py-3 font-semibold">Price</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{products.map((product) => <tr key={product.sku} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{product.name}</p><p className="mt-0.5 text-xs text-slate-400">{product.sku}</p></td><td className="px-5 py-4 text-slate-500">{product.category}</td><td className="px-5 py-4 font-medium text-slate-700">{product.stock} units</td><td className="px-5 py-4 font-medium text-slate-700">{product.price}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(product.status)}`}>{product.status}</span></td></tr>)}</tbody></table></div></div>
  </div>
}

function ListingPage({ title }: { title: string }) {
  const data = title === 'Products' ? products : products.map((p,index) => ({...p, name: `${title} record ${index + 1}`, sku: `REF-${2024 + index}`, category: 'General', stock: index * 8 + 12}))
  return <div className="flex flex-col gap-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-slate-500">Manage and organize your {title.toLowerCase()}.</p><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2></div><button className="inline-flex w-fit items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700"><Plus className="size-4" /> Add {title === 'Products' ? 'product' : 'new record'}</button></div><div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input placeholder={`Search ${title.toLowerCase()}...`} className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none ring-indigo-100 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4" /></div><button className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Settings className="size-4" /> Filters</button></div><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Group</th><th className="px-5 py-3 font-semibold">Quantity</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{data.map((item) => <tr key={item.sku} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-slate-800">{item.name}</td><td className="px-5 py-4 text-slate-500">{item.sku}</td><td className="px-5 py-4 text-slate-500">{item.category}</td><td className="px-5 py-4 font-medium text-slate-700">{item.stock}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span></td><td className="px-5 py-4"><button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View details</button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>Showing 1–5 of 1,284 records</span><div className="flex gap-1"><button className="rounded border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">Previous</button><button className="rounded bg-indigo-600 px-2.5 py-1.5 font-semibold text-white">1</button><button className="rounded border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">2</button><button className="rounded border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50">Next</button></div></div></div></div>
}

export function LoginPage() {
  return <main className="grid min-h-screen bg-white lg:grid-cols-2"><div className="hidden bg-indigo-700 p-12 text-white lg:flex lg:flex-col lg:justify-between"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/15"><Boxes className="size-5" /></div><span className="font-bold">StockPilot</span></div><div className="max-w-md"><p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Inventory made simple</p><h1 className="text-5xl font-bold leading-tight tracking-tight">Know your stock. Grow your business.</h1><p className="mt-6 text-lg leading-8 text-indigo-100">A clear, focused workspace for managing products, orders, and your entire inventory operation.</p></div><p className="text-sm text-indigo-200">Web Engineering Laboratory · 2026</p></div><div className="flex items-center justify-center p-6 sm:p-12"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white"><Boxes className="size-5" /></div><span className="font-bold text-slate-900">StockPilot</span></div></div><div><p className="text-sm font-medium text-slate-500">Welcome back</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Sign in to your account</h1><p className="mt-2 text-sm text-slate-500">Enter your details to access the dashboard.</p></div><form className="mt-8 flex flex-col gap-5" action="/"><label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">Email address<input type="email" placeholder="you@company.com" defaultValue="admin@stockpilot.com" className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none ring-indigo-100 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4" /></label><label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">Password<input type="password" placeholder="••••••••" defaultValue="password" className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none ring-indigo-100 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4" /></label><div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-slate-500"><input type="checkbox" defaultChecked className="size-4 rounded border-slate-300 text-indigo-600" /> Remember me</label><button type="button" className="font-semibold text-indigo-600 hover:text-indigo-700">Forgot password?</button></div><button className="h-11 rounded-lg bg-indigo-600 text-sm font-semibold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700">Sign in</button></form><p className="mt-8 text-center text-xs text-slate-400">Demo frontend · Backend integration coming soon</p></div></div></main>
}

export function isLoginRoute(pathname: string) { return pathname === '/login' }

export const _unused = { BarChart3, LogOut, Store }

export default InventoryShell
