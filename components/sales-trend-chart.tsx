'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/money'

export type TrendPoint = { date: string; total: number | null }

// Chart geometry, in SVG units. The SVG scales to the panel width
const WIDTH = 700
const HEIGHT = 250
const PAD = { left: 64, right: 12, top: 28, bottom: 30 }
const BAR_WIDTH = 24

// Rounds the largest value up to a clean number (1, 2, 5 or 10 times a power of ten)
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = Math.pow(10, Math.floor(Math.log10(value)))
  const scaled = value / power
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * power
}

// Dates arrive as YYYY-MM-DD. They are built as local dates so no time zone shifts the day
function shortDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

function barPath(x: number, top: number, width: number, height: number, baseY: number): string {
  const r = Math.min(4, width / 2, height)
  return [
    `M${x},${baseY}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + width - r},${top}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `L${x + width},${baseY}`,
    'Z',
  ].join(' ')
}

export function SalesTrendChart({ points, loading }: { points: TrendPoint[]; loading: boolean }) {
  const [active, setActive] = useState<number | null>(null)

  if (points.length === 0) {
    return <p className="subheading">{loading ? 'Loading...' : 'No data available'}</p>
  }

  const values = points.map((point) => point.total ?? 0)
  const top = niceMax(Math.max(0, ...values))
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const baseY = PAD.top + plotHeight
  const slot = plotWidth / points.length
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => top * fraction)
  const hasSales = values.some((value) => value > 0)

  const centerX = (index: number) => PAD.left + slot * index + slot / 2

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Sales for the last ${points.length} days`}
      >
        {ticks.map((tick) => {
          const y = baseY - (tick / top) * plotHeight
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                style={{ stroke: 'var(--line)' }}
                strokeDasharray={tick === 0 ? undefined : '3 4'}
              />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 11 }}>
                {formatMoney(tick)}
              </text>
            </g>
          )
        })}

        {points.map((point, index) => {
          const value = values[index]
          const height = top ? (value / top) * plotHeight : 0
          const x = centerX(index) - BAR_WIDTH / 2
          const barTop = baseY - height
          const isActive = active === index
          const label = point.total === null ? 'Not available' : formatMoney(point.total)

          return (
            <g
              key={point.date}
              tabIndex={0}
              role="img"
              aria-label={`${shortDate(point.date)}: ${label}`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              style={{ outline: 'none' }}
            >
              {/* The whole day slot is the hit area, so the bar is easy to hover */}
              <rect
                x={PAD.left + slot * index}
                y={PAD.top - 8}
                width={slot}
                height={plotHeight + 8 + PAD.bottom}
                fill="transparent"
              />
              {height > 0 && (
                <path
                  d={barPath(x, barTop, BAR_WIDTH, height, baseY)}
                  style={{
                    fill: 'var(--blue)',
                    stroke: isActive ? 'var(--ink)' : 'none',
                    strokeWidth: 1.5,
                  }}
                />
              )}
              <text
                x={centerX(index)}
                y={barTop - 7}
                textAnchor="middle"
                style={{ fill: 'var(--ink)', fontSize: 11, fontWeight: 700 }}
              >
                {label}
              </text>
              <text
                x={centerX(index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                style={{ fill: 'var(--muted)', fontSize: 11 }}
              >
                {shortDate(point.date)}
              </text>
            </g>
          )
        })}
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border px-2 py-1 text-xs shadow-sm"
          style={{
            left: `${(centerX(active) / WIDTH) * 100}%`,
            top: 0,
            background: 'var(--surface)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>{shortDate(points[active].date)}</span>
          <strong className="ml-2">{points[active].total === null ? 'Not available' : formatMoney(points[active].total)}</strong>
        </div>
      )}

      {!hasSales && <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>No completed sales in these days.</p>}

      {/* The same numbers as a table, so nothing depends on hovering */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer" style={{ color: 'var(--blue)' }}>Show as table</summary>
        <div className="table-scroll mt-2">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total sales</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <td>{shortDate(point.date)}</td>
                  <td>{point.total === null ? 'Not available' : formatMoney(point.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
