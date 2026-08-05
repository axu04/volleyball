import { autofillLineupsFrom, normalizeLineup } from './lineupRotation'
import type { LineupDraft, OfficialScore } from './types'

export function LineupEditor({
  lineups,
  roster,
  officialScores,
  setsSeen,
  onChangeLineups,
  onChangeScores,
  onRemoveRotation,
}: {
  lineups: LineupDraft[]
  roster: string[]
  officialScores: OfficialScore[]
  setsSeen: string[]
  onChangeLineups: (lineups: LineupDraft[]) => void
  onChangeScores: (scores: OfficialScore[]) => void
  onRemoveRotation?: (label: string) => void
}) {
  const setSlot = (
    rotIdx: number,
    field: 'front' | 'back' | 'sub',
    slot: number | null,
    value: string,
  ) => {
    const next = lineups.map((l, i) => {
      if (i !== rotIdx) return normalizeLineup(l)
      const cur = normalizeLineup(l)
      if (field === 'sub') return { ...cur, sub: value }
      const row = [...cur[field]]
      row[slot!] = value
      return { ...cur, [field]: row }
    })
    onChangeLineups(autofillLineupsFrom(rotIdx, next))
  }

  const setScore = (set: string, side: 'us' | 'them', value: string) => {
    const num = value === '' ? 0 : Math.max(0, +value || 0)
    const existing = officialScores.find((s) => s.set === set)
    if (existing) {
      onChangeScores(officialScores.map((s) => (s.set === set ? { ...s, [side]: num } : s)))
    } else {
      onChangeScores([...officialScores, { set, us: side === 'us' ? num : 0, them: side === 'them' ? num : 0 }])
    }
  }

  const scoreSets = [...new Set([...setsSeen, ...officialScores.map((s) => s.set), '1', '2', '3'])]

  return (
    <div className="grid g2">
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Line-ups by rotation</h3>
        <div className="faint" style={{ fontSize: 11.5, marginBottom: 12 }}>
          Six on court + one sub. Fill any rotation completely and the other six autofill — sub enters
          front-left, squad rotates clockwise.
        </div>
        <div className="grid" style={{ gap: 10 }}>
          {lineups.map((raw, rotIdx) => {
            const l = normalizeLineup(raw)
            return (
              <div key={l.rotation} className="lineup">
                <div className="rot-no">
                  <span>Rotation {l.rotation}</span>
                  {onRemoveRotation && lineups.length > 1 && (
                    <button
                      type="button"
                      className="chip"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => onRemoveRotation(l.rotation)}
                      title={`Remove rotation ${l.rotation}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="filter-label" style={{ marginBottom: 4 }}>
                  Front (L · M · R)
                </div>
                <div className="court-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {[0, 1, 2].map((slot) => (
                    <NameSelect
                      key={slot}
                      roster={roster}
                      value={l.front[slot] ?? ''}
                      onChange={(v) => setSlot(rotIdx, 'front', slot, v)}
                    />
                  ))}
                </div>
                <div className="filter-label" style={{ margin: '6px 0 4px' }}>
                  Back (L · M · R / serve)
                </div>
                <div className="court-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {[0, 1, 2].map((slot) => (
                    <NameSelect
                      key={slot}
                      roster={roster}
                      value={l.back[slot] ?? ''}
                      onChange={(v) => setSlot(rotIdx, 'back', slot, v)}
                    />
                  ))}
                </div>
                <div className="filter-label" style={{ margin: '6px 0 4px' }}>
                  Sub
                </div>
                <NameSelect roster={roster} value={l.sub} onChange={(v) => setSlot(rotIdx, 'sub', null, v)} />
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Official set scores</h3>
        <div className="card">
          {scoreSets.map((set) => {
            const score = officialScores.find((s) => s.set === set) ?? { set, us: 0, them: 0 }
            return (
              <div className="setline" key={set}>
                <span className="muted" style={{ minWidth: 48 }}>
                  Set {set}
                </span>
                <input
                  className="search"
                  style={{ width: 64, minWidth: 64 }}
                  type="number"
                  min={0}
                  value={score.us || ''}
                  placeholder="Us"
                  onChange={(e) => setScore(set, 'us', e.target.value)}
                />
                <span className="faint">–</span>
                <input
                  className="search"
                  style={{ width: 64, minWidth: 64 }}
                  type="number"
                  min={0}
                  value={score.them || ''}
                  placeholder="Them"
                  onChange={(e) => setScore(set, 'them', e.target.value)}
                />
              </div>
            )
          })}
          <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            Leave blank sets empty. Only filled scores are written into the CSV.
          </div>
        </div>
      </div>
    </div>
  )
}

function NameSelect({
  roster,
  value,
  onChange,
}: {
  roster: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select className="name-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {roster.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )
}
