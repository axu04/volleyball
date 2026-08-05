import { ALL_CAUSES, causeMeta } from '../lib/causes'
import { formatTouchLabel, parseTouches, serializeTouches } from '../lib/touches'
import type { TaggedRally } from './types'
import { formatVideoTimestamp, parseVideoTimestamp } from './youtube'

const SETS = ['1', '2', '3', 'et']

export function RallyLog({
  rallies,
  rotations,
  roster,
  selectedId,
  onSelect,
  onDelete,
  onSeek,
  onUpdate,
}: {
  rallies: TaggedRally[]
  rotations: string[]
  roster: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onSeek: (seconds: number) => void
  onUpdate: (id: string, patch: Partial<TaggedRally>) => void
}) {
  if (!rallies.length) {
    return <div className="empty" style={{ padding: 28 }}>No rallies tagged yet. Commit one from the form.</div>
  }

  // Show newest at top for live tagging feel.
  const rows = [...rallies].reverse()

  return (
    <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
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
              W/L
            </th>
            <th className="static" style={{ textAlign: 'left' }}>
              Cause
            </th>
            <th className="static" style={{ textAlign: 'left' }}>
              Player
            </th>
            <th className="static" style={{ textAlign: 'left' }}>
              Touches
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
            const causes = ALL_CAUSES.filter((c) => (r.won ? c.side === 'win' : c.side === 'loss'))
            const rotOptions = rotations.includes(r.rotation) ? rotations : [...rotations, r.rotation]
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
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      className="search"
                      style={{ width: 64, minWidth: 64, padding: '4px 6px' }}
                      defaultValue={formatVideoTimestamp(r.videoSeconds)}
                      key={`${r.id}-t-${r.videoSeconds}`}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const parsed = parseVideoTimestamp(e.target.value.trim())
                        if (parsed !== null && parsed !== r.videoSeconds) {
                          onUpdate(r.id, { videoSeconds: parsed })
                        } else {
                          e.target.value = formatVideoTimestamp(r.videoSeconds)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      title="Timestamp (m:ss or h:mm:ss)"
                    />
                    <button
                      type="button"
                      className="chip ghost"
                      style={{ padding: '2px 6px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSeek(r.videoSeconds)
                      }}
                      title="Jump video here"
                    >
                      ▶
                    </button>
                  </div>
                </td>
                <td>
                  <select
                    className="name-select"
                    value={r.set}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdate(r.id, { set: e.target.value })}
                  >
                    {[...new Set([...SETS, r.set])].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="name-select"
                    value={r.rotation}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdate(r.id, { rotation: e.target.value })}
                  >
                    {rotOptions.map((rot) => (
                      <option key={rot} value={rot}>
                        {rot}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="name-select"
                    value={r.serving ? 'serve' : 'recv'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdate(r.id, { serving: e.target.value === 'serve' })}
                  >
                    <option value="serve">Serve</option>
                    <option value="recv">Recv</option>
                  </select>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <select
                    className="name-select"
                    value={r.won ? 'yes' : 'no'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const won = e.target.value === 'yes'
                      const stillOk = ALL_CAUSES.some((c) => c.key === r.cause && c.side === (won ? 'win' : 'loss'))
                      onUpdate(r.id, { won, cause: stillOk ? r.cause : '' })
                    }}
                  >
                    <option value="yes">Won</option>
                    <option value="no">Lost</option>
                  </select>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <select
                    className="name-select"
                    value={r.cause}
                    style={{ borderLeft: `3px solid ${meta.color}` }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdate(r.id, { cause: e.target.value })}
                  >
                    {!r.cause && <option value="">—</option>}
                    {causes.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.short}
                      </option>
                    ))}
                    {r.cause && !causes.some((c) => c.key === r.cause) && (
                      <option value={r.cause}>{meta.short}</option>
                    )}
                  </select>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <input
                    className="search"
                    style={{ minWidth: 100, width: '100%' }}
                    list={`roster-${r.id}`}
                    defaultValue={r.players.join(', ')}
                    key={`${r.id}-players-${r.players.join(',')}`}
                    placeholder="Name"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const players = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      if (players.join('|') !== r.players.join('|')) onUpdate(r.id, { players })
                      e.target.value = players.join(', ')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                  />
                  <datalist id={`roster-${r.id}`}>
                    {roster.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </td>
                <td style={{ textAlign: 'left' }}>
                  <input
                    className="search"
                    style={{ minWidth: 160, width: '100%' }}
                    defaultValue={serializeTouches(r.touches ?? [])}
                    key={`${r.id}-touches-${serializeTouches(r.touches ?? [])}`}
                    placeholder="o|Alec:r1|Avy:s2"
                    title={(r.touches ?? []).map(formatTouchLabel).join(' · ') || 'Touches'}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const next = parseTouches(e.target.value)
                      const prev = serializeTouches(r.touches ?? [])
                      const serialized = serializeTouches(next)
                      if (serialized !== prev) onUpdate(r.id, { touches: next })
                      e.target.value = serialized
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    }}
                  />
                </td>
                <td style={{ textAlign: 'left' }}>
                  <input
                    className="search"
                    style={{ minWidth: 120, width: '100%' }}
                    value={r.notes}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdate(r.id, { notes: e.target.value })}
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
