export type Ref = { _id: string; name: string; isActive?: boolean }

export type Product = {
  _id: string
  name: string
  sku: string
  sellingPrice: number
  currentStock: number
  unit: string
}

export type PaymentMethod = 'CASH' | 'MOBILE_BANKING' | 'CARD' | 'BANK_TRANSFER'
export type SaleStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'

export type SaleItem = {
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  lineTotal: number
  costPrice: number | null
}

export type Sale = {
  _id: string
  saleNumber: string
  customer: { _id: string; name: string; phone?: string } | null
  items: SaleItem[]
  subtotal: number
  discount: number
  grandTotal: number
  paidAmount: number
  outstandingAmount: number
  paymentStatus: PaymentStatus
  status: SaleStatus
  saleDate: string
  notes: string
}

export type Payment = {
  _id: string
  amount: number
  method: PaymentMethod
  reference: string
  createdAt: string
}

export const STATUS_LABEL: Record<SaleStatus, string> = {
  DRAFT: 'Draft',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const STATUS_CLASS: Record<SaleStatus, string> = {
  DRAFT: 'pending',
  COMPLETED: 'in-stock',
  CANCELLED: 'out-of-stock',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partly paid',
  UNPAID: 'Unpaid',
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  MOBILE_BANKING: 'Mobile banking',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
}

export const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900'

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB')
}
