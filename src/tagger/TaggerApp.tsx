import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadBundledSessions } from '../lib/load'
import type { Touch, TouchSkill } from '../lib/touches'
import { downloadCsv, exportTaggerCsv } from './exportCsv'
import { GameSummaryPanel } from './GameSummaryPanel'
import { LineupEditor } from './LineupEditor'
import { RallyForm } from './RallyForm'
import { RallyLog } from './RallyLog'
import { RepoAdmin } from './RepoAdmin'
import { importTaggerCsv } from './csvDraft'
import { inferLastTouchPlayer, inferTouchOutcome } from './inference'
import { assignSetToPlan, createPlanForSet, planForSet, updateRotationPlan } from './rotationPlans'
import { advanceAfterRally, addRotation, clearDraft, loadDraft, nextRotation, removeRotation, saveDraft } from './state'
import type { GameSummary, TaggedRally, TaggerDraft } from './types'
import { YouTubePlayer, type YouTubePlayerHandle } from './YouTubePlayer'
import { extractVideoId } from './youtube'

const seededRoster = () => {
  try {
    const names = [...new Set(loadBundledSessions().sessions.flatMap((s) => s.players))]
    return names.sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

export default function TaggerApp() {
  const playerRef = useRef<YouTubePlayerHandle>(null)
  const videoColumnRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<TaggerDraft>(() => {
    const loaded = loadDraft()
    if (!loaded.roster.length) return { ...loaded, roster: seededRoster() }
    return loaded
  })
  const [won, setWon] = useState<boolean | null>(null)
  const [cause, setCause] = useState('')
  const [players, setPlayers] = useState<string[]>([])
  const [playersOverridden, setPlayersOverridden] = useState(false)
  const [notes, setNotes] = useState('')
  const [touches, setTouches] = useState<Touch[]>([])
  const [touchActive, setTouchActive] = useState(false)
  const [pendingTouchPlayer, setPendingTouchPlayer] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rosterInput, setRosterInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [panel, setPanel] = useState<'log' | 'lineups' | 'admin'>('log')
  const [seekRequest, setSeekRequest] = useState<{ seconds: number; id: number; url: string } | null>(null)

  useEffect(() => {
    saveDraft(draft)
  }, [draft])

  const patch = useCallback((p: Partial<TaggerDraft>) => setDraft((d) => ({ ...d, ...p })), [])
  const activePlan = planForSet(draft)

  const changeSet = useCallback((set: string) => {
    setDraft((current) => {
      const rotationPlans = assignSetToPlan(current.rotationPlans, set)
      const plan = planForSet({ rotationPlans, set })
      const setVideoUrl = current.rallies.find((rally) => rally.set === set && rally.youtubeUrl)?.youtubeUrl
      return {
        ...current,
        set,
        youtubeUrl: setVideoUrl || current.youtubeUrl,
        rotationPlans,
        rotations: plan.rotations,
        lineups: plan.lineups,
        rotation: plan.rotations.includes(current.rotation) ? current.rotation : plan.rotations[0],
      }
    })
  }, [])

  const patchActivePlan = useCallback(
    (
      patchPlan: Partial<{
        rotations: string[]
        lineups: TaggerDraft['lineups']
      }>,
      rotation?: string,
    ) => {
      setDraft((current) => {
        const plan = planForSet(current)
        const rotationPlans = updateRotationPlan(current.rotationPlans, plan.id, patchPlan)
        const updated = rotationPlans.find((candidate) => candidate.id === plan.id) ?? plan
        return {
          ...current,
          rotationPlans,
          rotations: updated.rotations,
          lineups: updated.lineups,
          rotation: rotation ?? (updated.rotations.includes(current.rotation) ? current.rotation : updated.rotations[0]),
        }
      })
    },
    [],
  )

  const inferredOutcome = inferTouchOutcome(draft.serving, won, touches)
  const lastTouchPlayer = inferLastTouchPlayer(touches)
  const effectiveCause = cause || inferredOutcome?.cause || ''
  const suggestedPlayers = inferredOutcome?.players ?? (lastTouchPlayer ? [lastTouchPlayer] : [])
  const effectivePlayers = playersOverridden ? players : suggestedPlayers
  const canCommit = won !== null && !!effectiveCause && !!draft.rotation && !!draft.set

  const trackedScore = useMemo(() => {
    const bySet = new Map<string, { us: number; them: number }>()
    for (const r of draft.rallies) {
      const cur = bySet.get(r.set) ?? { us: 0, them: 0 }
      if (r.won) cur.us += 1
      else cur.them += 1
      bySet.set(r.set, cur)
    }
    return bySet
  }, [draft.rallies])

  const resetTouchState = useCallback(() => {
    setTouches([])
    setTouchActive(false)
    setPendingTouchPlayer(null)
    setPlayersOverridden(false)
  }, [])

  const commit = useCallback(() => {
    if (!canCommit || won === null) return
    const videoSeconds = playerRef.current?.getCurrentTime() ?? 0

    const rally: TaggedRally = {
      id: crypto.randomUUID(),
      videoSeconds,
      youtubeUrl: draft.youtubeUrl.trim(),
      set: draft.set,
      serving: draft.serving,
      won,
      cause: effectiveCause,
      players: [...effectivePlayers],
      rotation: draft.rotation,
      notes: notes.trim(),
      touches: [...touches],
    }

    const next = advanceAfterRally({
      serving: draft.serving,
      won,
      rotation: draft.rotation,
      rotations: activePlan.rotations,
      isFirstRallyOfSet: !draft.rallies.some((existing) => existing.set === draft.set),
    })
    setDraft((d) => ({
      ...d,
      rallies: [...d.rallies, rally],
      serving: next.serving,
      rotation: next.rotation,
    }))
    setWon(null)
    setCause('')
    setPlayers([])
    setNotes('')
    resetTouchState()
    setSelectedId(rally.id)
  }, [
    canCommit,
    won,
    effectiveCause,
    effectivePlayers,
    notes,
    touches,
    draft.set,
    draft.serving,
    draft.rotation,
    draft.rallies,
    activePlan.rotations,
    draft.youtubeUrl,
    resetTouchState,
  ])

  const onTouchRecord = useCallback(
    (skill: TouchSkill, quality: 0 | 1 | 2 | 3) => {
      if (!pendingTouchPlayer) return
      setTouches((prev) => [...prev, { player: pendingTouchPlayer, skill, quality }])
      setPendingTouchPlayer(null)
    },
    [pendingTouchPlayer],
  )

  const onTouchUpdate = useCallback((index: number, touch: Touch) => {
    setTouches((prev) => prev.map((existing, i) => (i === index ? touch : existing)))
  }, [])

  const onTouchRemove = useCallback((index: number) => {
    setTouches((prev) => prev.filter((_, i) => i !== index))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      } else if (e.key === 'y' || e.key === 'Y') {
        setWon(true)
        setCause('')
      } else if (e.key === 'n' || e.key === 'N') {
        setWon(false)
        setCause('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit])

  const addRosterName = () => {
    const name = rosterInput.trim()
    if (!name) return
    if (draft.roster.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setRosterInput('')
      return
    }
    patch({ roster: [...draft.roster, name].sort((a, b) => a.localeCompare(b)) })
    setRosterInput('')
  }

  const csv = useMemo(
    () =>
      exportTaggerCsv({
        rallies: draft.rallies,
        youtubeUrl: draft.youtubeUrl,
        videoTitle: draft.videoTitle,
        lineups: activePlan.lineups,
        rotationPlans: draft.rotationPlans,
        officialScores: draft.officialScores.filter((s) => s.us > 0 || s.them > 0),
      }),
    [draft],
  )

  const filename = `${draft.date || 'match'}.csv`

  const copyCsv = async () => {
    await navigator.clipboard.writeText(csv)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const resetSession = () => {
    if (draft.rallies.length && !confirm('Clear this tagging session? This cannot be undone.')) return
    clearDraft()
    setDraft({ ...loadDraft(), roster: seededRoster().length ? seededRoster() : draft.roster })
    setWon(null)
    setCause('')
    setPlayers([])
    setNotes('')
    resetTouchState()
    setSelectedId(null)
  }

  const importCsv = (importFilename: string, contents: string, sha: string) => {
    const imported = importTaggerCsv(importFilename, contents, sha)
    setDraft(imported.draft)
    setWon(null)
    setCause('')
    setPlayers([])
    setNotes('')
    resetTouchState()
    setSelectedId(null)
    return { rallyCount: imported.draft.rallies.length, warnings: imported.warnings }
  }

  const videoOk = !!extractVideoId(draft.youtubeUrl)

  return (
    <div className="tagger-app">
      <header className="tagger-top">
        <div>
          <h1>Rally tagger</h1>
          <div className="sub">
            Sundays Didn&apos;t Work For Us · tag while watching, export CSV into{' '}
            <code>data/</code>
          </div>
          <div className="tagger-nav">
            <a className="chip" href="/">
              Home
            </a>
            <a className="chip" href="/stats">
              Dashboard
            </a>
            <a className="chip" href="/film">
              Error film
            </a>
            <a className="chip" href="/highlights">
              Highlights
            </a>
            <a className="chip" href="/glossary">
              Glossary
            </a>
          </div>
        </div>
        <div className="badge-row">
          <div className="record-chip">
            <span className="big">{draft.rallies.length}</span>
            <span className="lbl">rallies</span>
          </div>
          {[...trackedScore.entries()].map(([set, sc]) => (
            <div className="record-chip" key={set}>
              <span className="big" style={{ fontSize: 18 }}>
                {sc.us}–{sc.them}
              </span>
              <span className="lbl">set {set}</span>
            </div>
          ))}
          <button
            type="button"
            className="chip primary"
            onClick={() => downloadCsv(filename, csv)}
            disabled={!draft.rallies.length}
          >
            Download CSV
          </button>
          <button type="button" className="chip" onClick={copyCsv} disabled={!draft.rallies.length}>
            {copied ? 'Copied' : 'Copy CSV'}
          </button>
          <button type="button" className="chip" onClick={resetSession}>
            New session
          </button>
        </div>
      </header>

      <section className="card tagger-setup">
        <div className="tagger-setup-grid">
          <label>
            <span className="filter-label">Match date</span>
            <input
              className="search"
              type="date"
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>
          <label style={{ gridColumn: 'span 2' }}>
            <span className="filter-label">YouTube URL (this set&apos;s film)</span>
            <input
              className="search"
              value={draft.youtubeUrl}
              onChange={(e) => patch({ youtubeUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=… — change when you switch sets"
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>
          <label>
            <span className="filter-label">Video note (optional)</span>
            <input
              className="search"
              value={draft.videoTitle}
              onChange={(e) => patch({ videoTitle: e.target.value })}
              placeholder="Game 1 title / recap link"
              style={{ width: '100%', marginTop: 6 }}
            />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <span className="filter-label">Roster</span>
          <div className="filter-group" style={{ marginTop: 6 }}>
            {draft.roster.map((name) => (
              <button
                key={name}
                type="button"
                className="chip on"
                onClick={() => patch({ roster: draft.roster.filter((n) => n !== name) })}
                title="Remove from roster"
              >
                {name} ×
              </button>
            ))}
            <input
              className="search"
              style={{ minWidth: 140 }}
              value={rosterInput}
              placeholder="Add player"
              onChange={(e) => setRosterInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRosterName()
                }
              }}
            />
            <button type="button" className="chip" onClick={addRosterName}>
              Add
            </button>
          </div>
        </div>
        {!videoOk && draft.youtubeUrl && (
          <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
            Could not read a video id from that URL.
          </div>
        )}
      </section>

      <div className="tagger-main">
        <div ref={videoColumnRef} className="tagger-video-col">
          <YouTubePlayer ref={playerRef} url={draft.youtubeUrl} seekRequest={seekRequest} />
          <div className="tagger-transport">
            <button type="button" className="chip" onClick={() => playerRef.current?.pause()}>
              Pause
            </button>
            <button type="button" className="chip" onClick={() => playerRef.current?.play()}>
              Play
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                const t = playerRef.current?.getCurrentTime() ?? 0
                playerRef.current?.seekTo(Math.max(0, t - 2))
              }}
            >
              −2s
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                const t = playerRef.current?.getCurrentTime() ?? 0
                playerRef.current?.seekTo(t + 2)
              }}
            >
              +2s
            </button>
            <span className="faint" style={{ fontSize: 12 }}>
              Y / N for Won / Lost · Enter to commit · touches: o = their ball, name + Enter, then v2 / r2 / s3…
            </span>
          </div>
        </div>

        <div className="tagger-form-col card">
          <RallyForm
            set={draft.set}
            rotation={draft.rotation}
            rotations={activePlan.rotations}
            serving={draft.serving}
            won={won}
            cause={effectiveCause}
            players={effectivePlayers}
            notes={notes}
            roster={draft.roster}
            canCommit={canCommit}
            touches={touches}
            touchActive={touchActive}
            pendingTouchPlayer={pendingTouchPlayer}
            onChange={(p) => {
              if (p.set !== undefined) changeSet(p.set)
              if (p.rotation !== undefined) patch({ rotation: p.rotation })
              if (p.serving !== undefined) patch({ serving: p.serving })
              if (p.won !== undefined) setWon(p.won)
              if (p.cause !== undefined) setCause(p.cause)
              if (p.players !== undefined) {
                setPlayers(p.players)
                setPlayersOverridden(true)
              }
              if (p.notes !== undefined) setNotes(p.notes)
            }}
            onCommit={commit}
            onNextRotation={() => patch({ rotation: nextRotation(draft.rotation, activePlan.rotations) })}
            onAddRotation={() => {
              const next = addRotation(activePlan.rotations, activePlan.lineups)
              patchActivePlan({ rotations: next.rotations, lineups: next.lineups }, next.added)
            }}
            onRemoveRotation={(label) => {
              const next = removeRotation(label, activePlan.rotations, activePlan.lineups, draft.rotation)
              patchActivePlan({ rotations: next.rotations, lineups: next.lineups }, next.rotation)
            }}
            onTouchStart={() => setTouchActive(true)}
            onTouchStop={() => {
              setTouchActive(false)
              setPendingTouchPlayer(null)
            }}
            onTouchSelectPlayer={setPendingTouchPlayer}
            onTouchRecord={onTouchRecord}
            onTouchUpdate={onTouchUpdate}
            onTouchRemove={onTouchRemove}
            onTouchOpp={() => setTouches((prev) => [...prev, { opp: true }])}
            onTouchUndo={() => setTouches((prev) => prev.slice(0, -1))}
            onTouchClear={() => {
              setTouches([])
              setPendingTouchPlayer(null)
            }}
          />
        </div>
      </div>

      <GameSummaryPanel
        draft={draft}
        onSummary={(gameSummary: GameSummary | null) => patch({ gameSummary })}
      />

      <section className="card" style={{ marginTop: 14 }}>
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button type="button" className={`tab ${panel === 'log' ? 'on' : ''}`} onClick={() => setPanel('log')}>
            Rally log
          </button>
          <button type="button" className={`tab ${panel === 'lineups' ? 'on' : ''}`} onClick={() => setPanel('lineups')}>
            Line-ups & scores
          </button>
          <button type="button" className={`tab ${panel === 'admin' ? 'on' : ''}`} onClick={() => setPanel('admin')}>
            Repo / admin
          </button>
        </div>
        {panel === 'log' ? (
          <RallyLog
            rallies={draft.rallies}
            rotations={activePlan.rotations}
            roster={draft.roster}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={(id) => {
              setDraft((d) => ({ ...d, rallies: d.rallies.filter((r) => r.id !== id) }))
              if (selectedId === id) setSelectedId(null)
            }}
            onSeek={(rally) => {
              const targetUrl = rally.youtubeUrl || draft.youtubeUrl
              setDraft((current) => {
                const rotationPlans = assignSetToPlan(current.rotationPlans, rally.set)
                const plan = planForSet({ rotationPlans, set: rally.set })
                return {
                  ...current,
                  set: rally.set,
                  youtubeUrl: targetUrl || current.youtubeUrl,
                  rotationPlans,
                  rotations: plan.rotations,
                  lineups: plan.lineups,
                  rotation: plan.rotations.includes(rally.rotation) ? rally.rotation : plan.rotations[0],
                }
              })
              setSeekRequest((current) => ({
                seconds: rally.videoSeconds,
                id: (current?.id ?? 0) + 1,
                url: targetUrl,
              }))
              requestAnimationFrame(() =>
                videoColumnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              )
            }}
            onUpdate={(id, patch) => {
              setDraft((d) => ({
                ...d,
                rallies: d.rallies.map((r) => (r.id === id ? { ...r, ...patch } : r)),
              }))
            }}
          />
        ) : panel === 'lineups' ? (
          <LineupEditor
            lineups={activePlan.lineups}
            activeSet={draft.set}
            planLabel={activePlan.label}
            sharedSets={activePlan.sets}
            roster={draft.roster}
            officialScores={draft.officialScores}
            setsSeen={[...trackedScore.keys()]}
            onChangeLineups={(lineups) => patchActivePlan({ lineups })}
            onChangeScores={(officialScores) => patch({ officialScores })}
            onCreateSetRotation={() => {
              setDraft((current) => {
                const source = planForSet(current)
                const currentIndex = Math.max(0, source.rotations.indexOf(current.rotation))
                const next = createPlanForSet(current.rotationPlans, current.set, source.id)
                const rotation = next.plan.rotations[currentIndex] ?? next.plan.rotations[0]
                const relabeledRotations = new Map(
                  source.rotations.map((sourceRotation, index) => [
                    sourceRotation,
                    next.plan.rotations[index] ?? sourceRotation,
                  ]),
                )
                return {
                  ...current,
                  rotationPlans: next.plans,
                  rotations: next.plan.rotations,
                  lineups: next.plan.lineups,
                  rotation,
                  rallies: current.rallies.map((rally) =>
                    rally.set === current.set && relabeledRotations.has(rally.rotation)
                      ? { ...rally, rotation: relabeledRotations.get(rally.rotation)! }
                      : rally,
                  ),
                }
              })
            }}
            onRemoveRotation={(label) => {
              const next = removeRotation(label, activePlan.rotations, activePlan.lineups, draft.rotation)
              patchActivePlan({ rotations: next.rotations, lineups: next.lineups }, next.rotation)
            }}
          />
        ) : (
          <RepoAdmin
            filename={filename}
            csv={csv}
            draft={draft}
            onImport={importCsv}
            onSummaryLoaded={(gameSummary) => patch({ gameSummary })}
            onSaved={(savedFilename, sha, savedCsv) => {
              const saved = importTaggerCsv(savedFilename, savedCsv, sha).draft
              setDraft((current) => {
                const savedPlan = planForSet({ rotationPlans: saved.rotationPlans, set: current.set })
                return {
                  ...saved,
                  videoTitle: current.videoTitle,
                  gameSummary: current.gameSummary,
                  set: current.set,
                  youtubeUrl:
                    saved.rallies.find((rally) => rally.set === current.set)?.youtubeUrl ||
                    saved.youtubeUrl,
                  rotations: savedPlan.rotations,
                  lineups: savedPlan.lineups,
                  serving: current.serving,
                  rotation: savedPlan.rotations.includes(current.rotation)
                    ? current.rotation
                    : savedPlan.rotations[0],
                }
              })
            }}
          />
        )}
      </section>
    </div>
  )
}
