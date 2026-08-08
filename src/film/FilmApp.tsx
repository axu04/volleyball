import { useEffect, useMemo, useState } from 'react'
import { causeMeta, isOurError } from '../lib/causes'
import { loadBundledSessions } from '../lib/load'
import { formatTouchLabel } from '../lib/touches'
import type { Rally, Session } from '../lib/types'
import { extractVideoId, formatVideoTimestamp } from '../tagger/youtube'
import { playerColor } from '../components/ui'
import { clipWindow } from './clipWindow'
import { SessionFilmPlayer } from './clips'
import '../tagger/tagger.css'
import './film.css'

const KEY = 'sdwfu-film-player'

export interface ErrorClip {
  rally: Rally
  /** Match film for this rally — prefer the set's own Videos URL. */
  youtubeUrl: string
  start: number
  end: number
}

function playerErrors(sessions: Session[], name: string): ErrorClip[] {
  const out: ErrorClip[] = []
  for (const s of sessions) {
    for (const r of s.rallies) {
      if (!r.players.includes(name)) continue
      if (!isOurError(r.cause, r.won)) continue
      const url = r.youtubeUrl || s.youtubeBySet[r.set] || s.youtubeUrl
      if (!url || !extractVideoId(url)) continue
      const win = clipWindow(r, s)
      if (!win) continue
      out.push({ rally: r, youtubeUrl: url, start: win.start, end: win.end })
    }
  }
  return out.sort((a, b) => {
    if (a.rally.date !== b.rally.date) return a.rally.date.localeCompare(b.rally.date)
    if (a.rally.sessionId !== b.rally.sessionId) return a.rally.sessionId.localeCompare(b.rally.sessionId)
    if (a.rally.set !== b.rally.set) {
      return String(a.rally.set).localeCompare(String(b.rally.set), undefined, { numeric: true })
    }
    return a.start - b.start || a.rally.n - b.rally.n
  })
}

