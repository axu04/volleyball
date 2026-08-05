import type { LineupDraft } from './types'

/** Front L/M/R, back L/M/R, plus one sub off court. */
export function emptyCourtLineup(rotation: string): LineupDraft {
  return {
    rotation,
    front: ['', '', ''],
    back: ['', '', ''],
    sub: '',
  }
}

export function normalizeLineup(l: LineupDraft): LineupDraft {
  const front = [l.front?.[0] ?? '', l.front?.[1] ?? '', l.front?.[2] ?? '']
  const rawBack = [...(l.back ?? [])]
  let sub = l.sub ?? ''
  // Older drafts stuffed the sub as a 4th back-row name.
  if (!sub && rawBack.length > 3) sub = rawBack[3] ?? ''
  const back = [rawBack[0] ?? '', rawBack[1] ?? '', rawBack[2] ?? '']
  return { rotation: l.rotation, front, back, sub }
}

export function isLineupComplete(l: LineupDraft): boolean {
  const n = normalizeLineup(l)
  return n.front.every(Boolean) && n.back.every(Boolean) && !!n.sub
}

/**
 * One clockwise step for a 6+1 squad.
 * Sub enters front-left; left-back sits out.
 * Path: sub → LF → MF → RF → RB → MB → LB → sub
 */
export function rotateClockwise(l: LineupDraft): LineupDraft {
  const n = normalizeLineup(l)
  const [lf, mf, rf] = n.front
  const [lb, mb, rb] = n.back
  return {
    rotation: n.rotation,
    front: [n.sub, lf, mf],
    back: [mb, rb, rf],
    sub: lb,
  }
}

/** Apply `steps` clockwise rotations (negative = counter-clockwise). */
export function rotateBy(l: LineupDraft, steps: number, period = 7): LineupDraft {
  let cur = normalizeLineup(l)
  const n = ((steps % period) + period) % period
  for (let i = 0; i < n; i++) cur = rotateClockwise(cur)
  return cur
}

/**
 * After editing `sourceIdx`, if that lineup is complete, derive every other
 * rotation by clockwise steps from it. Incomplete edits only touch the source row.
 */
export function autofillLineupsFrom(sourceIdx: number, lineups: LineupDraft[]): LineupDraft[] {
  if (sourceIdx < 0 || sourceIdx >= lineups.length) return lineups.map(normalizeLineup)
  const normalized = lineups.map(normalizeLineup)
  const source = normalized[sourceIdx]
  if (!isLineupComplete(source)) return normalized

  const period = lineups.length
  return normalized.map((row, idx) => {
    const steps = (idx - sourceIdx + period) % period
    const rotated = rotateBy(source, steps, period)
    return { ...rotated, rotation: row.rotation }
  })
}
