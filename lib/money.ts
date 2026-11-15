// One place for money display. The app uses the Bangladeshi taka sign: ৳630,000
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `৳${numberFormat.format(value)}`
}