function rosterWithErrors(sessions: Session[]): string[] {
  const names = new Set<string>()
  for (const s of sessions) {
    for (const r of s.rallies) {
      if (isOurError(r.cause, r.won)) r.players.forEach((p) => names.add(p))
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export default function FilmApp() {
  const sessions = useMemo(() => loadBundledSessions().sessions, [])
  const roster = useMemo(() => rosterWithErrors(sessions), [sessions])

  const [player, setPlayer] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(KEY)
      return saved && roster.includes(saved) ? saved : null
    } catch {
      return null
    }
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)
  const [sessionFilter, setSessionFilter] = useState<string | 'all'>('all')
  const [setFilter, setSetFilter] = useState<string | 'all'>('all')
  const [causeFilter, setCauseFilter] = useState<string | 'all'>('all')

  const clips = useMemo(() => (player ? playerErrors(sessions, player) : []), [sessions, player])

  const sessionOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number; date: string }>()
    for (const c of clips) {
      const cur = map.get(c.rally.sessionId) ?? {
        label: c.rally.sessionLabel,
        count: 0,
        date: c.rally.date,
      }
      cur.count += 1
      map.set(c.rally.sessionId, cur)
    }
    return [...map.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date))
  }, [clips])

  const bySession = useMemo(
    () => (sessionFilter === 'all' ? clips : clips.filter((c) => c.rally.sessionId === sessionFilter)),
    [clips, sessionFilter],
  )

  const setOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number; sort: string }>()
    for (const c of bySession) {
      const key = `${c.rally.sessionId}::${c.rally.set}`
      const cur = map.get(key) ?? {
        label: `${c.rally.sessionLabel} · Set ${c.rally.set}`,
        count: 0,
        sort: `${c.rally.date}-${c.rally.set}`,
      }
      cur.count += 1
      map.set(key, cur)
    }
    return [...map.entries()].sort((a, b) => a[1].sort.localeCompare(b[1].sort, undefined, { numeric: true }))
  }, [bySession])

  const bySet = useMemo(
    () =>
      setFilter === 'all'
        ? bySession
        : bySession.filter((c) => `${c.rally.sessionId}::${c.rally.set}` === setFilter),
    [bySession, setFilter],
  )

  const causes = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of bySet) map.set(c.rally.cause, (map.get(c.rally.cause) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [bySet])

  const filtered = useMemo(
    () => (causeFilter === 'all' ? bySet : bySet.filter((c) => c.rally.cause === causeFilter)),
    [bySet, causeFilter],
  )

  const active = filtered.find((c) => c.rally.id === activeId) ?? filtered[0] ?? null

  useEffect(() => {
    if (!player) return
    try {
      localStorage.setItem(KEY, player)
    } catch {
      /* ignore */
    }
  }, [player])

  useEffect(() => {
    setActiveId(null)
    setSessionFilter('all')
    setSetFilter('all')
    setCauseFilter('all')
    setAutoplay(false)
  }, [player])

  useEffect(() => {
    setSetFilter('all')
    setCauseFilter('all')
    setActiveId(null)
  }, [sessionFilter])

  useEffect(() => {
    setCauseFilter('all')
    setActiveId(null)
  }, [setFilter])

  useEffect(() => {
    if (active && !filtered.some((c) => c.rally.id === active.rally.id)) {
      setActiveId(filtered[0]?.rally.id ?? null)
    }
  }, [filtered, active])

  const selectClip = (id: string) => {
    setActiveId(id)
    setAutoplay(true)
  }

  const filtersActive = sessionFilter !== 'all' || setFilter !== 'all' || causeFilter !== 'all'

  return (
    <div className="app film-app">
      <header className="masthead">
        <div>
          <h1>Error film</h1>
          <div className="sub">
            Each rally stores its YouTube link (usually one film per set) · timestamps are end-of-rally
          </div>
        </div>
        <div className="badge-row">
          <a className="chip" href="/">
            Home
          </a>
          <a className="chip" href="/stats">
            Dashboard
          </a>
          <a className="chip" href="/highlights">
            Highlights
          </a>
          <a className="chip" href="/glossary">
            Glossary
          </a>
          {player && (
            <div className="record-chip">
              <span className="big" style={{ color: 'var(--loss)' }}>
                {filtered.length}
              </span>
              <span className="lbl">{filtersActive ? 'matching' : 'errors'}</span>
            </div>
          )}
        </div>
      </header>

      <div className="filters">
        <div className="filter-group">
          <span className="filter-label">Player</span>
          {roster.length === 0 ? (
            <span className="muted">No tagged errors with film yet.</span>
          ) : (
            roster.map((name) => (
              <button
                key={name}
                type="button"
                className={`chip ${player === name ? 'on' : ''}`}
                onClick={() => setPlayer(name)}
              >
                <i className="dot" style={{ background: playerColor(name), display: 'inline-block', marginRight: 6 }} />
                {name}
              </button>
            ))
          )}
        </div>
        {player && sessionOptions.length > 1 && (
          <div className="filter-group">
            <span className="filter-label">Date</span>
            <button
              type="button"
              className={`chip ${sessionFilter === 'all' ? 'on' : 'ghost'}`}
              onClick={() => setSessionFilter('all')}
            >
              All
            </button>
            {sessionOptions.map(([id, opt]) => (
              <button
                key={id}
                type="button"
                className={`chip ${sessionFilter === id ? 'on' : ''}`}
                onClick={() => setSessionFilter(id)}
              >
                {opt.label} · {opt.count}
              </button>
            ))}
          </div>
        )}
        {player && setOptions.length > 1 && (
          <div className="filter-group">
            <span className="filter-label">Set</span>
            <button
              type="button"
              className={`chip ${setFilter === 'all' ? 'on' : 'ghost'}`}
              onClick={() => setSetFilter('all')}
            >
              All
            </button>
            {setOptions.map(([key, opt]) => (
              <button
                key={key}
                type="button"
                className={`chip ${setFilter === key ? 'on' : ''}`}
                onClick={() => setSetFilter(key)}
              >
                {sessionOptions.length > 1 ? opt.label : `Set ${key.split('::')[1]}`} · {opt.count}
              </button>
            ))}
          </div>
        )}
        {player && causes.length > 1 && (
          <div className="filter-group">
            <span className="filter-label">Cause</span>
            <button
              type="button"
              className={`chip ${causeFilter === 'all' ? 'on' : 'ghost'}`}
              onClick={() => setCauseFilter('all')}
            >
              All
            </button>
            {causes.map(([key, n]) => (
              <button
                key={key}
                type="button"
                className={`chip ${causeFilter === key ? 'on' : ''}`}
                onClick={() => setCauseFilter(key)}
              >
                {causeMeta(key, false).short} · {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {!player ? (
        <div className="empty">Choose a player to review their errors on film.</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          {clips.length === 0
            ? `${player} has no errors with a video timestamp + YouTube link in the loaded sheets.`
            : 'No errors match these filters.'}
        </div>
      ) : (
        <div className="film-layout">
          <aside className="film-list">
            {filtered.map((clip, i) => {
              const r = clip.rally
              const meta = causeMeta(r.cause, r.won)
              const on = active?.rally.id === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`film-row ${on ? 'on' : ''}`}
                  onClick={() => selectClip(r.id)}
                >
                  <div className="film-row-top">
                    <span className="film-idx">{i + 1}</span>
                    <span className="name-cell">
                      <i className="dot" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                    <span className="film-time mono">ends {r.videoTimestamp}</span>
                  </div>
                  <div className="film-row-meta muted">
                    {r.sessionLabel} · Set {r.set} · #{r.n} · {r.us}–{r.them} ·{' '}
                    {r.serving ? 'Serve' : 'Receive'}
                    {r.rotation ? ` · Rot ${r.rotation}` : ''}
                  </div>
                  {(r.notes || r.touches.length > 0) && (
                    <div className="film-row-note faint">
                      {r.notes || r.touches.map(formatTouchLabel).join(' · ')}
                    </div>
                  )}
                </button>
              )
            })}
          </aside>

          <section className="film-stage">
            {active && extractVideoId(active.youtubeUrl) ? (
              <>
                <SessionFilmPlayer
                  url={active.youtubeUrl}
                  start={active.start}
                  end={active.end}
                  autoplay={autoplay}
                />
                <div className="film-caption">
                  <div className="film-caption-title">
                    <i className="dot" style={{ background: causeMeta(active.rally.cause, false).color }} />
                    {causeMeta(active.rally.cause, false).label}
                    <span className="muted">
                      · clip {formatVideoTimestamp(active.start)}→{formatVideoTimestamp(active.end)} · point
                      ends {active.rally.videoTimestamp}
                    </span>
                  </div>
                  <div className="muted">
                    {active.rally.sessionLabel} · Set {active.rally.set} rally {active.rally.n} · score{' '}
                    {active.rally.us}–{active.rally.them}
                  </div>
                  {active.rally.notes && <div className="film-notes">{active.rally.notes}</div>}
                  {active.rally.touches.length > 0 && (
                    <div className="faint mono">{active.rally.touches.map(formatTouchLabel).join(' · ')}</div>
                  )}
                  <div className="film-nav">
                    <button
                      type="button"
                      className="chip"
                      disabled={filtered[0]?.rally.id === active.rally.id}
                      onClick={() => {
                        const i = filtered.findIndex((c) => c.rally.id === active.rally.id)
                        if (i > 0) selectClip(filtered[i - 1]!.rally.id)
                      }}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      className="chip"
                      disabled={filtered[filtered.length - 1]?.rally.id === active.rally.id}
                      onClick={() => {
                        const i = filtered.findIndex((c) => c.rally.id === active.rally.id)
                        if (i >= 0 && i < filtered.length - 1) selectClip(filtered[i + 1]!.rally.id)
                      }}
                    >
                      Next →
                    </button>
                    <a
                      className="chip"
                      href={`${active.youtubeUrl}${active.youtubeUrl.includes('?') ? '&' : '?'}t=${Math.floor(active.start)}s`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on YouTube
                    </a>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty">Could not load this clip — check the session YouTube URL.</div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
