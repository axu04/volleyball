import { useEffect, useMemo, useRef, useState } from 'react'
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
const PREVIEW_LIMIT = 6

const SECTION_META: Record<
  HighlightKind,
  { title: string; short: string; description: string; color: string }
> = {
  finish: {
    title: 'Rally-ending touches',
    short: 'Finish',
    description: 'The last SDWFU player touch before a won rally ended.',
    color: 'var(--win)',
  },
  receive3: {
    title: '3-rated receives & digs',
    short: 'Receive 3',
    description: 'Clean first contacts and defensive bumps rated 3.',
    color: TOUCH_GRADE_COLORS[3],
  },
  set3: {
    title: '3-rated sets',
    short: 'Set 3',
    description: 'Sets rated 3, with a longer clip window to show the full play.',
    color: '#60a5fa',
  },
  attack3: {
    title: '3-rated attacks',
    short: 'Attack 3',
    description: 'Attacks rated 3, whether or not the rally ended immediately.',
    color: '#f472b6',
  },
}

function ClipButton({
  clip,
  active,
  onClick,
}: {
  clip: HighlightClip
  active: boolean
  onClick: () => void
}) {
  const meta = SECTION_META[clip.kind]
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
      {clip.rally.notes && <div className="faint highlight-clip-note">{clip.rally.notes}</div>}
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const [autoplay, setAutoplay] = useState(false)
  const [expanded, setExpanded] = useState<Partial<Record<HighlightKind, boolean>>>({})
  const stageRef = useRef<HTMLElement>(null)

  const clips = useMemo(() => (player ? highlightClipsForPlayer(sessions, player) : []), [sessions, player])
  const grouped = useMemo(
    () => ({
      finish: clips.filter((clip) => clip.kind === 'finish'),
      receive3: clips.filter((clip) => clip.kind === 'receive3'),
      set3: clips.filter((clip) => clip.kind === 'set3'),
      attack3: clips.filter((clip) => clip.kind === 'attack3'),
    }),
    [clips],
  )
  const active = clips.find((clip) => clip.id === activeId) ?? grouped.finish[0] ?? clips[0] ?? null

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
    setAutoplay(false)
    setExpanded({})
  }, [player])

  const selectClip = (clip: HighlightClip, scroll = false) => {
    setActiveId(clip.id)
    setAutoplay(true)
    if (scroll) requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const activeGroup = active ? grouped[active.kind] : []
  const activeIndex = active ? activeGroup.findIndex((clip) => clip.id === active.id) : -1

  return (
    <div className="app highlights-app">
      <header className="masthead">
        <div>
          <h1>Highlight reel</h1>
          <div className="sub">
            Rally-ending touches first · quality-3 receives, sets, and attacks underneath
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
                {clips.length}
              </span>
              <span className="lbl">clips</span>
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
      </div>

      {!player ? (
        <div className="empty">Choose a player to build their highlight reel.</div>
      ) : clips.length === 0 ? (
        <div className="empty">{player} has no playable highlights in the tagged film yet.</div>
      ) : (
        <>
          <section className="highlight-feature">
            <div className="highlight-section-head">
              <div>
                <div className="highlight-kicker">Main reel</div>
                <h2>{SECTION_META.finish.title}</h2>
                <p>{SECTION_META.finish.description}</p>
              </div>
              <span className="highlight-count">{grouped.finish.length}</span>
            </div>

            <div className="highlight-feature-layout">
              <div className="highlight-finish-list">
                {grouped.finish.length ? (
                  grouped.finish.map((clip) => (
                    <ClipButton
                      key={clip.id}
                      clip={clip}
                      active={active?.id === clip.id}
                      onClick={() => selectClip(clip)}
                    />
                  ))
                ) : (
                  <div className="empty">No won rallies where {player} recorded the final touch.</div>
                )}
              </div>

              <section ref={stageRef} className="film-stage highlight-stage">
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
                        <span style={{ color: SECTION_META[active.kind].color }}>
                          {SECTION_META[active.kind].short}
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
                          onClick={() => activeIndex > 0 && selectClip(activeGroup[activeIndex - 1]!, false)}
                        >
                          ← Prev
                        </button>
                        <button
                          type="button"
                          className="chip"
                          disabled={activeIndex < 0 || activeIndex >= activeGroup.length - 1}
                          onClick={() =>
                            activeIndex >= 0 &&
                            activeIndex < activeGroup.length - 1 &&
                            selectClip(activeGroup[activeIndex + 1]!, false)
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
                  <div className="empty">Choose a clip to play it here.</div>
                )}
              </section>
            </div>
          </section>

          <div className="highlight-skill-sections">
            {(['receive3', 'set3', 'attack3'] as const).map((kind) => {
              const section = grouped[kind]
              const visible = expanded[kind] ? section : section.slice(0, PREVIEW_LIMIT)
              const meta = SECTION_META[kind]
              return (
                <section key={kind} className="highlight-skill-section">
                  <div className="highlight-section-head">
                    <div>
                      <h2>{meta.title}</h2>
                      <p>{meta.description}</p>
                    </div>
                    <span className="highlight-count">{section.length}</span>
                  </div>
                  {section.length ? (
                    <>
                      <div className="highlight-card-grid">
                        {visible.map((clip) => (
                          <ClipButton
                            key={clip.id}
                            clip={clip}
                            active={active?.id === clip.id}
                            onClick={() => selectClip(clip, true)}
                          />
                        ))}
                      </div>
                      {section.length > PREVIEW_LIMIT && (
                        <button
                          type="button"
                          className="chip highlight-show-all"
                          onClick={() => setExpanded((current) => ({ ...current, [kind]: !current[kind] }))}
                        >
                          {expanded[kind] ? 'Show fewer' : `Show all ${section.length}`}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="empty">No {meta.short.toLowerCase()} clips yet.</div>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
