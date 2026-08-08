import { useCallback, useEffect, useState } from 'react'
import { mergeTaggerCsv } from './csvDraft'
import { formatSummaryMarkdown, parseSummaryMarkdown, summaryFilenameForDate } from './matchDigest'
import { deleteRepoCsv, formatBytes, listRepoCsvs, readRepoCsv, saveRepoCsv, type RepoFile } from './repoApi'
import type { GameSummary, TaggerDraft } from './types'

const SECRET_KEY = 'volleyball-mania-tagger-secret'

function loadSecret(): string {
  try {
    return localStorage.getItem(SECRET_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeSecret(value: string) {
  try {
    if (value) localStorage.setItem(SECRET_KEY, value)
    else localStorage.removeItem(SECRET_KEY)
  } catch {
    /* ignore */
  }
}

type Note = { kind: 'ok' | 'error'; text: string } | null

/**
 * Admin panel: save the current tagging session straight into the repo's `data/` folder,
 * and list / delete the CSVs already there. Everything routes through `/api/data`, so each
 * save and delete is a git commit — deleted files stay recoverable in history.
 */
export function RepoAdmin({
  filename,
  csv,
  draft,
  onImport,
  onSaved,
  onSummaryLoaded,
}: {
  filename: string
  csv: string
  draft: TaggerDraft
  onImport: (filename: string, csv: string, sha: string) => { rallyCount: number; warnings: string[] }
  onSaved: (filename: string, sha: string, csv: string) => void
  onSummaryLoaded?: (summary: GameSummary | null) => void
}) {
  const [secret, setSecret] = useState<string>(loadSecret)
  const [files, setFiles] = useState<RepoFile[]>([])
  const [repoLabel, setRepoLabel] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [note, setNote] = useState<Note>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const result = await listRepoCsvs()
      setFiles(result.files)
      setRepoLabel(result.repo ? `${result.repo}${result.branch ? ` · ${result.branch}` : ''}` : '')
    } catch (err) {
      setListError(err instanceof Error ? err.message : String(err))
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const onSecretChange = (value: string) => {
    setSecret(value)
    storeSecret(value)
  }

  const alreadyExists = files.some((f) => f.name.toLowerCase() === filename.toLowerCase())
  const rallyCount = draft.rallies.length

  const onSave = async () => {
    if (!csv.trim() || !rallyCount) return
    if (!secret) {
      setNote({ kind: 'error', text: 'Enter the admin password first.' })
      return
    }
    setSaving(true)
    setNote(null)
    try {
      let csvToSave = csv
      let mergedNote = ''
      let expectedSha: string | undefined
      if (alreadyExists) {
        const existing = await readRepoCsv(filename)
        const merged = mergeTaggerCsv(filename, existing.csv, draft)
        if (merged.conflictingSets.length) {
          throw new Error(
            `Both this browser draft and the repository changed set(s) ${merged.conflictingSets.join(
              ', ',
            )}. Download this draft for safekeeping, then reopen the latest file and reconcile those set(s). Nothing was overwritten.`,
          )
        }
        if (!merged.changes.length && !merged.lineupsChanged) {
          onSaved(filename, existing.sha, existing.csv)
          const remoteNote = merged.remoteChangedSets.length
            ? ` Repository changes in set(s) ${merged.remoteChangedSets.join(', ')} are already preserved.`
            : ''
          // CSV unchanged — still push a generated match summary if we have one.
          if (draft.gameSummary?.text) {
            const summaryName = summaryFilenameForDate(draft.date)
            await saveRepoCsv({
              filename: summaryName,
              csv: formatSummaryMarkdown(draft.gameSummary, draft.date),
              secret,
            })
            setNote({
              kind: 'ok',
              text: `${filename} already matches this draft.${remoteNote} Saved ${summaryName}.`,
            })
            await refresh()
            return
          }
          setNote({ kind: 'ok', text: `${filename} already matches this draft.${remoteNote} Nothing to save.` })
          return
        }
        csvToSave = merged.csv
        expectedSha = existing.sha
        const changeLines = merged.changes.map(
          (change) => {
            if (!change.ralliesChanged && change.lineupChanged) return `Update set ${change.set} line-up`
            return change.savedRallies
              ? `Replace set ${change.set}: ${change.savedRallies} saved rallies → ${change.draftRallies} edited rallies`
              : `Append new set ${change.set}: ${change.draftRallies} rallies`
          },
        )
        const preserveLine = merged.preservedSets.length
          ? `\nPreserving saved set(s): ${merged.preservedSets.join(', ')}.`
          : ''
        const lineupLine = merged.lineupsChanged ? '\nUpdate line-ups.' : ''
        const remoteLine = merged.remoteChangedSets.length
          ? `\nPreserve newer repository changes in set(s): ${merged.remoteChangedSets.join(', ')}.`
          : ''
        if (
          !confirm(
            `Save changes to ${filename}?\n\n${changeLines.join('\n')}${lineupLine}${preserveLine}${remoteLine}\n\nThe previous version remains recoverable in Git history.`,
          )
        ) {
          return
        }
        if (merged.preservedSets.length) {
          mergedNote = ` Preserved saved set${merged.preservedSets.length === 1 ? '' : 's'} ${merged.preservedSets.join(', ')}.`
        }
      }
      const saved = await saveRepoCsv({ filename, csv: csvToSave, secret, expectedSha })
      onSaved(filename, saved.sha, csvToSave)
      let summaryNote = ''
      if (draft.gameSummary?.text) {
        const summaryName = summaryFilenameForDate(draft.date)
        await saveRepoCsv({
          filename: summaryName,
          csv: formatSummaryMarkdown(draft.gameSummary, draft.date),
          secret,
        })
        summaryNote = ` Also saved ${summaryName}.`
      }
      setNote({
        kind: 'ok',
        text: `Saved ${filename} to the repo.${mergedNote}${summaryNote} Vercel will redeploy; the dashboard updates once that finishes.`,
      })
      await refresh()
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  const onOpen = async (name: string) => {
    if (rallyCount && !confirm(`Replace the current browser draft with ${name}?`)) return
    setImporting(name)
    setNote(null)
    try {
      const existing = await readRepoCsv(name)
      const result = onImport(name, existing.csv, existing.sha)
      const date = name.replace(/\.csv$/i, '')
      try {
        const summaryFile = await readRepoCsv(summaryFilenameForDate(date))
        onSummaryLoaded?.(parseSummaryMarkdown(summaryFile.csv))
      } catch {
        onSummaryLoaded?.(null)
      }
      const warningText = result.warnings.length ? ` ${result.warnings.length} parser warning(s) were reported.` : ''
      setNote({
        kind: 'ok',
        text: `Loaded ${name} with ${result.rallyCount} rallies. Edit it under Rally log, then save to merge it back.${warningText}`,
      })
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setImporting(null)
    }
  }

  const onDelete = async (name: string) => {
    if (!secret) {
      setNote({ kind: 'error', text: 'Enter the admin password first.' })
      return
    }
    if (!confirm(`Delete ${name} from the repo? It stays recoverable in git history.`)) return
    setDeleting(name)
    setNote(null)
    try {
      await deleteRepoCsv({ filename: name, secret })
      setNote({ kind: 'ok', text: `Deleted ${name}. Recoverable via git history if needed.` })
      await refresh()
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="repo-admin">
      <div className="repo-admin-head">
        <div>
          <h3 style={{ margin: 0 }}>Repo data files</h3>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
            {repoLabel ? `Committing to ${repoLabel}. ` : ''}
            Saves and deletes are git commits — nothing is ever truly lost.
          </div>
        </div>
        <button type="button" className="chip" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <label style={{ display: 'block', marginTop: 12 }}>
        <span className="filter-label">Admin password</span>
        <input
          className="search"
          type="password"
          value={secret}
          autoComplete="off"
          placeholder="Set in Vercel as TAGGER_SECRET"
          onChange={(e) => onSecretChange(e.target.value)}
          style={{ width: '100%', maxWidth: 320, marginTop: 6 }}
        />
      </label>

      <div className="repo-admin-save">
        <button
          type="button"
          className="chip primary"
          onClick={() => void onSave()}
          disabled={saving || !rallyCount}
          title={!rallyCount ? 'Tag at least one rally first' : `Write data/${filename}`}
        >
          {saving ? 'Saving…' : `Save this session → data/${filename}`}
        </button>
        {alreadyExists && (
          <span className="faint" style={{ fontSize: 12 }}>
            New sets append safely. Replacing an existing set requires confirmation.
          </span>
        )}
      </div>

      {note && (
        <div className={note.kind === 'ok' ? 'notice repo-ok' : 'notice repo-err'} style={{ marginTop: 12 }}>
          {note.text}
        </div>
      )}

      <div className="repo-file-list">
        {listError ? (
          <div className="notice repo-err">{listError}</div>
        ) : files.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>
            {loading ? 'Loading files…' : 'No CSVs in data/ yet.'}
          </div>
        ) : (
          <table className="repo-table">
            <thead>
              <tr>
                <th>File</th>
                <th style={{ width: 90 }}>Size</th>
                <th style={{ width: 170 }}></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.sha || f.name}>
                  <td>
                    <code>{f.name}</code>
                    {f.name.toLowerCase() === filename.toLowerCase() && (
                      <span className="faint" style={{ fontSize: 11, marginLeft: 8 }}>
                        current session
                      </span>
                    )}
                  </td>
                  <td className="faint">{formatBytes(f.size)}</td>
                  <td>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => void onOpen(f.name)}
                      disabled={importing === f.name}
                    >
                      {importing === f.name ? 'Loading…' : 'Open'}
                    </button>{' '}
                    <button
                      type="button"
                      className="chip danger"
                      onClick={() => void onDelete(f.name)}
                      disabled={deleting === f.name}
                    >
                      {deleting === f.name ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
