import { useEffect, useState } from 'react'
import { TOUCH_SKILLS, formatTouchLabel, type Touch, type TouchSkill } from '../lib/touches'

const QUALITIES = [0, 1, 2, 3] as const
const SKILLS = new Set<string>(['r', 's', 'a', 'b'])

export function TouchTracker({
  roster,
  touches,
  active,
  pendingPlayer,
  onStart,
  onStop,
  onSelectPlayer,
  onRecord,
  onUndo,
  onClear,
}: {
  roster: string[]
  touches: Touch[]
  active: boolean
  pendingPlayer: string | null
  onStart: () => void
  onStop: () => void
  onSelectPlayer: (name: string | null) => void
  onRecord: (skill: TouchSkill, quality: 0 | 1 | 2 | 3) => void
  onUndo: () => void
  onClear: () => void
}) {
  const [skillBuf, setSkillBuf] = useState<TouchSkill | null>(null)

  useEffect(() => {
    if (!pendingPlayer) {
      setSkillBuf(null)
      return
    }

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setSkillBuf(null)
        onSelectPlayer(null)
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        if (skillBuf) setSkillBuf(null)
        else onSelectPlayer(null)
        return
      }

      const k = e.key.toLowerCase()
      if (k.length !== 1) return

      if (!skillBuf && SKILLS.has(k)) {
        e.preventDefault()
        e.stopPropagation()
        setSkillBuf(k as TouchSkill)
        return
      }

      if (skillBuf && k >= '0' && k <= '3') {
        e.preventDefault()
        e.stopPropagation()
        onRecord(skillBuf, +k as 0 | 1 | 2 | 3)
        setSkillBuf(null)
        return
      }

      // Wrong second key — drop the buffered skill and wait again.
      if (skillBuf) {
        e.preventDefault()
        e.stopPropagation()
        setSkillBuf(null)
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [pendingPlayer, skillBuf, onRecord, onSelectPlayer])

  return (
    <div className="touch-tracker">
      <div className="touch-tracker-head">
        <span className="filter-label">Touches</span>
        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          {!active ? (
            <button type="button" className="chip primary" onClick={onStart}>
              Start
            </button>
          ) : (
            <>
              <button type="button" className="chip" onClick={onUndo} disabled={!touches.length}>
                Undo
              </button>
              <button type="button" className="chip" onClick={onClear} disabled={!touches.length}>
                Clear
              </button>
              <button type="button" className="chip" onClick={onStop}>
                Done
              </button>
            </>
          )}
        </div>
      </div>

      {touches.length > 0 && (
        <div className="touch-seq">
          {touches.map((t, i) => (
            <span key={`${i}-${formatTouchLabel(t)}`} className="touch-pill">
              {formatTouchLabel(t)}
            </span>
          ))}
        </div>
      )}

      {active && (
        <>
          <div className="filter-label" style={{ margin: '10px 0 6px' }}>
            {pendingPlayer ? (
              <>
                Grade <span className="touch-pending">{pendingPlayer}</span>
                <span className="faint" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                  {skillBuf ? (
                    <>
                      type <span className="touch-type-buf">{skillBuf}_</span> (0–3)
                    </>
                  ) : (
                    <>type r/s/a/b then 0–3</>
                  )}
                </span>
              </>
            ) : (
              'Pick a player'
            )}
          </div>

          {!pendingPlayer && (
            <div className="filter-group">
              {roster.length === 0 && <span className="faint">Add players in session setup.</span>}
              {roster.map((name) => (
                <button key={name} type="button" className="chip" onClick={() => onSelectPlayer(name)}>
                  {name}
                </button>
              ))}
            </div>
          )}

          {pendingPlayer && (
            <>
              <div className="filter-group" style={{ marginBottom: 8 }}>
                <button type="button" className="chip on" onClick={() => onSelectPlayer(null)}>
                  {pendingPlayer} ×
                </button>
                {skillBuf && <span className="touch-type-buf">{skillBuf}_</span>}
              </div>
              <div className="touch-grade-grid" aria-hidden="true">
                {TOUCH_SKILLS.map(({ skill, label }) => (
                  <div key={skill} className="touch-grade-row">
                    <span className="touch-skill-lbl" title={label}>
                      {skill}
                    </span>
                    {QUALITIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`chip touch-grade ${skillBuf === skill ? 'on' : ''}`}
                        onClick={() => onRecord(skill, q)}
                        tabIndex={-1}
                      >
                        {skill}
                        {q}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!active && !touches.length && (
        <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
          Optional — Start, pick a player, type e.g. <code>r2</code> / <code>s3</code> / <code>a1</code> /{' '}
          <code>b0</code>.
        </div>
      )}
    </div>
  )
}
