import { compareLabels, parseSession } from '../lib/parse'
import { emptyCourtLineup, normalizeLineup } from './lineupRotation'
import {
  planForSet,
  planHasLineupData,
  rotationPlansFingerprint,
} from './rotationPlans'
import { advanceAfterRally } from './state'
import type { OfficialScore, RotationPlan, TaggedRally, TaggerDraft } from './types'
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

export function repoSourceForDraft(filename: string, sha: string, draft: TaggerDraft): NonNullable<TaggerDraft['repoSource']> {
  const sets = [...new Set(draft.rallies.map((rally) => rally.set))]
  return {
    filename,
    sha,
    setFingerprints: Object.fromEntries(sets.map((set) => [set, setFingerprint(draft, set)])),
    lineupsFingerprint: rotationPlansFingerprint(draft.rotationPlans),
  }
}

function setsFromBlockLabel(label: string): string[] {
  const match = label.match(/\bsets?\s+(.+)$/i)
  if (!match) return []
  return (match[1].match(/[a-z0-9]+/gi) ?? [])
    .filter((token) => token.toLowerCase() !== 'and')
    .map((token) => token.toLowerCase())
}

function importedRotationPlans(parsed: ReturnType<typeof parseSession>): RotationPlan[] {
  const groups = new Map<string, typeof parsed.lineups>()
  for (const lineup of parsed.lineups) {
    const list = groups.get(lineup.blockLabel) ?? []
    if (!list.some((existing) => existing.rotation === lineup.rotation)) list.push(lineup)
    groups.set(lineup.blockLabel, list)
  }
  const allSets = parsed.sets.map((summary) => summary.set)
  return [...groups.entries()].map(([blockLabel, lineups], index) => {
    const rotations = lineups.map((lineup) => lineup.rotation).sort(compareLabels)
    const byRotation = new Map(lineups.map((lineup) => [lineup.rotation, lineup]))
    const explicitSets = setsFromBlockLabel(blockLabel)
    return {
      id: `plan-${String.fromCharCode(97 + index)}`,
      label: `Rotation ${String.fromCharCode(65 + index)}`,
      sets: explicitSets.length ? explicitSets : index === 0 ? allSets : [],
      rotations,
      lineups: rotations.map((rotation) => {
        const lineup = byRotation.get(rotation)
        return normalizeLineup(
          lineup
            ? {
                rotation,
                front: lineup.front,
                back: lineup.back,
                sub: lineup.sub,
              }
            : emptyCourtLineup(rotation),
        )
      }),
    }
  })
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

  const parsedRotations = [
    ...new Set([
      ...parsed.lineups.map((lineup) => lineup.rotation),
      ...rallies.map((rally) => rally.rotation).filter(Boolean),
    ]),
  ].sort(compareLabels)
  if (!parsedRotations.length) parsedRotations.push(...defaultRotations())
  let rotationPlans = importedRotationPlans(parsed)
  if (!rotationPlans.length) {
    rotationPlans = [
      {
        id: 'plan-a',
        label: 'Rotation A',
        sets: parsed.sets.map((summary) => summary.set),
        rotations: parsedRotations,
        lineups: parsedRotations.map(emptyCourtLineup),
      },
    ]
  }
  const lastRally = rallies.at(-1)
  const set = lastRally?.set ?? parsed.sets.at(-1)?.set ?? '1'
  const activePlan = planForSet({ rotationPlans, set })
  const next = lastRally
    ? advanceAfterRally({
        serving: lastRally.serving,
        won: lastRally.won,
        rotation: lastRally.rotation || activePlan.rotations[0],
        rotations: activePlan.rotations,
      })
    : { serving: true, rotation: activePlan.rotations[0] }

  const officialScores: OfficialScore[] = parsed.sets.flatMap((summary) =>
    summary.officialUs === null || summary.officialThem === null
      ? []
      : [{ set: summary.set, us: summary.officialUs, them: summary.officialThem }],
  )
  const roster = [
    ...new Set([
      ...parsed.players,
      ...rotationPlans
        .flatMap((plan) => plan.lineups)
        .flatMap((lineup) => [...lineup.front, ...lineup.back, lineup.sub])
        .filter(Boolean),
    ]),
  ].sort((a, b) => a.localeCompare(b))

  const draft = emptyDraft({
    date: parsed.date,
    youtubeUrl: parsed.youtubeBySet[set] ?? parsed.youtubeUrl,
    videoTitle: '',
    roster,
    set,
    rotation: next.rotation,
    rotations: activePlan.rotations,
    serving: next.serving,
    rallies,
    lineups: activePlan.lineups,
    rotationPlans,
    officialScores,
    updatedAt: Date.now(),
  })
  if (sha) draft.repoSource = repoSourceForDraft(filename, sha, draft)

  return {
    draft,
    warnings: parsed.warnings,
  }
}

function planAppliesToSet(plan: RotationPlan, set: string, rallies: TaggedRally[]): boolean {
  return (
    plan.sets.includes(set) ||
    rallies.some((rally) => rally.set === set && plan.rotations.includes(rally.rotation))
  )
}

function plansForSets(plans: RotationPlan[], sets: string[], rallies: TaggedRally[]): RotationPlan[] {
  return plans.flatMap((plan) => {
    const assignedSets = sets.filter((set) => planAppliesToSet(plan, set, rallies))
    return assignedSets.length ? [{ ...plan, sets: assignedSets }] : []
  })
}

function combinePlans(plans: RotationPlan[]): RotationPlan[] {
  const combined = new Map<string, RotationPlan>()
  for (const plan of plans) {
    const signature = JSON.stringify({
      rotations: plan.rotations,
      lineups: plan.lineups.map(normalizeLineup),
    })
    const existing = combined.get(signature)
    if (existing) {
      existing.sets = [...new Set([...existing.sets, ...plan.sets])].sort(compareLabels)
    } else {
      combined.set(signature, { ...plan, sets: [...plan.sets] })
    }
  }
  return [...combined.values()]
}

function mergeRotationPlans(
  existing: TaggerDraft,
  current: TaggerDraft,
  replacedSets: string[],
  preservedSets: string[],
): RotationPlan[] {
  const preservedPlans = plansForSets(existing.rotationPlans, preservedSets, existing.rallies)
  const currentPlans = plansForSets(current.rotationPlans, replacedSets, current.rallies)
  const replacementPlans = currentPlans.some(planHasLineupData)
    ? currentPlans
    : plansForSets(existing.rotationPlans, replacedSets, existing.rallies)
  return combinePlans([...preservedPlans, ...replacementPlans])
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

  const rotationPlans = mergeRotationPlans(existing, current, replacedSets, preservedSets)
  const baselineLineups = source?.lineupsFingerprint ?? rotationPlansFingerprint(existing.rotationPlans)
  const lineupsChanged = baselineLineups !== rotationPlansFingerprint(rotationPlans)
  const activePlan = planForSet({ rotationPlans, set: current.set })
  const merged = {
    ...current,
    roster: [...new Set([...existing.roster, ...current.roster])].sort((a, b) => a.localeCompare(b)),
    rallies,
    rotations: activePlan.rotations,
    lineups: activePlan.lineups,
    rotationPlans,
    officialScores,
  }

  return {
    csv: exportTaggerCsv({
      rallies: merged.rallies,
      youtubeUrl: merged.youtubeUrl,
      videoTitle: merged.videoTitle,
      lineups: merged.lineups,
      rotationPlans: merged.rotationPlans,
      officialScores: merged.officialScores,
    }),
    preservedSets,
    replacedSets,
    warnings: imported.warnings,
    changes,
    lineupsChanged,
  }
}
