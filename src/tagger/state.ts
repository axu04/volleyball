import type { LineupDraft, TaggerDraft } from './types'
import { defaultRotations, emptyDraft, emptyLineups } from './types'

const KEY = 'volleyball-mania-tagger-draft-v1'

/** Fold older multi-block drafts into a single rotations + lineups list. */
function migrate(raw: Partial<TaggerDraft>): TaggerDraft {
  const base = emptyDraft()
  let rotations = raw.rotations?.length ? [...raw.rotations] : defaultRotations()
  let lineups: LineupDraft[] = raw.lineups?.length ? raw.lineups : []

  if (!lineups.length && raw.lineupBlocks?.length) {
    lineups = raw.lineupBlocks.flatMap((b) => b.lineups)
    rotations = [...new Set(lineups.map((l) => l.rotation))]
    if (!rotations.length) rotations = defaultRotations()
  }

  if (!lineups.length) lineups = emptyLineups(rotations)

  // Keep rotations and lineups aligned: every rotation has a lineup row.
  for (const rot of rotations) {
    if (!lineups.some((l) => l.rotation === rot)) {
      lineups.push({ rotation: rot, front: ['', '', ''], back: ['', '', '', ''] })
    }
  }
  lineups = lineups.filter((l) => rotations.includes(l.rotation))
  // Preserve rotation order.
  lineups = rotations.map((rot) => lineups.find((l) => l.rotation === rot)!)

  return {
    ...base,
    ...raw,
    version: 1,
    rotations,
    lineups,
    lineupBlocks: undefined,
  }
}

export function loadDraft(): TaggerDraft {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyDraft()
    const parsed = JSON.parse(raw) as Partial<TaggerDraft>
    if (parsed?.version !== 1) return emptyDraft()
    return migrate(parsed)
  } catch {
    return emptyDraft()
  }
}

export function saveDraft(draft: TaggerDraft) {
  try {
    const { lineupBlocks: _drop, ...rest } = draft
    localStorage.setItem(KEY, JSON.stringify({ ...rest, updatedAt: Date.now() }))
  } catch {
    // Quota or private mode — tagging still works in memory.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/**
 * After a rally is committed, advance sticky Serving/Receiving and Rotation the way volleyball
 * works: side-out → rotate and serve; win on serve → keep serving; lose → flip phase.
 */
export function advanceAfterRally(args: {
  serving: boolean
  won: boolean
  rotation: string
  rotations: string[]
}): { serving: boolean; rotation: string } {
  const { serving, won, rotation, rotations } = args

  if (won && !serving) {
    return { serving: true, rotation: nextRotation(rotation, rotations) }
  }
  if (won && serving) {
    return { serving: true, rotation }
  }
  return { serving: !serving, rotation }
}

/** Advance to the next label in the session's rotation list, wrapping to the first. */
export function nextRotation(rotation: string, rotations: string[]): string {
  if (!rotations.length) return rotation
  const idx = rotations.indexOf(rotation)
  if (idx < 0) return rotations[0]
  return rotations[(idx + 1) % rotations.length]
}

export function addRotation(rotations: string[], lineups: LineupDraft[]): {
  rotations: string[]
  lineups: LineupDraft[]
  added: string
} {
  const nums = rotations.map((r) => parseInt(r, 10)).filter((n) => !Number.isNaN(n))
  const next = String((nums.length ? Math.max(...nums) : 0) + 1)
  return {
    rotations: [...rotations, next],
    lineups: [...lineups, { rotation: next, front: ['', '', ''], back: ['', '', '', ''] }],
    added: next,
  }
}

export function removeRotation(
  label: string,
  rotations: string[],
  lineups: LineupDraft[],
  current: string,
): { rotations: string[]; lineups: LineupDraft[]; rotation: string } {
  if (rotations.length <= 1) return { rotations, lineups, rotation: current }
  const nextRots = rotations.filter((r) => r !== label)
  const nextLineups = lineups.filter((l) => l.rotation !== label)
  return {
    rotations: nextRots,
    lineups: nextLineups,
    rotation: current === label ? nextRots[0] : current,
  }
}
