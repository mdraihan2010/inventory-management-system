export type PurchaseStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

export type SupplierRef = { _id: string; name: string; isActive?: boolean }

export type ProductRef = {
  _id: string
  name: string
  sku: string
  purchasePrice: number
  currentStock: number
  unit: string
}

export type PurchaseRow = {
  _id: string
  purchaseNumber: string
  supplier: string | { _id: string; name?: string } | null
  grandTotal: number
  status: PurchaseStatus
  purchaseDate?: string
}

export type PurchaseItem = {
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type PurchaseDetail = PurchaseRow & {
  items: PurchaseItem[]
  subtotal: number
  discount: number
  paidAmount: number
  notes?: string
}

export const STATUS_LABEL: Record<PurchaseStatus, string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const STATUS_CLASS: Record<PurchaseStatus, string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

export const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}
