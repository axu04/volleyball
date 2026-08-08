import { parseSession } from './parse'
import { dateFromSummaryFile, parseSummaryMarkdown, type GameSummary } from './summaries'
import type { Session } from './types'

/** Every CSV in /data is picked up automatically — drop a new sheet in and it appears. */
const files = import.meta.glob('../../data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const summaryFiles = import.meta.glob('../../data/*.summary.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface LoadResult {
  sessions: Session[]
  errors: string[]
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.fileName.localeCompare(b.fileName))
}

function loadSummaryMap(): Map<string, GameSummary> {
  const map = new Map<string, GameSummary>()
  for (const [path, text] of Object.entries(summaryFiles)) {
    const name = path.split('/').pop() ?? path
    const date = dateFromSummaryFile(name)
    if (!date) continue
    const parsed = parseSummaryMarkdown(text)
    if (parsed) map.set(date, parsed)
  }
  return map
}

export function loadBundledSessions(): LoadResult {
  const sessions: Session[] = []
  const errors: string[] = []
  const summaries = loadSummaryMap()

  for (const [path, text] of Object.entries(files)) {
    const name = path.split('/').pop() ?? path
    try {
      const session = parseSession(name, text)
      sessions.push({
        ...session,
        summary: summaries.get(session.date) ?? null,
      })
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return { sessions: sortSessions(sessions), errors }
}

export async function loadDroppedFiles(fileList: File[]): Promise<LoadResult> {
  const sessions: Session[] = []
  const errors: string[] = []

  for (const file of fileList) {
    if (!/\.csv$/i.test(file.name)) continue
    try {
      sessions.push(parseSession(file.name, await file.text()))
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return { sessions: sortSessions(sessions), errors }
}

export function mergeSessions(a: Session[], b: Session[]): Session[] {
  const map = new Map(a.map((s) => [s.id, s]))
  for (const s of b) map.set(s.id, s)
  return sortSessions([...map.values()])
}
