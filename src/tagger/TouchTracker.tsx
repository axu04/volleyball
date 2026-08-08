import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  TOUCH_GRADE_COLORS,
  TOUCH_SKILLS,
  formatTouchLabel,
  isOppTouch,
  type Touch,
  type TouchSkill,
} from '../lib/touches'

const QUALITIES = [0, 1, 2, 3] as const
const SKILLS = new Set<string>(TOUCH_SKILLS.map((s) => s.skill))

export function TouchTracker({
  roster,
  touches,
  active,
  pendingPlayer,
  onStart,
  onStop,
  onSelectPlayer,
  onRecord,
  onUpdate,
  onRemove,
  onOpp,
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
  onUpdate: (index: number, touch: Touch) => void
  onRemove: (index: number) => void
  onOpp: () => void
  onUndo: () => void
  onClear: () => void
}) {
  const [skillBuf, setSkillBuf] = useState<TouchSkill | null>(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((n) => n.toLowerCase().includes(q))
  }, [roster, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, active, pendingPlayer])

  useEffect(() => {
    if (active && !pendingPlayer) {
      setQuery('')
      setHighlight(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [active, pendingPlayer, touches.length])

  useEffect(() => {
    if (!active) setEditingIndex(null)
    else if (editingIndex !== null && editingIndex >= touches.length) setEditingIndex(null)
  }, [active, editingIndex, touches.length])

  const cancelEditing = useCallback(() => {
    setEditingIndex(null)
    setSkillBuf(null)
    setQuery('')
    onSelectPlayer(null)
  }, [onSelectPlayer])

  const editTouch = (index: number) => {
    if (editingIndex === index) {
      cancelEditing()
      return
    }
    const touch = touches[index]
    onStart()
    setEditingIndex(index)
    setQuery('')
    if (isOppTouch(touch)) {
      setSkillBuf(null)
      onSelectPlayer(null)
    } else {
      setSkillBuf(touch.skill)
      onSelectPlayer(touch.player)
    }
  }

  const recordTouch = useCallback(
    (skill: TouchSkill, quality: 0 | 1 | 2 | 3) => {
      if (!pendingPlayer) return
      if (editingIndex === null) {
        onRecord(skill, quality)
      } else {
        onUpdate(editingIndex, { player: pendingPlayer, skill, quality })
        cancelEditing()
      }
    },
    [pendingPlayer, editingIndex, onRecord, onUpdate, cancelEditing],
  )

  const markOpp = useCallback(() => {
    setSkillBuf(null)
    setQuery('')
    if (pendingPlayer) onSelectPlayer(null)
    if (editingIndex === null) onOpp()
    else {
      onUpdate(editingIndex, { opp: true })
      setEditingIndex(null)
    }
  }, [pendingPlayer, editingIndex, onSelectPlayer, onOpp, onUpdate])

  useEffect(() => {
    if (!active) return

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      const tag = target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key.toLowerCase() === 'o' && !e.repeat) {
        if (inField && tag === 'INPUT' && inputRef.current === target) {
          if (query.trim().length > 0) return
          e.preventDefault()
          e.stopPropagation()
          markOpp()
          return
        }
        if (!inField) {
          e.preventDefault()
          e.stopPropagation()
          markOpp()
          return
        }
      }

      if (!pendingPlayer) return
      if (inField) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (editingIndex === null) {
          setSkillBuf(null)
          onSelectPlayer(null)
        } else {
          cancelEditing()
        }
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
        recordTouch(skillBuf, +k as 0 | 1 | 2 | 3)
        setSkillBuf(null)
        return
      }

      if (skillBuf) {
        e.preventDefault()
        e.stopPropagation()
        setSkillBuf(null)
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, pendingPlayer, skillBuf, query, editingIndex, recordTouch, markOpp, cancelEditing, onSelectPlayer])

  const pickPlayer = (name: string) => {
    setQuery('')
    onSelectPlayer(name)
  }

  const onPlayerKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!matches.length) return
      setHighlight((h) => (h + 1) % matches.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!matches.length) return
      setHighlight((h) => (h - 1 + matches.length) % matches.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const choice = matches[highlight] ?? matches[0]
      if (choice) pickPlayer(choice)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setQuery('')
      inputRef.current?.blur()
    }
  }

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
              <button type="button" className="chip" onClick={markOpp} title="Opponent ball (o)">
                o
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  cancelEditing()
                  onUndo()
                }}
                disabled={!touches.length}
              >
                Undo
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  cancelEditing()
                  onClear()
                }}
                disabled={!touches.length}
              >
                Clear
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  cancelEditing()
                  onStop()
                }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>

      {touches.length > 0 && (
        <div className="touch-seq">
          {touches.map((t, i) => (
            <button
              type="button"
              key={`${i}-${formatTouchLabel(t)}`}
              className={`touch-pill ${isOppTouch(t) ? 'touch-pill-opp' : ''} ${
                editingIndex === i ? 'touch-pill-editing' : ''
              }`}
              style={
                isOppTouch(t)
                  ? undefined
                  : { borderColor: TOUCH_GRADE_COLORS[t.quality], color: TOUCH_GRADE_COLORS[t.quality] }
              }
              onClick={() => editTouch(i)}
              title={`Edit ${formatTouchLabel(t)}`}
              aria-pressed={editingIndex === i}
            >
              {formatTouchLabel(t)}
            </button>
          ))}
          <span className="faint touch-edit-hint">Click a touch to edit.</span>
        </div>
      )}

      {active && (
        <>
          <div className="filter-label" style={{ margin: '10px 0 6px' }}>
            {pendingPlayer ? (
              <>
                {editingIndex === null ? 'Grade ' : 'Edit '}
                <span className="touch-pending">{pendingPlayer}</span>
                <span className="faint" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                  {skillBuf ? (
                    <>
                      type <span className="touch-type-buf">{skillBuf}_</span> (0–3)
                    </>
                  ) : (
                    <>type v/r/s/a/b then 0–3 · <code>o</code> = their ball</>
                  )}
                </span>
              </>
            ) : (
              <>
                {editingIndex === null ? 'Pick a player' : 'Edit touch — pick a player or use o'} — type + Enter ·{' '}
                <code>o</code> = opponent ball
              </>
            )}
          </div>

          {editingIndex !== null && (
            <div className="filter-group" style={{ marginBottom: 8 }}>
              <button type="button" className="chip" onClick={cancelEditing}>
                Cancel edit
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => {
                  onRemove(editingIndex)
                  cancelEditing()
                }}
              >
                Delete touch
              </button>
            </div>
          )}

          {!pendingPlayer && (
            <div className="touch-player-pick">
              <input
                ref={inputRef}
                className="search"
                style={{ width: '100%', marginBottom: 8 }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onPlayerKeyDown}
                placeholder="Type a name… (or o for opponent)"
                autoComplete="off"
                spellCheck={false}
              />
              {roster.length === 0 && <span className="faint">Add players in session setup.</span>}
              <div className="filter-group">
                {matches.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className={`chip ${i === highlight ? 'on' : ''}`}
                    onClick={() => pickPlayer(name)}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    {name}
                  </button>
                ))}
                {roster.length > 0 && matches.length === 0 && (
                  <span className="faint">No match for “{query.trim()}”</span>
                )}
              </div>
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
                        style={{ borderColor: TOUCH_GRADE_COLORS[q], color: TOUCH_GRADE_COLORS[q] }}
                        onClick={() => recordTouch(skill, q)}
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
          Optional — Start, <code>o</code> when they send it, name + Enter, then <code>v2</code> /{' '}
          <code>r2</code> / <code>s3</code> / <code>a1</code> / <code>b0</code>.
        </div>
      )}
    </div>
  )
}
