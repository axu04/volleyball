import { useMemo, useState, type ReactNode } from 'react'

const PLAYER_COLORS: Record<string, string> = {
  alec: '#38bdf8',
  amber: '#f97316',
  avy: '#a78bfa',
  ish: '#22c55e',
  jess: '#f472b6',
  michelle: '#2dd4bf',
  sofia: '#eab308',
}

export function playerColor(name: string): string {
  const known = PLAYER_COLORS[name.trim().toLowerCase()]
  if (known) return known

  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return `hsl(${hash % 360} 72% 62%)`
}

export const fmtPct = (v: number, digits = 0) => `${v.toFixed(digits)}%`
export const fmtSigned = (v: number) => (v > 0 ? `+${v}` : String(v))

export function Stat({
  label,
  value,
  detail,
  tone,
  hint,
}: {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: string
  hint?: string
}) {
  return (
    <div className="stat" style={{ ['--tone' as string]: tone ?? 'var(--accent)' }} title={hint}>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {detail !== undefined && <div className="d">{detail}</div>}
    </div>
  )
}

export function Card({
  title,
  hint,
  children,
  action,
}: {
  title: string
  hint?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="card">
      <header>
        <h3>{title}</h3>
        {action ?? (hint ? <span className="hint">{hint}</span> : null)}
      </header>
      {children}
    </section>
  )
}

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  sortable?: boolean
  value?: (row: T) => number | string
  render: (row: T) => ReactNode
  title?: string
}

export function SortableTable<T>({
  rows,
  columns,
  initialSort,
  rowKey,
}: {
  rows: T[]
  columns: Column<T>[]
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  rowKey: (row: T) => string
}) {
  const [sort, setSort] = useState(initialSort ?? { key: columns[0].key, dir: 'desc' as const })

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.value) return rows
    return [...rows].sort((a, b) => {
      const av = col.value!(a)
      const bv = col.value!(b)
      const cmp = typeof av === 'string' || typeof bv === 'string' ? String(av).localeCompare(String(bv)) : av - bv
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.value ? '' : 'static'} ${sort.key === c.key ? 'sorted' : ''}`}
                onClick={() => c.value && toggle(c.key)}
                title={c.title}
                style={c.align === 'left' ? { textAlign: 'left' } : undefined}
              >
                {c.label}
                {sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} style={c.align === 'left' ? { textAlign: 'left' } : undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

/** Diverging bar centered on zero, for plus/minus style numbers. */
export function NetBar({ value, max }: { value: number; max: number }) {
  const span = max > 0 ? max : 1
  const w = (Math.abs(value) / span) * 50
  return (
    <div className="bar-track" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.16)' }} />
      <div
        className="bar-fill"
        style={{
          left: value >= 0 ? '50%' : `${50 - w}%`,
          width: `${w}%`,
          background: value >= 0 ? 'var(--win)' : 'var(--loss)',
        }}
      />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
