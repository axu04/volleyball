import { useMemo, useState } from 'react'
import { causeMeta } from '../lib/causes'
import { formatTouchLabel } from '../lib/touches'
import type { Rally } from '../lib/types'
import { Card, Empty, playerColor } from './ui'

export function Log({ rallies }: { rallies: Rally[] }) {
  const [query, setQuery] = useState('')
  const [notesOnly, setNotesOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rallies.filter((r) => {
      if (notesOnly && r.notes.length < 3) return false
      if (!q) return true
      return (
        r.notes.toLowerCase().includes(q) ||
        r.cause.includes(q) ||
        causeMeta(r.cause, r.won).label.toLowerCase().includes(q) ||
        r.players.some((p) => p.toLowerCase().includes(q)) ||
        r.touches.some((t) => formatTouchLabel(t).toLowerCase().includes(q))
      )
    })
  }, [rallies, query, notesOnly])

  if (!rallies.length) return <Empty>No rallies match these filters.</Empty>

  return (
    <Card
      title="Rally log"
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={`chip ${notesOnly ? 'on' : ''}`} onClick={() => setNotesOnly((v) => !v)}>
            Only rallies with notes
          </button>
          <input
            className="search"
            placeholder="Search notes, players, causes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="hint">{filtered.length} rallies</span>
        </div>
      }
    >
      <div className="tbl-wrap" style={{ maxHeight: 660, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th className="static" style={{ textAlign: 'left' }}>
                Session
              </th>
              <th className="static">Set</th>
              <th className="static">#</th>
              <th className="static">Score</th>
              <th className="static">Phase</th>
              <th className="static">Rot</th>
              <th className="static" style={{ textAlign: 'left' }}>
                Result
              </th>
              <th className="static" style={{ textAlign: 'left' }}>
                Player
              </th>
              <th className="static" style={{ textAlign: 'left' }}>
                Touches
              </th>
              <th className="static" style={{ textAlign: 'left' }}>
                Note
              </th>
              <th className="static">Video</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const meta = causeMeta(r.cause, r.won)
              const touchText = r.touches.map(formatTouchLabel).join(' · ')
              return (
                <tr key={r.id}>
                  <td style={{ textAlign: 'left' }} className="muted">
                    {r.sessionLabel}
                  </td>
                  <td>{r.set}</td>
                  <td className="faint">{r.n}</td>
                  <td>
                    <span style={{ color: r.won ? 'var(--win)' : 'var(--loss)' }}>{r.us}</span>
                    <span className="faint">–{r.them}</span>
                  </td>
                  <td className="muted">{r.serving ? 'Serve' : 'Receive'}</td>
                  <td className="faint">{r.rotation ?? '—'}</td>
                  <td style={{ textAlign: 'left' }}>
                    <span className="name-cell">
                      <i className="dot" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    {r.players.length ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        {r.players.map((p) => (
                          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="dot" style={{ background: playerColor(p) }} />
                            {p}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td className="log-note muted" title={touchText}>
                    {touchText || <span className="faint">—</span>}
                  </td>
                  <td className="log-note">{r.notes || <span className="faint">—</span>}</td>
                  <td className="faint mono">{r.videoTimestamp || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
