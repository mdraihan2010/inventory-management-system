'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Pencil, Plus, Power, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'
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

const numberFormat = new Intl.NumberFormat('en-IN')

function taka(value: number): string {
  return `৳ ${numberFormat.format(value)}`
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

  // খোঁজার লেখা লেখা শেষ হওয়ার ৩০০ মিলিসেকেন্ড পরে অনুসন্ধান শুরু হয়
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
      setError(err instanceof ApiError ? err.message : 'পণ্যের তালিকা আনা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, categoryId, brandId, activeFilter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function toggleActive(product: Product) {
    const action = product.isActive ? 'বন্ধ' : 'চালু'
    if (!window.confirm(`"${product.name}" পণ্যটি ${action} করতে চান?`)) return

    setError('')
    setNotice('')
    try {
      await apiRequest(`/products/${product._id}`, {
        method: 'PATCH',
        body: { isActive: !product.isActive },
      })
      setNotice(`পণ্যটি ${action} করা হয়েছে।`)
      loadProducts()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'পরিবর্তন সংরক্ষণ করা যায়নি।')
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
          <h1>পণ্য</h1>
          <p className="subheading">সব পণ্যের তালিকা, খোঁজা ও ব্যবস্থাপনা।</p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={() => setModal({ product: null })}>
            <Plus /> নতুন পণ্য
          </button>
        )}
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-title">
            <h2>পণ্যের তালিকা</h2>
            <span>মোট {total} টি</span>
          </div>
          <div className="toolbar-actions">
            <input
              className={inputClass + ' max-w-xs'}
              placeholder="নাম, SKU বা বারকোড খুঁজুন..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={categoryId}
              onChange={(event) => { setCategoryId(event.target.value); setPage(1) }}
            >
              <option value="">সব ক্যাটাগরি</option>
              {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
            </select>
            <select
              className={inputClass + ' max-w-[10rem] bg-white'}
              value={brandId}
              onChange={(event) => { setBrandId(event.target.value); setPage(1) }}
            >
              <option value="">সব ব্র্যান্ড</option>
              {brands.map((brand) => <option key={brand._id} value={brand._id}>{brand.name}</option>)}
            </select>
            <select
              className={inputClass + ' max-w-[9rem] bg-white'}
              value={activeFilter}
              onChange={(event) => { setActiveFilter(event.target.value); setPage(1) }}
            >
              <option value="">সব অবস্থা</option>
              <option value="true">সক্রিয়</option>
              <option value="false">বন্ধ</option>
            </select>
          </div>
        </div>

        {notice && <p className="px-4 pb-2 text-sm text-green-700">{notice}</p>}
        {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>পণ্য</th>
                <th>ক্যাটাগরি</th>
                <th>ব্র্যান্ড</th>
                <th>স্টক</th>
                <th>ক্রয়মূল্য</th>
                <th>বিক্রয়মূল্য</th>
                <th>অবস্থা</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={canManage ? 8 : 7}>লোড হচ্ছে...</td></tr>
              )}
              {!loading && products.length === 0 && (
                <tr><td colSpan={canManage ? 8 : 7}>কোনো পণ্য পাওয়া যায়নি।</td></tr>
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
                  <td>{taka(product.purchasePrice)}</td>
                  <td>{taka(product.sellingPrice)}</td>
                  <td>
                    <span className={`status ${product.isActive ? 'in-stock' : 'out-of-stock'}`}>
                      {product.isActive ? 'সক্রিয়' : 'বন্ধ'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex gap-2">
                        <button className="rounded-md p-1.5 text-indigo-600 transition hover:bg-indigo-50" title="সম্পাদনা" aria-label={`Edit ${product.name}`} onClick={() => setModal({ product })}>
                          <Pencil />
                        </button>
                        <button
                          className={product.isActive ? 'rounded-md p-1.5 text-red-600 transition hover:bg-red-50' : 'rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50'}
                          title={product.isActive ? 'বন্ধ করুন' : 'চালু করুন'}
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
      </section>

      {modal && (
        <ProductModal
          product={modal.product}
          categories={categories}
          brands={brands}
          onClose={() => setModal(null)}
          onSaved={() => handleSaved(modal.product ? 'পণ্য হালনাগাদ করা হয়েছে।' : 'নতুন পণ্য যোগ করা হয়েছে।')}
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
      setFormError('পণ্যের নাম ও SKU লিখুন।')
      return
    }
    if (!form.category || !form.brand) {
      setFormError('ক্যাটাগরি ও ব্র্যান্ড বেছে নিন।')
      return
    }

    const sellingPrice = Number(form.sellingPrice)
    if (form.sellingPrice.trim() === '' || Number.isNaN(sellingPrice) || sellingPrice < 0) {
      setFormError('বিক্রয়মূল্য সঠিকভাবে লিখুন।')
      return
    }

    const purchasePrice = Number(form.purchasePrice || 0)
    if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
      setFormError('ক্রয়মূল্য সঠিকভাবে লিখুন।')
      return
    }

    const minStockLevel = Number(form.minStockLevel || 0)
    if (Number.isNaN(minStockLevel) || minStockLevel < 0) {
      setFormError('সর্বনিম্ন স্টক সঠিকভাবে লিখুন।')
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
      setFormError(err instanceof ApiError ? err.message : 'সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।')
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
          <h2 className="text-lg font-semibold text-gray-900">{product ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যোগ'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500">
            <X />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="পণ্যের নাম *">
            <input className={inputClass} value={form.name} onChange={setField('name')} />
          </Field>
          <Field label="SKU *">
            <input className={inputClass} value={form.sku} onChange={setField('sku')} />
          </Field>
          <Field label="ক্যাটাগরি *">
            <select className={inputClass + ' bg-white'} value={form.category} onChange={setField('category')}>
              <option value="">বেছে নিন</option>
              {categories
                .filter((item) => item.isActive || item._id === form.category)
                .map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="ব্র্যান্ড *">
            <select className={inputClass + ' bg-white'} value={form.brand} onChange={setField('brand')}>
              <option value="">বেছে নিন</option>
              {brands
                .filter((item) => item.isActive || item._id === form.brand)
                .map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="ক্রয়মূল্য (৳)">
            <input type="number" min="0" className={inputClass} value={form.purchasePrice} onChange={setField('purchasePrice')} />
          </Field>
          <Field label="বিক্রয়মূল্য (৳) *">
            <input type="number" min="0" className={inputClass} value={form.sellingPrice} onChange={setField('sellingPrice')} />
          </Field>
          <Field label="সর্বনিম্ন স্টক">
            <input type="number" min="0" className={inputClass} value={form.minStockLevel} onChange={setField('minStockLevel')} />
          </Field>
          <Field label="একক">
            <input className={inputClass} value={form.unit} onChange={setField('unit')} placeholder="pcs, kg, box" />
          </Field>
          <Field label="বারকোড (ঐচ্ছিক)">
            <input className={inputClass} value={form.barcode} onChange={setField('barcode')} />
          </Field>
          <Field label="বিবরণ (ঐচ্ছিক)">
            <textarea className={inputClass} rows={2} value={form.description} onChange={setField('description')} />
          </Field>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">
            বাতিল
          </button>
          <Button type="submit" disabled={saving}>
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
          </Button>
        </div>
      </form>
    </div>
  )
}
