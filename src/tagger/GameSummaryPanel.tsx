import { useState } from 'react'
import { buildMatchDigest } from './matchDigest'
import { loadTaggerSecret, requestGameSummary } from './summaryApi'
import type { GameSummary, TaggerDraft } from './types'

export function GameSummaryPanel({
  draft,
  onSummary,
}: {
  draft: TaggerDraft
  onSummary: (summary: GameSummary | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const summary = draft.gameSummary ?? null
  const fromRepo = Boolean(draft.repoSource?.filename)
  const canGenerate = fromRepo && draft.rallies.length > 0

  const generate = async (replace: boolean) => {
    if (!canGenerate) return
    if (summary && !replace) return
    const secret = loadTaggerSecret()
    if (!secret) {
      setError('Enter the admin password on the Repo / admin tab first (same secret as saves).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await requestGameSummary({
        secret,
        digest: buildMatchDigest(draft),
      })
      onSummary(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card game-summary-panel">
      <header className="game-summary-head">
        <div>
          <h3>Match summary</h3>
          <div className="hint">
            {fromRepo
              ? `Film-room write-up for ${draft.repoSource!.filename} · save to repo to keep it`
              : 'Open a session from Repo / admin first — summaries are per saved game'}
          </div>
        </div>
        <div className="badge-row">
          {!summary ? (
            <button
              type="button"
              className="chip primary"
              disabled={busy || !canGenerate}
              onClick={() => void generate(false)}
            >
              {busy ? 'Writing…' : 'Generate summary'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="chip"
                disabled={busy || !canGenerate}
                onClick={() => void generate(true)}
              >
                {busy ? 'Writing…' : 'Regenerate'}
              </button>
              <button type="button" className="chip" disabled={busy} onClick={() => onSummary(null)}>
                Clear
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="notice" style={{ marginBottom: summary ? 12 : 0 }}>
          {error}
        </div>
      )}

      {summary && (
        <div className="game-summary-body">
          <div className="game-summary-meta faint">
            {new Date(summary.generatedAt).toLocaleString()} · {summary.model}
          </div>
          <pre className="game-summary-text">{summary.text}</pre>
        </div>
      )}

      {!summary && !error && (
        <div className="muted" style={{ fontSize: 13 }}>
          {!fromRepo
            ? 'Load or save this match via Repo / admin, then generate.'
            : draft.rallies.length
              ? 'Run this after the match is tagged — then Save so it sticks with the session.'
              : 'Tag some rallies first.'}
        </div>
      )}
    </section>
  )
}
