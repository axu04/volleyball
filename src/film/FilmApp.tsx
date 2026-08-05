import { useEffect, useMemo, useState } from 'react'
import { causeMeta, isOurError } from '../lib/causes'
import { loadBundledSessions } from '../lib/load'
import { formatTouchLabel } from '../lib/touches'
import type { Rally, Session } from '../lib/types'
import { extractVideoId, formatVideoTimestamp, parseVideoTimestamp } from '../tagger/youtube'
import { playerColor } from '../components/ui'
import './film.css'

const KEY = 'sdwfu-film-player'
/** Sheet timestamps mark when the rally ends; pad a beat after so the whistle lands. */
const PAD_AFTER = 2
const DEFAULT_CLIP = 18
const MAX_CLIP = 45

export interface ErrorClip {
  rally: Rally
  youtubeUrl: string
  start: number
  end: number
}

/**
 * Timestamps are end-of-rally. Clip from the previous rally's end (or a default lookback)
 * through this rally's end.
 */
function clipWindow(rally: Rally, session: Session): { start: number; end: number } | null {
  const endRaw = parseVideoTimestamp(rally.videoTimestamp)
  if (endRaw === null) return null

  const peers = session.rallies
    .filter((r) => r.set === rally.set)
    .map((r) => ({ r, t: parseVideoTimestamp(r.videoTimestamp) }))
    .filter((x): x is { r: Rally; t: number } => x.t !== null)
    .sort((a, b) => a.t - b.t || a.r.n - b.r.n)

  const idx = peers.findIndex((p) => p.r.id === rally.id)
  const prev = idx > 0 ? peers[idx - 1] : undefined

  let start = prev ? prev.t : Math.max(0, endRaw - DEFAULT_CLIP)
  let end = endRaw + PAD_AFTER

  if (end <= start) start = Math.max(0, end - DEFAULT_CLIP)
  if (end - start > MAX_CLIP) start = Math.max(0, end - MAX_CLIP)

  return { start, end: Math.max(start + 4, end) }
}

function playerErrors(sessions: Session[], name: string): ErrorClip[] {
  const out: ErrorClip[] = []
  for (const s of sessions) {
    for (const r of s.rallies) {
      if (!r.players.includes(name)) continue
      if (!isOurError(r.cause, r.won)) continue
      const url = s.youtubeUrl
      if (!url || !extractVideoId(url)) continue
      const win = clipWindow(r, s)
      if (!win) continue
      out.push({ rally: r, youtubeUrl: url, start: win.start, end: win.end })
    }
  }
  // Chronological within session date, then set order as logged.
  return out.sort((a, b) => {
    if (a.rally.date !== b.rally.date) return a.rally.date.localeCompare(b.rally.date)
    if (a.rally.sessionId !== b.rally.sessionId) return a.rally.sessionId.localeCompare(b.rally.sessionId)
    if (a.rally.set !== b.rally.set) return String(a.rally.set).localeCompare(String(b.rally.set), undefined, { numeric: true })
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

function SegmentPlayer({
  videoId,
  start,
  end,
  autoplay,
}: {
  videoId: string
  start: number
  end: number
  autoplay: boolean
}) {
  // Remount iframe whenever the segment changes so YouTube's start/end params apply cleanly.
  const src =
    `https://www.youtube.com/embed/${videoId}` +
    `?start=${Math.floor(start)}&end=${Math.floor(end)}` +
    `&rel=0&modestbranding=1&playsinline=1` +
    (autoplay ? '&autoplay=1' : '')

  return (
    <div className="film-player">
      <iframe
        key={`${videoId}-${start}-${end}-${autoplay}`}
        title="Error clip"
        src={src}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
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
  const [causeFilter, setCauseFilter] = useState<string | 'all'>('all')

  const clips = useMemo(() => (player ? playerErrors(sessions, player) : []), [sessions, player])

  const causes = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of clips) {
      map.set(c.rally.cause, (map.get(c.rally.cause) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [clips])

  const filtered = useMemo(
    () => (causeFilter === 'all' ? clips : clips.filter((c) => c.rally.cause === causeFilter)),
    [clips, causeFilter],
  )

  const active = filtered.find((c) => c.rally.id === activeId) ?? filtered[0] ?? null

  useEffect(() => {
    if (player) {
      try {
        localStorage.setItem(KEY, player)
      } catch {
        /* ignore */
      }
    }
  }, [player])

  useEffect(() => {
    setActiveId(null)
    setCauseFilter('all')
    setAutoplay(false)
  }, [player])

  useEffect(() => {
    if (active && !filtered.some((c) => c.rally.id === active.rally.id)) {
      setActiveId(filtered[0]?.rally.id ?? null)
    }
  }, [filtered, active])

  const pick = (name: string) => {
    setPlayer(name)
  }

  const selectClip = (id: string) => {
    setActiveId(id)
    setAutoplay(true)
  }

  const videoId = active ? extractVideoId(active.youtubeUrl) : null

  return (
    <div className="app film-app">
      <header className="masthead">
        <div>
          <h1>Error film</h1>
          <div className="sub">
            Pick a player · timestamps are end-of-rally, so each clip runs from the previous point through this one
          </div>
        </div>
        <div className="badge-row">
          <a className="chip" href="/">
            Dashboard
          </a>
          <a className="chip" href="/tagger">
            Rally tagger
          </a>
          {player && (
            <div className="record-chip">
              <span className="big" style={{ color: 'var(--loss)' }}>
                {filtered.length}
              </span>
              <span className="lbl">{causeFilter === 'all' ? 'errors' : 'matching'}</span>
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
                onClick={() => pick(name)}
              >
                <i className="dot" style={{ background: playerColor(name), display: 'inline-block', marginRight: 6 }} />
                {name}
              </button>
            ))
          )}
        </div>
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
            : 'No errors match this cause filter.'}
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
                    <span className="film-time mono">
                      {formatVideoTimestamp(clip.start)}–{formatVideoTimestamp(clip.end)}
                    </span>
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
            {videoId && active ? (
              <>
                <SegmentPlayer
                  videoId={videoId}
                  start={active.start}
                  end={active.end}
                  autoplay={autoplay}
                />
                <div className="film-caption">
                  <div className="film-caption-title">
                    <i className="dot" style={{ background: causeMeta(active.rally.cause, false).color }} />
                    {causeMeta(active.rally.cause, false).label}
                    <span className="muted">
                      · {formatVideoTimestamp(active.start)} → {formatVideoTimestamp(active.end)}
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
              <div className="empty">Could not load this clip.</div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
