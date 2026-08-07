import { compareLabels, parseSession } from '../lib/parse'
import { emptyCourtLineup, normalizeLineup } from './lineupRotation'
import { advanceAfterRally } from './state'
import type { LineupDraft, OfficialScore, TaggedRally, TaggerDraft } from './types'
import { defaultRotations, emptyDraft } from './types'
import { parseVideoTimestamp } from './youtube'
import { exportTaggerCsv } from './exportCsv'

export interface ImportedDraft {
  draft: TaggerDraft
  warnings: string[]
}

function setFingerprint(draft: TaggerDraft, set: string): string {
  return JSON.stringify({
    rallies: draft.rallies
      .filter((rally) => rally.set === set)
      .map((rally) => ({
        videoSeconds: rally.videoSeconds,
        youtubeUrl: rally.youtubeUrl,
        set: rally.set,
        serving: rally.serving,
        won: rally.won,
        cause: rally.cause,
        players: rally.players,
        rotation: rally.rotation,
        notes: rally.notes,
        touches: rally.touches,
      })),
    score: draft.officialScores.find((score) => score.set === set) ?? null,
  })
}

function lineupsFingerprint(lineups: LineupDraft[]): string {
  return JSON.stringify(lineups.map(normalizeLineup))
}

export function repoSourceForDraft(filename: string, sha: string, draft: TaggerDraft): NonNullable<TaggerDraft['repoSource']> {
  const sets = [...new Set(draft.rallies.map((rally) => rally.set))]
  return {
    filename,
    sha,
    setFingerprints: Object.fromEntries(sets.map((set) => [set, setFingerprint(draft, set)])),
    lineupsFingerprint: lineupsFingerprint(draft.lineups),
  }
}

function hasLineupData(lineups: LineupDraft[]): boolean {
  return lineups.some((lineup) => {
    const normalized = normalizeLineup(lineup)
    return normalized.front.some(Boolean) || normalized.back.some(Boolean) || Boolean(normalized.sub)
  })
}

function importedLineups(
  rotations: string[],
  parsed: ReturnType<typeof parseSession>,
): LineupDraft[] {
  const byRotation = new Map<string, LineupDraft>()
  for (const lineup of parsed.lineups) {
    if (byRotation.has(lineup.rotation)) continue
    byRotation.set(lineup.rotation, {
      rotation: lineup.rotation,
      front: lineup.front,
      back: lineup.back,
      sub: lineup.sub,
    })
  }
  return rotations.map((rotation) => normalizeLineup(byRotation.get(rotation) ?? emptyCourtLineup(rotation)))
}

export function importTaggerCsv(filename: string, csv: string, sha = ''): ImportedDraft {
  const parsed = parseSession(filename, csv)
  const rallies: TaggedRally[] = parsed.rallies.map((rally, index) => ({
    id: `import-${index + 1}-${rally.id}`,
    videoSeconds: parseVideoTimestamp(rally.videoTimestamp) ?? 0,
    youtubeUrl: rally.youtubeUrl,
    set: rally.set,
    serving: rally.serving,
    won: rally.won,
    cause: rally.cause,
    players: rally.players,
    rotation: rally.rotation ?? '',
    notes: rally.notes,
    touches: rally.touches,
  }))

  const rotations = [
    ...new Set([
      ...parsed.lineups.map((lineup) => lineup.rotation),
      ...rallies.map((rally) => rally.rotation).filter(Boolean),
    ]),
  ].sort(compareLabels)
  if (!rotations.length) rotations.push(...defaultRotations())

  const lineups = importedLineups(rotations, parsed)
  const lastRally = rallies.at(-1)
  const set = lastRally?.set ?? parsed.sets.at(-1)?.set ?? '1'
  const next = lastRally
    ? advanceAfterRally({
        serving: lastRally.serving,
        won: lastRally.won,
        rotation: lastRally.rotation || rotations[0],
        rotations,
      })
    : { serving: true, rotation: rotations[0] }

  const officialScores: OfficialScore[] = parsed.sets.flatMap((summary) =>
    summary.officialUs === null || summary.officialThem === null
      ? []
      : [{ set: summary.set, us: summary.officialUs, them: summary.officialThem }],
  )
  const roster = [
    ...new Set([
      ...parsed.players,
      ...lineups.flatMap((lineup) => [...lineup.front, ...lineup.back, lineup.sub]).filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b))

  const draft = emptyDraft({
    date: parsed.date,
    youtubeUrl: parsed.youtubeBySet[set] ?? parsed.youtubeUrl,
    videoTitle: '',
    roster,
    set,
    rotation: next.rotation,
    rotations,
    serving: next.serving,
    rallies,
    lineups,
    officialScores,
    updatedAt: Date.now(),
  })
  if (sha) draft.repoSource = repoSourceForDraft(filename, sha, draft)

  return {
    draft,
    warnings: parsed.warnings,
  }
}

export interface MergedCsv {
  csv: string
  preservedSets: string[]
  replacedSets: string[]
  warnings: string[]
  changes: Array<{
    set: string
    savedRallies: number
    draftRallies: number
  }>
  lineupsChanged: boolean
}

export function mergeTaggerCsv(filename: string, existingCsv: string, current: TaggerDraft): MergedCsv {
  const imported = importTaggerCsv(filename, existingCsv)
  const existing = imported.draft
  const source = current.repoSource?.filename.toLowerCase() === filename.toLowerCase() ? current.repoSource : undefined
  const candidateSets = [
    ...new Set([...current.rallies.map((rally) => rally.set), ...Object.keys(source?.setFingerprints ?? {})]),
  ]
  const replacedSets = candidateSets
    .filter((set) => !source || source.setFingerprints[set] !== setFingerprint(current, set))
    .sort(compareLabels)
  const replaced = new Set(replacedSets)
  const preservedSets = [...new Set(existing.rallies.map((rally) => rally.set))]
    .filter((set) => !replaced.has(set))
    .sort(compareLabels)
  const changes = replacedSets.map((set) => ({
    set,
    savedRallies: existing.rallies.filter((rally) => rally.set === set).length,
    draftRallies: current.rallies.filter((rally) => rally.set === set).length,
  }))

  const rallies = [...existing.rallies.filter((rally) => !replaced.has(rally.set)), ...current.rallies].sort(
    (a, b) => compareLabels(a.set, b.set),
  )
  const currentScores = new Map(current.officialScores.map((score) => [score.set, score]))
  const officialScores = [
    ...existing.officialScores.filter((score) => !replaced.has(score.set)),
    ...replacedSets.flatMap((set) => {
      const score = currentScores.get(set)
      return score && (score.us > 0 || score.them > 0) ? [score] : []
    }),
  ].sort((a, b) => compareLabels(a.set, b.set))

  const lineups = hasLineupData(current.lineups) ? current.lineups : existing.lineups
  const baselineLineups = source?.lineupsFingerprint ?? lineupsFingerprint(existing.lineups)
  const lineupsChanged = baselineLineups !== lineupsFingerprint(lineups)
  const merged = {
    ...current,
    roster: [...new Set([...existing.roster, ...current.roster])].sort((a, b) => a.localeCompare(b)),
    rallies,
    rotations: lineups.map((lineup) => lineup.rotation),
    lineups,
    officialScores,
  }

  return {
    csv: exportTaggerCsv({
      rallies: merged.rallies,
      youtubeUrl: merged.youtubeUrl,
      videoTitle: merged.videoTitle,
      lineups: merged.lineups,
      officialScores: merged.officialScores,
    }),
    preservedSets,
    replacedSets,
    warnings: imported.warnings,
    changes,
    lineupsChanged,
  }
}
