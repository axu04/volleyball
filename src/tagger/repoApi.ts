/** Client wrappers around the `/api/data` serverless endpoint (repo CSV admin). */

export interface RepoFile {
  name: string
  size: number
  sha: string
  path: string
}

export interface RepoListResult {
  files: RepoFile[]
  repo?: string
  branch?: string
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown }
    if (data && typeof data.error === 'string') return data.error
  } catch {
    /* not JSON — fall through */
  }
  if (res.status === 404) {
    return 'Admin API not found. It only runs on the deployed site (Vercel), not `vite dev`.'
  }
  return `Request failed (${res.status}).`
}

export async function listRepoCsvs(): Promise<RepoListResult> {
  const res = await fetch('/api/data', { method: 'GET' })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as RepoListResult
}

export async function saveRepoCsv(args: { filename: string; csv: string; secret: string }): Promise<void> {
  const res = await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function deleteRepoCsv(args: { filename: string; secret: string }): Promise<void> {
  const res = await fetch('/api/data', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
