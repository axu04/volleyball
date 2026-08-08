import type { GameSummary } from './types'

const SECRET_KEY = 'volleyball-mania-tagger-secret'

export function loadTaggerSecret(): string {
  try {
    return localStorage.getItem(SECRET_KEY) ?? ''
  } catch {
    return ''
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown }
    if (data && typeof data.error === 'string') return data.error
  } catch {
    /* not JSON */
  }
  if (res.status === 404) {
    return 'Summary API not found. It only runs on the deployed site (Vercel), not `vite dev`.'
  }
  return `Request failed (${res.status}).`
}

export async function requestGameSummary(args: {
  secret: string
  digest: unknown
}): Promise<GameSummary> {
  const res = await fetch('/api/game-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as { text?: string; model?: string; generatedAt?: string }
  if (!data.text || !data.model || !data.generatedAt) {
    throw new Error('Summary response was incomplete.')
  }
  return { text: data.text, model: data.model, generatedAt: data.generatedAt }
}
