'use client'
import { rowAction } from '@/components/ui/row-action'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type ProductRow = {
  _id: string
  name: string
  sku: string
  currentStock: number
  minStockLevel: number
  unit: string
  isActive: boolean
}

type ProductsResponse = { success: boolean; total: number; data: ProductRow[] }

type Movement = {
  _id: string
  type: string
  change: number
  previousStock: number
  resultingStock: number
  reason: string
  createdAt: string
  createdBy?: { name?: string } | null
}

type MovementsResponse = { success: boolean; count: number; data: Movement[] }

type AdjustType = 'OPENING_STOCK' | 'PURCHASE' | 'CUSTOMER_RETURN' | 'SALE' | 'SUPPLIER_RETURN' | 'DAMAGED'

const ADJUST_TYPES: { value: AdjustType; label: string; increase: boolean }[] = [
  { value: 'OPENING_STOCK', label: 'শুরুর স্টক', increase: true },
  { value: 'PURCHASE', label: 'ক্রয় (ম্যানুয়াল)', increase: true },
  { value: 'CUSTOMER_RETURN', label: 'গ্রাহকের ফেরত', increase: true },
  { value: 'SALE', label: 'বিক্রি (ম্যানুয়াল)', increase: false },
  { value: 'SUPPLIER_RETURN', label: 'সরবরাহকারীকে ফেরত', increase: false },
  { value: 'DAMAGED', label: 'নষ্ট / ক্ষতি', increase: false },
]

const MOVEMENT_LABEL: Record<string, string> = {
  OPENING_STOCK: 'শুরুর স্টক',
  PURCHASE: 'ক্রয়',
  CUSTOMER_RETURN: 'গ্রাহকের ফেরত',
  SALE: 'বিক্রি',
  SUPPLIER_RETURN: 'সরবরাহকারীকে ফেরত',
  DAMAGED: 'নষ্ট / ক্ষতি',
  ADJUSTMENT: 'সমন্বয়',
}

type StockState = 'OK' | 'LOW' | 'OUT'

const STATE_LABEL: Record<StockState, string> = {
  OK: 'স্বাভাবিক',
  LOW: 'কম স্টক',
  OUT: 'শেষ',
}

const STATE_CLASS: Record<StockState, string> = {
  OK: 'in-stock',
  LOW: 'low-stock',
  OUT: 'out-of-stock',
}

