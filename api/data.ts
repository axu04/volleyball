/**
 * Serverless endpoint that lets the /tagger admin panel read, write and delete the
 * game CSVs under `data/` straight in the GitHub repo — so every save and delete is a
 * normal git commit and nothing is ever lost (see README → "Saving to the repo").
 *
 * GET    → list `data/*.csv`, or read one with `?filename=...`. Public: the data is already public.
 * POST   → create/update `data/<file>` from a CSV body. Requires the shared secret.
 * DELETE → remove `data/<file>`.                        Requires the shared secret.
 *
 * Configuration lives entirely in server-side env vars (never shipped to the client):
 *   GITHUB_TOKEN   fine-grained PAT with "Contents: read and write" (or classic `repo`)
 *   GITHUB_REPO    "owner/name", e.g. "axu04/volleyball"
 *   GITHUB_BRANCH  target branch (optional, defaults to "main")
 *   TAGGER_SECRET  shared password required for POST/DELETE
 */

// Minimal shapes for the Vercel Node request/response so this file needs no extra deps.
interface ApiRequest {
  method?: string
  body?: unknown
  query: Record<string, string | string[] | undefined>
}
interface ApiResponse {
  status(code: number): ApiResponse
  json(data: unknown): void
  setHeader(name: string, value: string): void
}

const GITHUB_API = 'https://api.github.com'
const DATA_DIR = 'data'

interface RepoConfig {
  owner: string
  repo: string
  branch: string
  token: string
}

function getConfig(): RepoConfig | null {
  const token = process.env.GITHUB_TOKEN
  const repoFull = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'
  if (!token || !repoFull) return null
  const [owner, repo] = repoFull.split('/')
  if (!owner || !repo) return null
  return { owner, repo, branch, token }
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'volleyball-tagger',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/** Only allow a plain CSV file name inside `data/` — no paths, no traversal. */
function sanitizeFilename(name: string): string | null {
  const base = (name.split(/[\\/]/).pop() ?? '').trim()
  if (base.includes('..')) return null
  if (/^[A-Za-z0-9 ._-]+\.csv$/i.test(base)) return base
  return null
}

interface RepoFile {
  name: string
  size: number
  sha: string
  path: string
}

interface GitHubContentItem {
  name?: string
  path?: string
  sha?: string
  size?: number
  type?: string
  content?: string
  encoding?: string
}

async function githubJson(url: string, token: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: ghHeaders(token) })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: res.status, body }
}

function ghErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

async function listCsv(cfg: RepoConfig): Promise<RepoFile[]> {
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_DIR}?ref=${encodeURIComponent(cfg.branch)}`
  const { status, body } = await githubJson(url, cfg.token)
  if (status === 404) return []
  if (status < 200 || status >= 300) {
    throw new Error(ghErrorMessage(body, `GitHub responded ${status} while listing files.`))
  }
  const items = Array.isArray(body) ? (body as GitHubContentItem[]) : []
  return items
    .filter((it) => it.type === 'file' && typeof it.name === 'string' && /\.csv$/i.test(it.name))
    .map((it) => ({
      name: it.name ?? '',
      size: typeof it.size === 'number' ? it.size : 0,
      sha: it.sha ?? '',
      path: it.path ?? `${DATA_DIR}/${it.name}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function readCsv(cfg: RepoConfig, filename: string): Promise<{ filename: string; csv: string; sha: string }> {
  const path = `${DATA_DIR}/${filename}`
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/')
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encoded}?ref=${encodeURIComponent(cfg.branch)}`
  const { status, body } = await githubJson(url, cfg.token)
  if (status === 404) {
    const err = new Error(`${filename} does not exist.`)
    ;(err as { statusCode?: number }).statusCode = 404
    throw err
  }
  if (status < 200 || status >= 300) {
    throw new Error(ghErrorMessage(body, `GitHub responded ${status} while reading ${filename}.`))
  }
  const item = body as GitHubContentItem
  if (item.encoding !== 'base64' || typeof item.content !== 'string') {
    throw new Error(`GitHub did not return readable CSV content for ${filename}.`)
  }
  return {
    filename,
    csv: Buffer.from(item.content.replace(/\s/g, ''), 'base64').toString('utf8'),
    sha: item.sha ?? '',
  }
}

/** Current blob sha for a path, or null when the file does not exist yet. */
async function getSha(cfg: RepoConfig, path: string): Promise<string | null> {
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/')
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encoded}?ref=${encodeURIComponent(cfg.branch)}`
  const { status, body } = await githubJson(url, cfg.token)
  if (status === 404) return null
  if (status < 200 || status >= 300) {
    throw new Error(ghErrorMessage(body, `GitHub responded ${status} while reading ${path}.`))
  }
  if (body && typeof body === 'object' && 'sha' in body) {
    const sha = (body as { sha?: unknown }).sha
    if (typeof sha === 'string') return sha
  }
  throw new Error(`Could not read sha for ${path}.`)
}

