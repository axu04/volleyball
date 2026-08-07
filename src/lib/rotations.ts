import { compareLabels } from './parse'
import type { Rally, RotationLineup, Session } from './types'

export interface RotationGroupSource {
  sessionId: string
  sessionLabel: string
  date: string
  sets: string[]
  rotationLabels: string[]
}

export interface RotationGroup {
  id: string
  label: string
  family: string | null
  rotationLabels: string[]
  lineup: RotationLineup | null
  rallies: Rally[]
  sources: RotationGroupSource[]
}

/** Points won before our rotation plays the ball. */
export function isServeOnlyPoint(rally: Rally): boolean {
  return rally.cause === 'aced_on_them_suckas' || (rally.cause === 'opp_err' && rally.players.length === 0)
}

function normalizedNames(lineup: RotationLineup): string[] {
  return [...lineup.front, ...lineup.back, lineup.sub].map((name) => name.trim().toLowerCase())
}

function positionSignature(lineup: RotationLineup): string {
  return normalizedNames(lineup).join('|')
}

/**
 * Canonicalize the seven-player rotation ring so every court position from the same ordered
 * lineup belongs to one family. The ring follows sub → LF → MF → RF → RB → MB → LB.
 */
function familySignature(lineup: RotationLineup): string {
  const [lf, mf, rf, lb, mb, rb, sub] = normalizedNames(lineup)
  const ring = [sub, lf, mf, rf, rb, mb, lb]
  const variants = ring.map((_, index) => [...ring.slice(index), ...ring.slice(0, index)].join('|'))
  return variants.sort()[0]
}

function familyName(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

interface DraftGroup {
  id: string
  familySignature: string | null
  lineup: RotationLineup | null
  rallies: Rally[]
  rotationLabels: Set<string>
  firstDate: string
}

export function groupRotations(rallies: Rally[], sessions: Session[]): RotationGroup[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const lineupsBySession = new Map<string, Map<string, RotationLineup>>()
  for (const session of sessions) {
    const byRotation = new Map<string, RotationLineup>()
    for (const lineup of session.lineups) {
      if (!byRotation.has(lineup.rotation)) byRotation.set(lineup.rotation, lineup)
    }
    lineupsBySession.set(session.id, byRotation)
  }

  const drafts = new Map<string, DraftGroup>()
  for (const rally of rallies) {
    if (rally.rotation === null) continue
    const session = sessionById.get(rally.sessionId)
    const lineup = lineupsBySession.get(rally.sessionId)?.get(rally.rotation) ?? null
    const family = lineup ? familySignature(lineup) : null
    const id = lineup ? `lineup:${positionSignature(lineup)}` : `unmapped:${rally.sessionId}:${rally.rotation}`
    const draft = drafts.get(id) ?? {
      id,
      familySignature: family,
      lineup,
      rallies: [],
      rotationLabels: new Set<string>(),
      firstDate: session?.date ?? rally.date,
    }
    draft.rallies.push(rally)
    draft.rotationLabels.add(rally.rotation)
    if ((session?.date ?? rally.date) < draft.firstDate) draft.firstDate = session?.date ?? rally.date
    drafts.set(id, draft)
  }

  const orderedFamilies = [
    ...new Set(
      [...drafts.values()]
        .map((draft) => draft.familySignature)
        .filter((signature): signature is string => signature !== null),
    ),
  ]
    .map((signature) => ({
      signature,
      firstDate: Math.min(
        ...[...drafts.values()]
          .filter((draft) => draft.familySignature === signature)
          .map((draft) => Date.parse(draft.firstDate)),
      ),
    }))
    .sort((a, b) => a.firstDate - b.firstDate || a.signature.localeCompare(b.signature))
  const familyLabels = new Map(orderedFamilies.map((entry, index) => [entry.signature, familyName(index)]))

  return [...drafts.values()]
    .map((draft) => {
      const rotationLabels = [...draft.rotationLabels].sort(compareLabels)
      const family = draft.familySignature ? (familyLabels.get(draft.familySignature) ?? null) : null
      const fallbackSession = sessionById.get(draft.rallies[0]?.sessionId ?? '')
      const label = family
        ? `${family}${rotationLabels[0]?.toUpperCase() ?? ''}`
        : `${fallbackSession?.label ?? draft.firstDate} R${rotationLabels[0]?.toUpperCase() ?? '?'}`

      const sourceMap = new Map<string, RotationGroupSource>()
      for (const rally of draft.rallies) {
        const session = sessionById.get(rally.sessionId)
        const current = sourceMap.get(rally.sessionId) ?? {
          sessionId: rally.sessionId,
          sessionLabel: session?.label ?? rally.sessionLabel,
          date: session?.date ?? rally.date,
          sets: [],
          rotationLabels: [],
        }
        if (!current.sets.includes(rally.set)) current.sets.push(rally.set)
        if (rally.rotation && !current.rotationLabels.includes(rally.rotation)) {
          current.rotationLabels.push(rally.rotation)
        }
        sourceMap.set(rally.sessionId, current)
      }
      const sources = [...sourceMap.values()]
        .map((source) => ({
          ...source,
          sets: source.sets.sort(compareLabels),
          rotationLabels: source.rotationLabels.sort(compareLabels),
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        id: draft.id,
        label,
        family,
        rotationLabels,
        lineup: draft.lineup,
        rallies: draft.rallies,
        sources,
      }
    })
    .sort((a, b) => {
      if (a.family && b.family && a.family !== b.family) return a.family.localeCompare(b.family)
      if (a.family !== b.family) return a.family ? -1 : 1
      return compareLabels(a.rotationLabels[0] ?? '', b.rotationLabels[0] ?? '')
    })
}