function stockStateOf(product: ProductRow): StockState {
  if (product.currentStock <= 0) return 'OUT'
  if (product.currentStock <= product.minStockLevel) return 'LOW'
  return 'OK'
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

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
      setProductError(err instanceof ApiError ? err.message : 'পণ্যের তালিকা আনা যায়নি।')
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
      setMovementError(err instanceof ApiError ? err.message : 'স্টক ইতিহাস আনা যায়নি।')
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
          <h1>ইনভেন্টরি</h1>
          <p className="subheading">পণ্যের বর্তমান স্টক, সতর্কতা ও স্টক পরিবর্তনের ইতিহাস।</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={() => setAdjusting(true)}>
            <Plus /> স্টক সমন্বয়
          </button>
        )}
      </div>

      <div className="section-stat-row">
        <div className="small-stat">
          <span>সক্রিয় পণ্য</span>
          <strong>{products.length}</strong>
          <small>মোট তালিকাভুক্ত</small>
        </div>
        <div className="small-stat">
          <span>কম স্টক</span>
          <strong>{lowCount}</strong>
          <small>সর্বনিম্নের নিচে বা সমান</small>
        </div>
        <div className="small-stat">
          <span>স্টক শেষ</span>
          <strong>{outCount}</strong>
          <small>এখন শূন্য</small>
        </div>
      </div>

      {notice && <p className="px-1 text-sm text-green-700">{notice}</p>}

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>স্টক তালিকা</h2>
            <span>{visibleProducts.length} টি</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="নাম বা SKU খুঁজুন..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className={inputClass + ' max-w-[10rem] bg-white'} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="">সব অবস্থা</option>
              <option value="OK">স্বাভাবিক</option>
              <option value="LOW">কম স্টক</option>
              <option value="OUT">স্টক শেষ</option>
            </select>
          </div>
        </div>

        {productError && <p className="px-4 pb-2 text-sm text-red-600">{productError}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>পণ্য</th>
                <th>SKU</th>
                <th>বর্তমান স্টক</th>
                <th>সর্বনিম্ন</th>
                <th>অবস্থা</th>
                <th>কাজ</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts && <tr><td colSpan={6}>লোড হচ্ছে...</td></tr>}
              {!loadingProducts && visibleProducts.length === 0 && <tr><td colSpan={6}>কোনো পণ্য পাওয়া যায়নি।</td></tr>}
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
                    <td><span className={`status ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span></td>
                    <td>
                      <button
                        className={rowAction.history}
                        onClick={() => setSelectedId(product._id)}
                      >
                        ইতিহাস
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
            <h2>স্টক ইতিহাস</h2>
            {selectedProduct && <span>{selectedProduct.name}</span>}
          </div>
          <div className="toolbar-actions">
            <select className={inputClass + ' max-w-xs bg-white'} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">পণ্য বেছে নিন</option>
              {products.map((product) => <option key={product._id} value={product._id}>{product.name} ({product.sku})</option>)}
            </select>
          </div>
        </div>

        {!selectedId && <p className="px-4 pb-4 text-sm text-gray-500">ইতিহাস দেখতে উপরের তালিকা থেকে একটি পণ্য বেছে নিন।</p>}
        {selectedId && movementError && <p className="px-4 pb-4 text-sm text-red-600">{movementError}</p>}

        {selectedId && !movementError && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>তারিখ</th>
                  <th>ধরন</th>
                  <th>পরিবর্তন</th>
                  <th>আগে</th>
                  <th>পরে</th>
                  <th>কারণ</th>
                  <th>করেছেন</th>
                </tr>
              </thead>
              <tbody>
                {loadingMovements && <tr><td colSpan={7}>লোড হচ্ছে...</td></tr>}
                {!loadingMovements && movements.length === 0 && <tr><td colSpan={7}>এই পণ্যের কোনো স্টক পরিবর্তন নেই।</td></tr>}
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

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AdjustModal({
  products,
  initialProductId,
  onClose,
  onSaved,
}: {
  products: ProductRow[]
  initialProductId: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [productId, setProductId] = useState(initialProductId)
  const [type, setType] = useState<AdjustType>('DAMAGED')
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const product = products.find((item) => item._id === productId)
  const meta = ADJUST_TYPES.find((item) => item.value === type)
  const qty = Number(quantity)
  const validQty = Number.isInteger(qty) && qty > 0
  const preview =
    product && meta && validQty
      ? product.currentStock + (meta.increase ? qty : -qty)
      : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!productId) {
      setFormError('পণ্য বেছে নিন।')
      return
    }
    if (!validQty) {
      setFormError('পরিমাণ ১ বা তার বেশি পূর্ণ সংখ্যা হতে হবে।')
      return
    }
    if (product && meta && !meta.increase && qty > product.currentStock) {
      setFormError(`বর্তমান স্টক ${product.currentStock}। এর চেয়ে বেশি কমানো যাবে না।`)
      return
    }

    setSaving(true)
    try {
      const response = await apiRequest<{ data: { product: { name: string; currentStock: number } } }>(
        '/inventory/adjustments',
        {
          method: 'POST',
          body: { productId, type, quantity: qty, reason: reason.trim() },
        }
      )
      const updated = response.data.product
      onSaved(`${updated.name}-এর নতুন স্টক: ${updated.currentStock}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormError('স্টক যথেষ্ট নেই।')
      } else {
        setFormError(err instanceof ApiError ? err.message : 'স্টক সমন্বয় করা যায়নি। আবার চেষ্টা করুন।')
      }
      setSaving(false)
    }
  }

  return (
    <ModalShell title="স্টক সমন্বয়" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">পণ্য *</span>
          <select className={inputClass + ' bg-white'} value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">বেছে নিন</option>
            {products.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.sku})</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">ধরন *</span>
          <select className={inputClass + ' bg-white'} value={type} onChange={(event) => setType(event.target.value as AdjustType)}>
            {ADJUST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {type === 'PURCHASE' && (
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
            সরবরাহকারী থেকে ক্রয়ের জন্য সাধারণত Purchases পাতা ব্যবহার করুন। এখানে শুধু হিসাব সমন্বয় করা হয়।
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">পরিমাণ *</span>
            <input type="number" min="1" step="1" className={inputClass} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">কারণ (ঐচ্ছিক)</span>
            <input className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>

        {product && (
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>বর্তমান স্টক</span>
              <strong>{product.currentStock} {product.unit}</strong>
            </div>
            <div className="flex justify-between">
              <span>সমন্বয়ের পর</span>
              <strong className={preview !== null && preview < 0 ? 'text-red-600' : ''}>
                {preview ?? '—'} {product.unit}
              </strong>
            </div>
          </div>
        )}

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সমন্বয় করুন'}
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
