export type ProductRow = {
  _id: string
  name: string
  sku: string
  currentStock: number
  minStockLevel: number
  unit: string
  isActive: boolean
}

export type Movement = {
  _id: string
  type: string
  change: number
  previousStock: number
  resultingStock: number
  reason: string
  createdAt: string
  createdBy?: { name?: string } | null
}

export type AdjustType = 'OPENING_STOCK' | 'PURCHASE' | 'CUSTOMER_RETURN' | 'SALE' | 'SUPPLIER_RETURN' | 'DAMAGED'

export const ADJUST_TYPES: { value: AdjustType; label: string; increase: boolean }[] = [
  { value: 'OPENING_STOCK', label: 'Opening stock', increase: true },
  { value: 'PURCHASE', label: 'Purchase (manual)', increase: true },
  { value: 'CUSTOMER_RETURN', label: 'Customer return', increase: true },
  { value: 'SALE', label: 'Sale (manual)', increase: false },
  { value: 'SUPPLIER_RETURN', label: 'Return to supplier', increase: false },
  { value: 'DAMAGED', label: 'Damaged / lost', increase: false },
]

export const MOVEMENT_LABEL: Record<string, string> = {
  OPENING_STOCK: 'Opening stock',
  PURCHASE: 'Purchase',
  CUSTOMER_RETURN: 'Customer return',
  SALE: 'Sale',
  SUPPLIER_RETURN: 'Return to supplier',
  DAMAGED: 'Damaged / lost',
  ADJUSTMENT: 'Adjustment',
}

export type StockState = 'OK' | 'LOW' | 'OUT'

export const STATE_LABEL: Record<StockState, string> = {
  OK: 'Healthy',
  LOW: 'Low stock',
  OUT: 'Out of stock',
}

export const STATE_CLASS: Record<StockState, string> = {
  OK: 'in-stock',
  LOW: 'low-stock',
  OUT: 'out-of-stock',
}

export function stockStateOf(product: ProductRow): StockState {
  if (product.currentStock <= 0) return 'OUT'
  if (product.currentStock <= product.minStockLevel) return 'LOW'
  return 'OK'
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'
