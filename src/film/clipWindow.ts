import type { Rally, Session } from '../lib/types'
import { parseVideoTimestamp } from '../tagger/youtube'

export interface ClipWindow {
  start: number
  end: number
}

export interface ClipWindowOptions {
  lookback?: number
  defaultClip?: number
  maxClip?: number
  padAfter?: number
}

/**
 * Sheet timestamps mark the end of a rally. Start after the prior rally whenever possible,
 * then apply a bounded lookback so dead time and the previous point stay out of the clip.
 */
export function clipWindow(
  rally: Rally,
  session: Session,
  {
    lookback = 14,
    defaultClip = 18,
    maxClip = 28,
    padAfter = 2,
  }: ClipWindowOptions = {},
): ClipWindow | null {
  const endRaw = parseVideoTimestamp(rally.videoTimestamp)
  if (endRaw === null) return null

  const peers = session.rallies
    .filter((candidate) => candidate.set === rally.set)
    .map((candidate) => ({ rally: candidate, time: parseVideoTimestamp(candidate.videoTimestamp) }))
    .filter((candidate): candidate is { rally: Rally; time: number } => candidate.time !== null)
    .sort((a, b) => a.time - b.time || a.rally.n - b.rally.n)

  const index = peers.findIndex((candidate) => candidate.rally.id === rally.id)
  const previous = index > 0 ? peers[index - 1] : undefined

  const end = endRaw + padAfter
  let start = Math.max(0, endRaw - lookback)
  if (previous) start = Math.max(start, previous.time)
  else start = Math.max(0, endRaw - defaultClip)

  if (end <= start) start = Math.max(0, end - lookback)
  if (end - start > maxClip) start = Math.max(previous?.time ?? 0, end - maxClip)

  return { start, end: Math.max(start + 4, end) }
}
