type Cell = string | number | null | undefined

function cell(value: Cell): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)

  // Excel would run text that starts with = + - @ as a formula, so a quote is added in front
  const text = /^[=+\-@]/.test(value) ? `'${value}` : value

  // Values with a comma, quote or line break are wrapped in quotes, and inner quotes are doubled
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Turns a header row and data rows into CSV text
export function toCsv(headers: string[], rows: Cell[][]): string {
  const all: Cell[][] = [headers, ...rows]
  return all.map((row) => row.map(cell).join(',')).join('\r\n')
}

// Local calendar date as YYYY-MM-DD (not UTC, so a Dhaka morning sale keeps its own day)
export function toLocalDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayStamp(): string {
  return toLocalDate(new Date().toISOString())
}

// Starts a file download in the browser. The UTF-8 BOM makes Excel read the file as UTF-8
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
