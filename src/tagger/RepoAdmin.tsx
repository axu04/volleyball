import { useCallback, useEffect, useState } from 'react'
import { deleteRepoCsv, formatBytes, listRepoCsvs, saveRepoCsv, type RepoFile } from './repoApi'

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
  rallyCount,
}: {
  filename: string
  csv: string
  rallyCount: number
}) {
  const [secret, setSecret] = useState<string>(loadSecret)
  const [files, setFiles] = useState<RepoFile[]>([])
  const [repoLabel, setRepoLabel] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
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

  const onSave = async () => {
    if (!csv.trim() || !rallyCount) return
    if (!secret) {
      setNote({ kind: 'error', text: 'Enter the admin password first.' })
      return
    }
    if (alreadyExists && !confirm(`${filename} already exists in the repo. Overwrite it?`)) return
    setSaving(true)
    setNote(null)
    try {
      await saveRepoCsv({ filename, csv, secret })
      setNote({
        kind: 'ok',
        text: `Saved ${filename} to the repo. Vercel will redeploy; the dashboard updates once that finishes.`,
      })
      await refresh()
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
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
            Overwrites the existing {filename}.
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
                <th style={{ width: 90 }}></th>
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
