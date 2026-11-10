'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { ProductPicker } from '@/components/product-picker'
import { rowAction } from '@/components/ui/row-action'
import { AdjustModal } from '@/components/inventory-modals'
import {
  MOVEMENT_LABEL,
  STATE_CLASS,
  STATE_LABEL,
  formatDateTime,
  inputClass,
  stockStateOf,
  type Movement,
  type ProductRow,
  type StockState,
} from '@/components/inventory-shared'

type MovementsResponse = { success: boolean; count: number; data: Movement[] }
type ProductsResponse = { success: boolean; total: number; page: number; totalPages: number; data: ProductRow[] }
type AlertsResponse = { outOfStock: { count: number }; lowStock: { count: number } }
type Stats = { active: number; low: number; out: number }

const PAGE_SIZE = 25

export function InventoryPage({ canManage }: { canManage: boolean }) {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productError, setProductError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [matching, setMatching] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [movementError, setMovementError] = useState('')
  const [notice, setNotice] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const selectedId = selectedProduct?._id ?? ''

  // Wait a moment after typing, then search on the server
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  // Only one page of products is loaded at a time, so the page stays fast with thousands of products
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    setProductError('')
    const params = new URLSearchParams({ isActive: 'true', page: String(page), limit: String(PAGE_SIZE) })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (stateFilter) params.set('stock', stateFilter)
    try {
      const response = await apiRequest<ProductsResponse>(`/products?${params.toString()}`)
      setProducts(response.data)
      setMatching(response.total)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setProductError(err instanceof ApiError ? err.message : 'Could not load the product list.')
    } finally {
      setLoadingProducts(false)
    }
  }, [page, debouncedSearch, stateFilter])

  // The counts at the top come from the server, so they cover every product, not only this page
  const loadStats = useCallback(async () => {
    const [activeRes, alertsRes] = await Promise.allSettled([
      apiRequest<ProductsResponse>('/products?isActive=true&limit=1'),
      apiRequest<AlertsResponse>('/inventory/alerts'),
    ])
    setStats({
      active: activeRes.status === 'fulfilled' ? activeRes.value.total : 0,
      low: alertsRes.status === 'fulfilled' ? alertsRes.value.lowStock.count : 0,
      out: alertsRes.status === 'fulfilled' ? alertsRes.value.outOfStock.count : 0,
    })
  }, [])

  const loadMovements = useCallback(async (productId: string) => {
    setLoadingMovements(true)
    setMovementError('')
    try {
      const response = await apiRequest<MovementsResponse>(`/inventory/movements?productId=${productId}`)
      setMovements(response.data)
    } catch (err) {
      setMovements([])
      setMovementError(err instanceof ApiError ? err.message : 'Could not load stock history.')
    } finally {
      setLoadingMovements(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (selectedId) {
      loadMovements(selectedId)
    } else {
      setMovements([])
    }
  }, [selectedId, loadMovements])

  function handleSaved(message: string) {
    setAdjusting(false)
    setNotice(message)
    loadProducts()
    loadStats()
    if (selectedId) loadMovements(selectedId)
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Inventory</p>
          <h1>Inventory</h1>
          <p className="subheading">Current stock, alerts and the history of every stock change.</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={() => setAdjusting(true)}>
            <Plus /> Adjust stock
          </button>
        )}
      </div>

      <div className="section-stat-row">
        <div className="small-stat">
          <span>Active products</span>
          <strong>{stats ? stats.active.toLocaleString('en-US') : '—'}</strong>
          <small>Total listed</small>
        </div>
        <div className="small-stat">
          <span>Low stock</span>
          <strong>{stats ? stats.low.toLocaleString('en-US') : '—'}</strong>
          <small>At or below the minimum</small>
        </div>
        <div className="small-stat">
          <span>Out of stock</span>
          <strong>{stats ? stats.out.toLocaleString('en-US') : '—'}</strong>
          <small>Currently zero</small>
        </div>
      </div>

      {notice && <p className="px-1 text-sm text-green-700">{notice}</p>}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Stock list</h2>
            <span>{matching.toLocaleString('en-US')} items</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              <option value="OK">Healthy</option>
              <option value="LOW">Low stock</option>
              <option value="OUT">Out of stock</option>
            </select>
          </div>
        </div>

        {productError && <p className="px-4 pb-2 text-sm text-red-600">{productError}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Current stock</th>
                <th>Minimum</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts && <tr><td colSpan={6}>Loading...</td></tr>}
              {!loadingProducts && products.length === 0 && <tr><td colSpan={6}>No products found.</td></tr>}
              {!loadingProducts && products.map((product) => {
                const state = stockStateOf(product)
                return (
                  <tr key={product._id}>
                    <td><strong>{product.name}</strong></td>
                    <td>{product.sku}</td>
                    <td>
                      <strong className={state === 'OK' ? '' : 'stock-low'}>{product.currentStock}</strong> {product.unit}
                    </td>
                    <td>{product.minStockLevel}</td>
                    <td><span className={`status ${STATE_CLASS[state]}`}>{STATE_LABEL[state as StockState]}</span></td>
                    <td>
                      <button className={rowAction.history} onClick={() => setSelectedProduct(product)}>
                        History
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-1 py-3 text-sm">
          <span>Page {page} / {totalPages}</span>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
              disabled={page <= 1 || loadingProducts}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
              disabled={page >= totalPages || loadingProducts}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Stock history</h2>
            {selectedProduct && <span>{selectedProduct.name}</span>}
          </div>
          <div className="toolbar-actions">
            <div className="w-full max-w-sm">
              <ProductPicker<ProductRow> value={selectedProduct} onChange={setSelectedProduct} activeOnly={false} />
            </div>
          </div>
        </div>

        {!selectedId && <p className="px-4 pb-4 text-sm text-gray-500">Search for a product, or press History in the list above, to view its stock history.</p>}
        {selectedId && movementError && <p className="px-4 pb-4 text-sm text-red-600">{movementError}</p>}

        {selectedId && !movementError && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Change</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {loadingMovements && <tr><td colSpan={7}>Loading...</td></tr>}
                {!loadingMovements && movements.length === 0 && <tr><td colSpan={7}>This product has no stock changes.</td></tr>}
                {!loadingMovements && movements.map((movement) => (
                  <tr key={movement._id}>
                    <td>{formatDateTime(movement.createdAt)}</td>
                    <td>{MOVEMENT_LABEL[movement.type] ?? movement.type}</td>
                    <td>
                      <strong className={movement.change > 0 ? 'text-green-700' : 'text-red-600'}>
                        {movement.change > 0 ? `+${movement.change}` : movement.change}
                      </strong>
                    </td>
                    <td>{movement.previousStock}</td>
                    <td>{movement.resultingStock}</td>
                    <td>{movement.reason || '—'}</td>
                    <td>{movement.createdBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {adjusting && (
        <AdjustModal
          initialProduct={selectedProduct}
          onClose={() => setAdjusting(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
