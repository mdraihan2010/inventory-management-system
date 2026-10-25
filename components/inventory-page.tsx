'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
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

type ProductsResponse = { success: boolean; total: number; data: ProductRow[] }
type MovementsResponse = { success: boolean; count: number; data: Movement[] }

export function InventoryPage({ canManage }: { canManage: boolean }) {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productError, setProductError] = useState('')
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [movements, setMovements] = useState<Movement[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [movementError, setMovementError] = useState('')
  const [notice, setNotice] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    setProductError('')
    try {
      const response = await apiRequest<ProductsResponse>('/products?isActive=true&limit=100')
      setProducts(response.data)
    } catch (err) {
      setProductError(err instanceof ApiError ? err.message : 'Could not load the product list.')
    } finally {
      setLoadingProducts(false)
    }
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
    if (selectedId) {
      loadMovements(selectedId)
    } else {
      setMovements([])
    }
  }, [selectedId, loadMovements])

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      const matchesText = !query || `${product.name} ${product.sku}`.toLowerCase().includes(query)
      const matchesState = !stateFilter || stockStateOf(product) === stateFilter
      return matchesText && matchesState
    })
  }, [products, search, stateFilter])

  const lowCount = products.filter((product) => stockStateOf(product) === 'LOW').length
  const outCount = products.filter((product) => stockStateOf(product) === 'OUT').length
  const selectedProduct = products.find((product) => product._id === selectedId)

  function handleSaved(message: string) {
    setAdjusting(false)
    setNotice(message)
    loadProducts()
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
          <strong>{products.length}</strong>
          <small>Total listed</small>
        </div>
        <div className="small-stat">
          <span>Low stock</span>
          <strong>{lowCount}</strong>
          <small>At or below the minimum</small>
        </div>
        <div className="small-stat">
          <span>Out of stock</span>
          <strong>{outCount}</strong>
          <small>Currently zero</small>
        </div>
      </div>

      {notice && <p className="px-1 text-sm text-green-700">{notice}</p>}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Stock list</h2>
            <span>{visibleProducts.length} items</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className={inputClass + ' max-w-[10rem] bg-white'} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
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
              {!loadingProducts && visibleProducts.length === 0 && <tr><td colSpan={6}>No products found.</td></tr>}
              {!loadingProducts && visibleProducts.map((product) => {
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
                      <button className={rowAction.history} onClick={() => setSelectedId(product._id)}>
                        History
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Stock history</h2>
            {selectedProduct && <span>{selectedProduct.name}</span>}
          </div>
          <div className="toolbar-actions">
            <select className={inputClass + ' max-w-xs bg-white'} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Select a product</option>
              {products.map((product) => <option key={product._id} value={product._id}>{product.name} ({product.sku})</option>)}
            </select>
          </div>
        </div>

        {!selectedId && <p className="px-4 pb-4 text-sm text-gray-500">Select a product from the list above to view its history.</p>}
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
          products={products}
          initialProductId={selectedId}
          onClose={() => setAdjusting(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
