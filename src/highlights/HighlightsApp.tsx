import { useEffect, useMemo, useState } from 'react'
import { playerColor } from '../components/ui'
import { SessionFilmPlayer } from '../film/clips'
import { causeMeta } from '../lib/causes'
import { loadBundledSessions } from '../lib/load'
import { formatTouchLabel, TOUCH_GRADE_COLORS } from '../lib/touches'
import { extractVideoId, formatVideoTimestamp } from '../tagger/youtube'
import { highlightClipsForPlayer, highlightRoster, type HighlightClip, type HighlightKind } from './highlights'
import '../tagger/tagger.css'
import '../film/film.css'
import './highlights.css'

const KEY = 'sdwfu-highlight-player'

const CATEGORY_META: Record<HighlightKind, { label: string; short: string; color: string }> = {
  finish: { label: 'Rally ending', short: 'Finish', color: 'var(--win)' },
  serve3: { label: 'Serves', short: 'Serve 3', color: '#c084fc' },
  receive3: { label: 'Receives', short: 'Receive 3', color: TOUCH_GRADE_COLORS[3] },
  set3: { label: 'Sets', short: 'Set 3', color: '#60a5fa' },
  attack3: { label: 'Attacks', short: 'Attack 3', color: '#f472b6' },
  block3: { label: 'Blocks', short: 'Block 3', color: '#fb923c' },
}

const CATEGORIES = Object.keys(CATEGORY_META) as HighlightKind[]

function ClipButton({
  clip,
  active,
  onClick,
}: {
  clip: HighlightClip
  active: boolean
  onClick: () => void
}) {
  const meta = CATEGORY_META[clip.kind]
  return (
    <button type="button" className={`highlight-clip ${active ? 'on' : ''}`} onClick={onClick}>
      <div className="highlight-clip-top">
        <span className="name-cell">
          <i className="dot" style={{ background: meta.color }} />
          {formatTouchLabel(clip.touch)}
        </span>
        <span className="mono faint">{clip.rally.videoTimestamp}</span>
      </div>
      <div className="muted highlight-clip-meta">
        {clip.rally.sessionLabel} · Set {clip.rally.set} · #{clip.rally.n} · {clip.rally.us}–
        {clip.rally.them}
      </div>
      <div className="faint highlight-clip-note">
        {clip.rally.notes || causeMeta(clip.rally.cause, clip.rally.won).label}
      </div>
    </button>
  )
}

