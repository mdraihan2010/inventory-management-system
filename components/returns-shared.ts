import { ApiError } from '@/lib/api'

export type ReturnKind = 'CUSTOMER' | 'SUPPLIER'

export type ReturnRow = {
  _id: string
  returnNumber: string
  kind: ReturnKind
  sale: { _id: string; saleNumber: string } | null
  purchase: { _id: string; purchaseNumber: string } | null
  customer: { _id: string; name: string } | null
  supplier: { _id: string; name: string; companyName?: string } | null
  items: { productName: string; sku: string; quantity: number; lineTotal: number }[]
  totalValue: number
  creditApplied: number
  cashRefund: number
  refundMethod: string | null
  reason: string
  createdAt: string
}

export type SaleSource = {
  _id: string
  saleNumber: string
  grandTotal: number
  outstandingAmount: number
  status: string
  saleDate: string
  customer: { name: string } | null
}

export type PurchaseSource = {
  _id: string
  purchaseNumber: string
  grandTotal: number
  status: string
  purchaseDate?: string
  supplier: string | { _id: string; name?: string } | null
}

// Sales and purchases are shown in the same shape
export type Source = {
  _id: string
  number: string
  total: number
  outstanding: number
  date?: string
  party: string
}

export type ReturnableRaw = {
  productId: string
  productName: string
  sku: string
  unitPrice: number
  remaining: number
  soldQuantity?: number
  purchasedQuantity?: number
  returnedQuantity: number
}

export type ReturnableItem = {
  productId: string
  productName: string
  sku: string
  unitPrice: number
  remaining: number
  totalQuantity: number
}

export const KIND_LABEL: Record<ReturnKind, string> = {
  CUSTOMER: 'Customer return',
  SUPPLIER: 'Return to supplier',
}

export const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MOBILE_BANKING: 'Mobile banking',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
}

export const REFUND_METHODS = ['CASH', 'MOBILE_BANKING', 'CARD', 'BANK_TRANSFER']

export const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

export function sourceFromSale(sale: SaleSource): Source {
  return {
    _id: sale._id,
    number: sale.saleNumber,
    total: sale.grandTotal,
    outstanding: sale.outstandingAmount,
    date: sale.saleDate,
    party: sale.customer?.name ?? 'Walk-in customer',
  }
}

export function sourceFromPurchase(purchase: PurchaseSource): Source {
  const party =
    purchase.supplier && typeof purchase.supplier === 'object' ? purchase.supplier.name ?? '—' : '—'
  return {
    _id: purchase._id,
    number: purchase.purchaseNumber,
    total: purchase.grandTotal,
    outstanding: 0,
    date: purchase.purchaseDate,
    party,
  }
}

export function partyLabel(row: ReturnRow): string {
  if (row.kind === 'CUSTOMER') return row.customer?.name ?? 'Walk-in customer'
  if (row.supplier) return row.supplier.companyName || row.supplier.name
  return '—'
}
