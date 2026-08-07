import { ALL_CAUSES } from '../lib/causes'
import type { Touch, TouchSkill } from '../lib/touches'
import { TouchTracker } from './TouchTracker'

const SETS = ['1', '2', '3', 'et'] as const

export function RallyForm({
  set,
  rotation,
  rotations,
  serving,
  won,
  cause,
  players,
  notes,
  roster,
  canCommit,
  touches,
  touchActive,
  pendingTouchPlayer,
  onChange,
  onCommit,
  onNextRotation,
  onAddRotation,
  onRemoveRotation,
  onTouchStart,
  onTouchStop,
  onTouchSelectPlayer,
  onTouchRecord,
  onTouchOpp,
  onTouchUndo,
  onTouchClear,
}: {
  set: string
  rotation: string
  rotations: string[]
  serving: boolean
  won: boolean | null
  cause: string
  players: string[]
  notes: string
  roster: string[]
  canCommit: boolean
  touches: Touch[]
  touchActive: boolean
  pendingTouchPlayer: string | null
  onChange: (patch: {
    set?: string
    rotation?: string
    serving?: boolean
    won?: boolean | null
    cause?: string
    players?: string[]
    notes?: string
  }) => void
  onCommit: () => void
  onNextRotation: () => void
  onAddRotation: () => void
  onRemoveRotation: (label: string) => void
  onTouchStart: () => void
  onTouchStop: () => void
  onTouchSelectPlayer: (name: string | null) => void
  onTouchRecord: (skill: TouchSkill, quality: 0 | 1 | 2 | 3) => void
  onTouchOpp: () => void
  onTouchUndo: () => void
  onTouchClear: () => void
}) {
  const causes = ALL_CAUSES.filter((c) => {
    if (won === null) return true
    return won ? c.side === 'win' : c.side === 'loss'
  })

  const togglePlayer = (name: string) => {
    onChange({
      players: players.includes(name) ? players.filter((p) => p !== name) : [...players, name],
    })
  }

  return (
    <div className="tagger-form">
      <div className="tagger-sticky">
        <div className="filter-group" style={{ width: '100%' }}>
          <span className="filter-label">Set</span>
          {SETS.map((s) => (
            <button key={s} type="button" className={`chip ${set === s ? 'on' : ''}`} onClick={() => onChange({ set: s })}>
              {s}
            </button>
          ))}
        </div>

        <div className="filter-group" style={{ width: '100%' }}>
          <span className="filter-label">Rotation</span>
          {rotations.map((r) => (
            <button
              key={r}
              type="button"
              className={`chip ${rotation === r ? 'on' : ''}`}
              onClick={() => onChange({ rotation: r })}
            >
              {r}
            </button>
          ))}
          <button type="button" className="chip" onClick={onAddRotation} title="Add rotation">
            +
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              if (rotations.length <= 1) return
              onRemoveRotation(rotation)
            }}
            disabled={rotations.length <= 1}
            title={rotations.length <= 1 ? 'Keep at least one rotation' : `Remove rotation ${rotation}`}
          >
            −
          </button>
          <button type="button" className="chip ghost" onClick={onNextRotation} title="Advance rotation">
            Next →
          </button>
        </div>

        <div className="filter-group" style={{ width: '100%' }}>
          <span className="filter-label">Phase</span>
          <button type="button" className={`chip ${serving ? 'on' : ''}`} onClick={() => onChange({ serving: true })}>
            Serving
          </button>
          <button type="button" className={`chip ${!serving ? 'on' : ''}`} onClick={() => onChange({ serving: false })}>
            Receiving
          </button>
        </div>
      </div>

      <TouchTracker
        roster={roster}
        touches={touches}
        active={touchActive}
        pendingPlayer={pendingTouchPlayer}
        onStart={onTouchStart}
        onStop={onTouchStop}
        onSelectPlayer={onTouchSelectPlayer}
        onRecord={onTouchRecord}
        onOpp={onTouchOpp}
        onUndo={onTouchUndo}
        onClear={onTouchClear}
      />

      <div className="won-row">
        <button
          type="button"
          className={`won-btn yes ${won === true ? 'on' : ''}`}
          onClick={() => onChange({ won: true, cause: '' })}
        >
          Won
        </button>
        <button
          type="button"
          className={`won-btn no ${won === false ? 'on' : ''}`}
          onClick={() => onChange({ won: false, cause: '' })}
        >
          Lost
        </button>
      </div>

      <div className="filter-label" style={{ marginBottom: 8 }}>
        Cause
      </div>
      <div className="cause-grid">
        {causes.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`cause-btn ${cause === c.key ? 'on' : ''}`}
            style={{ ['--cause' as string]: c.color }}
            onClick={() => onChange({ cause: c.key })}
            disabled={won === null}
          >
            {c.short}
          </button>
        ))}
      </div>

      <div className="filter-label" style={{ margin: '14px 0 8px' }}>
        Player <span className="faint">(last touch; blank only for opponent serve into net)</span>
      </div>
      {cause === 'opp_err' && (
        <div className="faint" style={{ fontSize: 11.5, margin: '-4px 0 8px' }}>
          Select our last-touch player. Leave blank only when the opponent served into the net.
        </div>
      )}
      <div className="filter-group">
        {roster.length === 0 && <span className="faint">Add players in session setup.</span>}
        {roster.map((name) => (
          <button
            key={name}
            type="button"
            className={`chip ${players.includes(name) ? 'on' : ''}`}
            onClick={() => togglePlayer(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <label className="notes-label">
        Notes
        <input
          className="search"
          style={{ width: '100%', marginTop: 6 }}
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Optional — long rally, tip, etc."
        />
      </label>

      <button type="button" className="commit-btn" disabled={!canCommit} onClick={onCommit}>
        Commit rally ↵
      </button>
    </div>
  )
}
