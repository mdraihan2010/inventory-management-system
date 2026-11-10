'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { ApiError, apiRequest } from '@/lib/api'

// The fields every picked product has. Pages can ask for more fields with the type parameter
export type PickableProduct = {
  _id: string
  name: string
  sku: string
  currentStock: number
  unit: string
}

type SearchResponse<T> = { success: boolean; total: number; data: T[] }

// How many matches are shown, and how long to wait after typing before searching
const RESULT_LIMIT = 20
const DEBOUNCE_MS = 300

/**
 * A search box for choosing one product. It asks the server for matching products
 * (by name, SKU or barcode), so it works the same with 10 products or 10,000.
 */
export function ProductPicker<T extends PickableProduct>({
  value,
  onChange,
  placeholder = 'Search product by name or SKU...',
  activeOnly = true,
}: {
  value: T | null
  onChange: (product: T | null) => void
  placeholder?: string
  activeOnly?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Search while the list is open. Only the answer to the latest request is used
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({ limit: String(RESULT_LIMIT) })
      if (activeOnly) params.set('isActive', 'true')
      if (query.trim()) params.set('search', query.trim())
      try {
        const response = await apiRequest<SearchResponse<T>>(`/products?${params.toString()}`)
        if (cancelled) return
        setResults(response.data)
        setTotal(response.total)
        setHighlight(0)
      } catch (err) {
        if (cancelled) return
        setResults([])
        setError(err instanceof ApiError ? err.message : 'Could not search products.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open, activeOnly])

  // Close the list when the user clicks somewhere else
  useEffect(() => {
    if (!open) return
    function handleClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function choose(product: T) {
    onChange(product)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlight((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      if (open && results[highlight]) {
        event.preventDefault()
        choose(results[highlight])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-gray-900'

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={inputClass}
        placeholder={value ? '' : placeholder}
        value={open ? query : value ? `${value.name} (${value.sku})` : ''}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
      />
      {value && !open && (
        <button
          type="button"
          aria-label="Clear product"
          onClick={() => onChange(null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {loading && results.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">Searching...</p>}
          {error && <p className="px-3 py-2 text-sm text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">No product matches “{query.trim()}”.</p>
          )}
          {results.map((product, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === highlight}
              key={product._id}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(product)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                index === highlight ? 'bg-blue-50' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block break-words font-medium leading-snug text-gray-900">{product.name}</span>
                <span className="block text-xs text-gray-500">{product.sku}</span>
              </span>
              <span className={`shrink-0 text-xs ${product.currentStock > 0 ? 'text-gray-500' : 'text-red-600'}`}>
                {product.currentStock} {product.unit}
              </span>
            </button>
          ))}
          {total > results.length && (
            <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
              Showing {results.length} of {total}. Type more of the name or SKU to narrow the list.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