export default function HighlightsApp() {
  const sessions = useMemo(() => loadBundledSessions().sessions, [])
  const roster = useMemo(() => highlightRoster(sessions), [sessions])
  const [player, setPlayer] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(KEY)
      return saved && roster.includes(saved) ? saved : null
    } catch {
      return null
    }
  })
  const [category, setCategory] = useState<HighlightKind>('finish')
  const [sessionFilter, setSessionFilter] = useState<string | 'all'>('all')
  const [setFilter, setSetFilter] = useState<string | 'all'>('all')
  const [causeFilter, setCauseFilter] = useState<string | 'all'>('all')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)

  const clips = useMemo(() => (player ? highlightClipsForPlayer(sessions, player) : []), [sessions, player])
  const categoryClips = useMemo(() => clips.filter((clip) => clip.kind === category), [clips, category])

  const sessionOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number; date: string }>()
    for (const clip of categoryClips) {
      const current = map.get(clip.rally.sessionId) ?? {
        label: clip.rally.sessionLabel,
        count: 0,
        date: clip.rally.date,
      }
      current.count += 1
      map.set(clip.rally.sessionId, current)
    }
    return [...map.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date))
  }, [categoryClips])

  const bySession = useMemo(
    () =>
      sessionFilter === 'all'
        ? categoryClips
        : categoryClips.filter((clip) => clip.rally.sessionId === sessionFilter),
    [categoryClips, sessionFilter],
  )

  const setOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number; sort: string }>()
    for (const clip of bySession) {
      const key = `${clip.rally.sessionId}::${clip.rally.set}`
      const current = map.get(key) ?? {
        label: `${clip.rally.sessionLabel} · Set ${clip.rally.set}`,
        count: 0,
        sort: `${clip.rally.date}-${clip.rally.set}`,
      }
      current.count += 1
      map.set(key, current)
    }
    return [...map.entries()].sort((a, b) =>
      a[1].sort.localeCompare(b[1].sort, undefined, { numeric: true }),
    )
  }, [bySession])

  const bySet = useMemo(
    () =>
      setFilter === 'all'
        ? bySession
        : bySession.filter((clip) => `${clip.rally.sessionId}::${clip.rally.set}` === setFilter),
    [bySession, setFilter],
  )

  const causes = useMemo(() => {
    const map = new Map<string, number>()
    for (const clip of bySet) map.set(clip.rally.cause, (map.get(clip.rally.cause) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [bySet])

  const filtered = useMemo(
    () => (causeFilter === 'all' ? bySet : bySet.filter((clip) => clip.rally.cause === causeFilter)),
    [bySet, causeFilter],
  )
  const active = filtered.find((clip) => clip.id === activeId) ?? filtered[0] ?? null
  const activeIndex = active ? filtered.findIndex((clip) => clip.id === active.id) : -1

  useEffect(() => {
    if (!player) return
    try {
      localStorage.setItem(KEY, player)
    } catch {
      /* ignore */
    }
  }, [player])

  useEffect(() => {
    setCategory('finish')
    setSessionFilter('all')
    setSetFilter('all')
    setCauseFilter('all')
    setActiveId(null)
    setAutoplay(false)
  }, [player])

  useEffect(() => {
    setSessionFilter('all')
    setSetFilter('all')
    setCauseFilter('all')
    setActiveId(null)
    setAutoplay(false)
  }, [category])

  useEffect(() => {
    setSetFilter('all')
    setCauseFilter('all')
    setActiveId(null)
  }, [sessionFilter])

  useEffect(() => {
    setCauseFilter('all')
    setActiveId(null)
  }, [setFilter])

  const selectClip = (clip: HighlightClip) => {
    setActiveId(clip.id)
    setAutoplay(true)
  }

  const filtersActive = sessionFilter !== 'all' || setFilter !== 'all' || causeFilter !== 'all'

  return (
    <div className="app highlights-app">
      <header className="masthead">
        <div>
          <h1>Highlight reel</h1>
          <div className="sub">
            Rally-ending touches and quality-3 serves, receives, sets, attacks, and blocks · clips may overlap
          </div>
        </div>
        <div className="badge-row">
          <a className="chip" href="/">
            Home
          </a>
          <a className="chip" href="/stats">
            Dashboard
          </a>
          <a className="chip" href="/film">
            Error film
          </a>
          <a className="chip" href="/glossary">
            Glossary
          </a>
          {player && (
            <div className="record-chip">
              <span className="big" style={{ color: playerColor(player) }}>
                {filtered.length}
              </span>
              <span className="lbl">{filtersActive ? 'matching' : CATEGORY_META[category].label}</span>
            </div>
          )}
        </div>
      </header>

      <div className="filters">
        <div className="filter-group">
          <span className="filter-label">Player</span>
          {roster.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip ${player === name ? 'on' : ''}`}
              onClick={() => setPlayer(name)}
            >
              <i className="dot" style={{ background: playerColor(name), display: 'inline-block', marginRight: 6 }} />
              {name}
            </button>
          ))}
        </div>

        {player && (
          <div className="filter-group">
            <span className="filter-label">Category</span>
            {CATEGORIES.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`chip ${category === kind ? 'on' : ''}`}
                onClick={() => setCategory(kind)}
              >
                {CATEGORY_META[kind].label} · {clips.filter((clip) => clip.kind === kind).length}
              </button>
            ))}
          </div>
        )}

        {player && sessionOptions.length > 1 && (
          <div className="filter-group">
            <span className="filter-label">Day</span>
            <button
              type="button"
              className={`chip ${sessionFilter === 'all' ? 'on' : 'ghost'}`}
              onClick={() => setSessionFilter('all')}
            >
              All
            </button>
            {sessionOptions.map(([id, option]) => (
              <button
                key={id}
                type="button"
                className={`chip ${sessionFilter === id ? 'on' : ''}`}
                onClick={() => setSessionFilter(id)}
              >
                {option.label} · {option.count}
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
            {setOptions.map(([key, option]) => (
              <button
                key={key}
                type="button"
                className={`chip ${setFilter === key ? 'on' : ''}`}
                onClick={() => setSetFilter(key)}
              >
                {sessionOptions.length > 1 ? option.label : `Set ${key.split('::')[1]}`} · {option.count}
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
            {causes.map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={`chip ${causeFilter === key ? 'on' : ''}`}
                onClick={() => setCauseFilter(key)}
              >
                {causeMeta(key, false).short} · {count}
              </button>
            ))}
          </div>
        )}
      </div>

      {!player ? (
        <div className="empty">Choose a player to build their highlight reel.</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          {categoryClips.length === 0
            ? `${player} has no ${CATEGORY_META[category].label.toLowerCase()} clips yet.`
            : 'No highlight clips match these filters.'}
        </div>
      ) : (
        <div className="film-layout highlight-layout">
          <aside className="film-list">
            {filtered.map((clip) => (
              <ClipButton
                key={clip.id}
                clip={clip}
                active={active?.id === clip.id}
                onClick={() => selectClip(clip)}
              />
            ))}
          </aside>

          <section className="film-stage highlight-stage">
            {active && extractVideoId(active.youtubeUrl) ? (
              <>
                <SessionFilmPlayer
                  url={active.youtubeUrl}
                  start={active.start}
                  end={active.end}
                  autoplay={autoplay}
                />
                <div className="film-caption">
                  <div className="highlight-now">
                    <span style={{ color: CATEGORY_META[active.kind].color }}>
                      {CATEGORY_META[active.kind].short}
                    </span>
                    <strong>{formatTouchLabel(active.touch)}</strong>
                  </div>
                  <div className="muted">
                    {active.rally.sessionLabel} · Set {active.rally.set} rally {active.rally.n} · score{' '}
                    {active.rally.us}–{active.rally.them} · {causeMeta(active.rally.cause, active.rally.won).label}
                  </div>
                  <div className="faint">
                    Clip {formatVideoTimestamp(active.start)}→{formatVideoTimestamp(active.end)} · rally ends{' '}
                    {active.rally.videoTimestamp}
                  </div>
                  {active.rally.notes && <div className="film-notes">{active.rally.notes}</div>}
                  <div className="faint mono">{active.rally.touches.map(formatTouchLabel).join(' · ')}</div>
                  <div className="film-nav">
                    <button
                      type="button"
                      className="chip"
                      disabled={activeIndex <= 0}
                      onClick={() => activeIndex > 0 && selectClip(filtered[activeIndex - 1]!)}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      className="chip"
                      disabled={activeIndex < 0 || activeIndex >= filtered.length - 1}
                      onClick={() =>
                        activeIndex >= 0 && activeIndex < filtered.length - 1 && selectClip(filtered[activeIndex + 1]!)
                      }
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