interface WriteResult {
  path: string
  sha: string
  commit: string
  created: boolean
}

function conflict(message: string): Error {
  const err = new Error(message)
  ;(err as { statusCode?: number }).statusCode = 409
  return err
}

async function saveCsv(
  cfg: RepoConfig,
  filename: string,
  csv: string,
  expectedSha: string | undefined,
): Promise<WriteResult> {
  const path = `${DATA_DIR}/${filename}`
  const existingSha = await getSha(cfg, path)
  if (existingSha && expectedSha !== existingSha) {
    throw conflict(`${filename} changed in the repo. Refresh or reopen it before saving; no data was overwritten.`)
  }
  if (!existingSha && expectedSha) {
    throw conflict(`${filename} was removed or renamed. Refresh before saving; no data was overwritten.`)
  }
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/')
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encoded}`
  const payload: Record<string, unknown> = {
    message: `tagger: ${existingSha ? 'update' : 'save'} ${filename}`,
    content: Buffer.from(csv, 'utf8').toString('base64'),
    branch: cfg.branch,
  }
  if (existingSha) payload.sha = existingSha

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(ghErrorMessage(body, `GitHub responded ${res.status} while saving ${filename}.`))
  }
  return {
    path,
    sha: body?.content?.sha ?? '',
    commit: body?.commit?.sha ?? '',
    created: !existingSha,
  }
}

async function deleteCsv(cfg: RepoConfig, filename: string): Promise<{ path: string; commit: string }> {
  const path = `${DATA_DIR}/${filename}`
  const sha = await getSha(cfg, path)
  if (!sha) {
    const err = new Error(`${filename} does not exist.`)
    ;(err as { statusCode?: number }).statusCode = 404
    throw err
  }
  const encoded = encodeURIComponent(path).replace(/%2F/g, '/')
  const url = `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encoded}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...ghHeaders(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `tagger: delete ${filename}`, sha, branch: cfg.branch }),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : {}
  if (!res.ok) {
    throw new Error(ghErrorMessage(body, `GitHub responded ${res.status} while deleting ${filename}.`))
  }
  return { path, commit: body?.commit?.sha ?? '' }
}

/** Body may arrive parsed (object) or as a raw JSON string depending on the runtime. */
function readBody(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }
  return {}
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const cfg = getConfig()
  if (!cfg) {
    res.status(500).json({ error: 'Server not configured: set GITHUB_TOKEN and GITHUB_REPO.' })
    return
  }

  try {
    if (req.method === 'GET') {
      const requested = firstQuery(req.query.filename)
      if (requested) {
        const filename = sanitizeFilename(requested)
        if (!filename) {
          res.status(400).json({ error: 'Invalid filename. Use a plain .csv name.' })
          return
        }
        res.status(200).json(await readCsv(cfg, filename))
        return
      }
      const files = await listCsv(cfg)
      res.status(200).json({ files, repo: `${cfg.owner}/${cfg.repo}`, branch: cfg.branch })
      return
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
      const secret = process.env.TAGGER_SECRET
      if (!secret) {
        res.status(500).json({ error: 'Server not configured: set TAGGER_SECRET to enable writes.' })
        return
      }
      const body = readBody(req.body)
      const provided = (body.secret as string | undefined) ?? firstQuery(req.query.secret)
      if (provided !== secret) {
        res.status(401).json({ error: 'Wrong password.' })
        return
      }

      const rawName = (body.filename as string | undefined) ?? firstQuery(req.query.filename) ?? ''
      const filename = sanitizeFilename(String(rawName))
      if (!filename) {
        res.status(400).json({ error: 'Invalid filename. Use a plain .csv name.' })
        return
      }

      if (req.method === 'POST') {
        const csv =
          typeof body.content === 'string'
            ? body.content
            : typeof body.csv === 'string'
              ? body.csv
              : null
        if (csv === null || !csv.trim()) {
          res.status(400).json({ error: 'Missing file content.' })
          return
        }
        const expectedSha = typeof body.expectedSha === 'string' ? body.expectedSha : undefined
        const result = await saveCsv(cfg, filename, csv, expectedSha)
        res.status(200).json({ ok: true, ...result })
        return
      }

      // DELETE
      const result = await deleteCsv(cfg, filename)
      res.status(200).json({ ok: true, ...result })
      return
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    res.status(405).json({ error: 'Method not allowed.' })
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500
    res.status(statusCode).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
