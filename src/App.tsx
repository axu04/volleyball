import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { Errors } from './components/Errors'
import { Flow } from './components/Flow'
import { Log } from './components/Log'
import { Overview } from './components/Overview'
import { Players } from './components/Players'
import { Rotations } from './components/Rotations'
import { Serving } from './components/Serving'
import { Touches } from './components/Touches'
import { Trends } from './components/Trends'
import { Empty, fmtPct } from './components/ui'
import { loadBundledSessions, loadDroppedFiles, mergeSessions } from './lib/load'
import { compareLabels, formatDateLong } from './lib/parse'
import { coreStats } from './lib/stats'
import type { Session } from './lib/types'

const TABS = [
  'Overview',
  'Touches',
  'Players',
  'Serving',
  'Rotations',
  'Errors',
  'Match flow',
  'Over time',
  'Rally log',
] as const
type Tab = (typeof TABS)[number]

const bundled = loadBundledSessions()

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(bundled.sessions)
  const [loadErrors, setLoadErrors] = useState<string[]>(bundled.errors)
  const [tab, setTab] = useState<Tab>('Overview')
  const [dragging, setDragging] = useState(false)

  const [pickedSessions, setPickedSessions] = useState<string[]>([])
  const [pickedSets, setPickedSets] = useState<string[]>([])
  const [pickedPlayers, setPickedPlayers] = useState<string[]>([])
  const [phase, setPhase] = useState<'all' | 'serve' | 'receive'>('all')

  const activeSessions = useMemo(
    () => (pickedSessions.length ? sessions.filter((s) => pickedSessions.includes(s.id)) : sessions),
    [sessions, pickedSessions],
  )

  const allSets = useMemo(
    () => [...new Set(activeSessions.flatMap((s) => s.sets.map((x) => x.set)))].sort(compareLabels),
    [activeSessions],
  )

  const allPlayers = useMemo(
    () => [...new Set(activeSessions.flatMap((s) => s.players))].sort((a, b) => a.localeCompare(b)),
    [activeSessions],
  )

  const rallies = useMemo(
    () =>
      activeSessions
        .flatMap((s) => s.rallies)
        .filter((r) => (pickedSets.length ? pickedSets.includes(r.set) : true))
        .filter((r) => (pickedPlayers.length ? r.players.some((p) => pickedPlayers.includes(p)) : true))
        .filter((r) => (phase === 'all' ? true : phase === 'serve' ? r.serving : !r.serving)),
    [activeSessions, pickedSets, pickedPlayers, phase],
  )

  const onDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = [...e.dataTransfer.files]
    const result = await loadDroppedFiles(files)
    setSessions((prev) => mergeSessions(prev, result.sessions))
    setLoadErrors(result.errors)
  }, [])

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const decidedSets = activeSessions.flatMap((s) => s.sets).filter((s) => s.decided)
  const setsWon = decidedSets.filter((s) => s.won).length
  const setsTotal = decidedSets.length
  const core = coreStats(rallies)
  const warnings = activeSessions.flatMap((s) => s.warnings.map((w) => `${s.label}: ${w}`))

  const dateRange =
    activeSessions.length === 0
      ? ''
      : activeSessions.length === 1
        ? formatDateLong(activeSessions[0].date)
        : `${formatDateLong(activeSessions[0].date)} → ${formatDateLong(activeSessions[activeSessions.length - 1].date)}`

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="masthead">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">
            Sunday&apos;s Didn&apos;t Work For Us · {sessions.length} session
            {sessions.length === 1 ? '' : 's'} · {dateRange || 'no data'}
          </div>
        </div>
        <div className="badge-row">
          <a className="chip" href="/">
            Home
          </a>
          <a className="chip" href="/film">
            Error film
          </a>
          <a className="chip" href="/glossary">
            Glossary
          </a>
          <div className="record-chip">
            <span className="big">
              {setsWon}–{setsTotal - setsWon}
            </span>
            <span className="lbl">sets</span>
          </div>
          <div className="record-chip">
            <span className="big">{core.rallies}</span>
            <span className="lbl">rallies logged</span>
          </div>
          <div className="record-chip">
            <span className="big" style={{ color: core.winPct >= 50 ? 'var(--win)' : 'var(--loss)' }}>
              {fmtPct(core.winPct, 1)}
            </span>
            <span className="lbl">point win rate</span>
          </div>
          <div className={`dropzone ${dragging ? 'over' : ''}`}>Drop more CSVs anywhere</div>
        </div>
      </header>

      {loadErrors.length > 0 && (
        <div className="notice">
          <b>Some files could not be read</b>
          <ul>
            {loadErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {sessions.length === 0 ? (
        <Empty>
          No sheets found. Put your game CSVs in the <code>data/</code> folder, or drop them onto this window.
        </Empty>
      ) : (
        <>
          <div className="filters">
            <div className="filter-group">
              <span className="filter-label">Session</span>
              <button className={`chip ${pickedSessions.length === 0 ? 'on' : 'ghost'}`} onClick={() => setPickedSessions([])}>
                All
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  className={`chip ${pickedSessions.includes(s.id) ? 'on' : ''}`}
                  onClick={() => toggle(pickedSessions, s.id, setPickedSessions)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="filter-group">
              <span className="filter-label">Set</span>
              <button className={`chip ${pickedSets.length === 0 ? 'on' : 'ghost'}`} onClick={() => setPickedSets([])}>
                All
              </button>
              {allSets.map((n) => (
                <button
                  key={n}
                  className={`chip ${pickedSets.includes(n) ? 'on' : ''}`}
                  onClick={() => toggle(pickedSets, n, setPickedSets)}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="filter-group">
              <span className="filter-label">Phase</span>
              {(['all', 'serve', 'receive'] as const).map((p) => (
                <button key={p} className={`chip ${phase === p ? 'on' : ''}`} onClick={() => setPhase(p)}>
                  {p === 'all' ? 'All' : p === 'serve' ? 'Serving' : 'Receiving'}
                </button>
              ))}
            </div>

            <div className="filter-group">
              <span className="filter-label">Player</span>
              <button
                className={`chip ${pickedPlayers.length === 0 ? 'on' : 'ghost'}`}
                onClick={() => setPickedPlayers([])}
              >
                Everyone
              </button>
              {allPlayers.map((p) => (
                <button
                  key={p}
                  className={`chip ${pickedPlayers.includes(p) ? 'on' : ''}`}
                  onClick={() => toggle(pickedPlayers, p, setPickedPlayers)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </nav>

          {warnings.length > 0 && tab === 'Overview' && (
            <div className="notice">
              <b>Tracking gaps</b>
              <ul>
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'Overview' && <Overview rallies={rallies} sessions={activeSessions} />}
          {tab === 'Touches' && <Touches rallies={rallies} />}
          {tab === 'Players' && <Players rallies={rallies} />}
          {tab === 'Serving' && <Serving rallies={rallies} sessions={activeSessions} />}
          {tab === 'Rotations' && <Rotations rallies={rallies} sessions={activeSessions} />}
          {tab === 'Errors' && <Errors rallies={rallies} />}
          {tab === 'Match flow' && <Flow rallies={rallies} sessions={activeSessions} />}
          {tab === 'Over time' && <Trends sessions={activeSessions} />}
          {tab === 'Rally log' && <Log rallies={rallies} />}
        </>
      )}
    </div>
  )
}
