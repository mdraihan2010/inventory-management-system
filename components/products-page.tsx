'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Pencil, Plus, Power, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { Button } from '@/components/ui/button'

type Ref = { _id: string; name: string; isActive: boolean }

type Product = {
  _id: string
  name: string
  sku: string
  barcode: string | null
  description: string
  category: { _id: string; name: string } | null
  brand: { _id: string; name: string } | null
  purchasePrice: number
  sellingPrice: number
  currentStock: number
  minStockLevel: number
  unit: string
  isActive: boolean
}

type ProductsResponse = {
  success: boolean
  total: number
  page: number
  totalPages: number
  data: Product[]
}

type RefsResponse = { success: boolean; data: Ref[] }

type FormState = {
  name: string
  sku: string
  barcode: string
  description: string
  category: string
  brand: string
  purchasePrice: string
  sellingPrice: string
  minStockLevel: string
  unit: string
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  barcode: '',
  description: '',
  category: '',
  brand: '',
  purchasePrice: '',
  sellingPrice: '',
  minStockLevel: '',
  unit: 'pcs',
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function ProductsPage({ canManage }: { canManage: boolean }) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [categories, setCategories] = useState<Ref[]>([])
  const [brands, setBrands] = useState<Ref[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<{ product: Product | null } | null>(null)

  // Start searching 300 milliseconds after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    apiRequest<RefsResponse>('/categories')
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]))
    apiRequest<RefsResponse>('/brands')
      .then((response) => setBrands(response.data))
      .catch(() => setBrands([]))
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
    if (categoryId) params.set('category', categoryId)
    if (brandId) params.set('brand', brandId)
    if (activeFilter) params.set('isActive', activeFilter)

    try {
      const response = await apiRequest<ProductsResponse>(`/products?${params.toString()}`)
      setProducts(response.data)
      setTotal(response.total)
      setTotalPages(Math.max(response.totalPages, 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the product list.')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, categoryId, brandId, activeFilter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function toggleActive(product: Product) {
    const action = product.isActive ? 'deactivate' : 'activate'
    if (!window.confirm(`Are you sure you want to ${action} "${product.name}"?`)) return

    setError('')
    setNotice('')
    try {
      await apiRequest(`/products/${product._id}`, {
        method: 'PATCH',
        body: { isActive: !product.isActive },
      })
      setNotice(product.isActive ? 'Product deactivated.' : 'Product activated.')
      loadProducts()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the change.')
    }
  }

  function handleSaved(message: string) {
    setModal(null)
    setNotice(message)
    loadProducts()
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace / Products</p>
          <h1>Products</h1>
          <p className="subheading">View, search and manage all products.</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={() => setModal({ product: null })}>
            <Plus /> New product
          </button>
        )}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>Product list</h2>
            <span>Total {total}</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="Search by name, SKU or barcode..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={categoryId}
              onChange={(event) => { setCategoryId(event.target.value); setPage(1) }}
            >
              <option value="">All categories</option>
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </select>
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={brandId}
              onChange={(event) => { setBrandId(event.target.value); setPage(1) }}
            >
              <option value="">All brands</option>
              {brands.map((brand) => <option key={brand._id} value={brand._id}>{brand.name}</option>)}
            </select>
            <select
              className={inputClass + ' max-w-[9rem] bg-white'}
              value={activeFilter}
              onChange={(event) => { setActiveFilter(event.target.value); setPage(1) }}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Stock</th>
                <th>Purchase price</th>
                <th>Selling price</th>
                <th>Status</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={canManage ? 8 : 7}>Loading...</td></tr>
              )}
              {!loading && products.length === 0 && (
                <tr><td colSpan={canManage ? 8 : 7}>No products found.</td></tr>
              )}
              {!loading && products.map((product) => (
                <tr key={product._id}>
                  <td><strong>{product.name}</strong><br /><span>{product.sku}</span></td>
                  <td>{product.category?.name ?? '—'}</td>
                  <td>{product.brand?.name ?? '—'}</td>
                  <td>
                    <strong className={product.currentStock <= product.minStockLevel ? 'stock-low' : ''}>
                      {product.currentStock}
                    </strong>{' '}
                    {product.unit}
                  </td>
                  <td>{formatMoney(product.purchasePrice)}</td>
                  <td>{formatMoney(product.sellingPrice)}</td>
                  <td>
                    <span className={`status ${product.isActive ? 'in-stock' : 'out-of-stock'}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex gap-2">
                        <button className="rounded-md p-1.5 text-indigo-600 transition hover:bg-indigo-50" title="Edit" aria-label={`Edit ${product.name}`} onClick={() => setModal({ product })}>
                          <Pencil />
                        </button>
                        <button
                          className={product.isActive ? 'rounded-md p-1.5 text-red-600 transition hover:bg-red-50' : 'rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50'}
                          title={product.isActive ? 'Deactivate' : 'Activate'}
                          aria-label={`Toggle ${product.name}`}
                          onClick={() => toggleActive(product)}
                        >
                          <Power />
                        </button>
                      </div>
                    </td>
                  )}
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
      </section>

      {modal && (
        <ProductModal
          product={modal.product}
          categories={categories}
          brands={brands}
          onClose={() => setModal(null)}
          onSaved={() => handleSaved(modal.product ? 'Product updated.' : 'New product added.')}
        />
      )}
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}

function ProductModal({
  product,
  categories,
  brands,
  onClose,
  onSaved,
}: {
  product: Product | null
  categories: Ref[]
  brands: Ref[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? '',
          description: product.description ?? '',
          category: product.category?._id ?? '',
          brand: product.brand?._id ?? '',
          purchasePrice: String(product.purchasePrice),
          sellingPrice: String(product.sellingPrice),
          minStockLevel: String(product.minStockLevel),
          unit: product.unit,
        }
      : EMPTY_FORM
  )
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function setField(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setForm((previous) => ({ ...previous, [field]: value }))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')

    if (!form.name.trim() || !form.sku.trim()) {
      setFormError('Enter the product name and SKU.')
      return
    }
    if (!form.category || !form.brand) {
      setFormError('Select a category and a brand.')
      return
    }

    const sellingPrice = Number(form.sellingPrice)
    if (form.sellingPrice.trim() === '' || Number.isNaN(sellingPrice) || sellingPrice < 0) {
      setFormError('Enter a valid selling price.')
      return
    }

    const purchasePrice = Number(form.purchasePrice || 0)
    if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
      setFormError('Enter a valid purchase price.')
      return
    }

    const minStockLevel = Number(form.minStockLevel || 0)
    if (Number.isNaN(minStockLevel) || minStockLevel < 0) {
      setFormError('Enter a valid minimum stock level.')
      return
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      description: form.description.trim(),
      category: form.category,
      brand: form.brand,
      purchasePrice,
      sellingPrice,
      minStockLevel,
      unit: form.unit.trim() || 'pcs',
    }

    setSaving(true)
    try {
      if (product) {
        await apiRequest(`/products/${product._id}`, { method: 'PATCH', body: payload })
      } else {
        await apiRequest('/products', { method: 'POST', body: payload })
      }
      onSaved()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{product ? 'Edit product' : 'Add new product'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Product name *">
            <input className={inputClass} value={form.name} onChange={setField('name')} />
          </Field>
          <Field label="SKU *">
            <input className={inputClass} value={form.sku} onChange={setField('sku')} />
          </Field>
          <Field label="Category *">
            <select className={inputClass + ' bg-white'} value={form.category} onChange={setField('category')}>
              <option value="">Select</option>
              {categories
                .filter((item) => item.isActive || item._id === form.category)
                .map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Brand *">
            <select className={inputClass + ' bg-white'} value={form.brand} onChange={setField('brand')}>
              <option value="">Select</option>
              {brands
                .filter((item) => item.isActive || item._id === form.brand)
                .map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Purchase price ($)">
            <input type="number" min="0" className={inputClass} value={form.purchasePrice} onChange={setField('purchasePrice')} />
          </Field>
          <Field label="Selling price ($) *">
            <input type="number" min="0" className={inputClass} value={form.sellingPrice} onChange={setField('sellingPrice')} />
          </Field>
          <Field label="Minimum stock">
            <input type="number" min="0" className={inputClass} value={form.minStockLevel} onChange={setField('minStockLevel')} />
          </Field>
          <Field label="Unit">
            <input className={inputClass} value={form.unit} onChange={setField('unit')} placeholder="pcs, kg, box" />
          </Field>
          <Field label="Barcode (optional)">
            <input className={inputClass} value={form.barcode} onChange={setField('barcode')} />
          </Field>
          <Field label="Description (optional)">
            <textarea className={inputClass} rows={2} value={form.description} onChange={setField('description')} />
          </Field>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
