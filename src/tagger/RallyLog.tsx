import { causeMeta } from '../lib/causes'
import type { TaggedRally } from './types'
import { formatVideoTimestamp } from './youtube'

export function RallyLog({
  rallies,
  selectedId,
  onSelect,
  onDelete,
  onSeek,
  onEditNotes,
}: {
  rallies: TaggedRally[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onSeek: (seconds: number) => void
  onEditNotes: (id: string, notes: string) => void
}) {
  if (!rallies.length) {
    return <div className="empty" style={{ padding: 28 }}>No rallies tagged yet. Commit one from the form.</div>
  }

  // Show newest at top for live tagging feel.
  const rows = [...rallies].reverse()

  return (
    <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th className="static" style={{ textAlign: 'left' }}>
              #
            </th>
            <th className="static">Time</th>
            <th className="static">Set</th>
            <th className="static">Rot</th>
            <th className="static">Phase</th>
            <th className="static" style={{ textAlign: 'left' }}>
              Result
            </th>
            <th className="static" style={{ textAlign: 'left' }}>
              Player
            </th>
            <th className="static" style={{ textAlign: 'left' }}>
              Notes
            </th>
            <th className="static" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, revIdx) => {
            const n = rallies.length - revIdx
            const meta = causeMeta(r.cause, r.won)
            return (
              <tr
                key={r.id}
                className={selectedId === r.id ? 'tagger-row-on' : ''}
                onClick={() => onSelect(r.id)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ textAlign: 'left' }} className="faint">
                  {n}
                </td>
                <td>
                  <button
                    type="button"
                    className="chip ghost"
                    style={{ padding: '2px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSeek(r.videoSeconds)
                    }}
                    title="Jump video to this timestamp"
                  >
                    {formatVideoTimestamp(r.videoSeconds)}
                  </button>
                </td>
                <td>{r.set}</td>
                <td className="faint">{r.rotation}</td>
                <td className="muted">{r.serving ? 'Serve' : 'Recv'}</td>
                <td style={{ textAlign: 'left' }}>
                  <span className="name-cell">
                    <i className="dot" style={{ background: meta.color }} />
                    <span className={r.won ? 'up' : 'down'}>{meta.short}</span>
                  </span>
                </td>
                <td style={{ textAlign: 'left' }} className="muted">
                  {r.players.join(', ') || '—'}
                </td>
                <td style={{ textAlign: 'left' }}>
                  <input
                    className="search"
                    style={{ minWidth: 140, width: '100%' }}
                    value={r.notes}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onEditNotes(r.id, e.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="chip ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(r.id)
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
