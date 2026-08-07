import { compareLabels } from '../lib/parse'
import { normalizeLineup } from './lineupRotation'
import type { LineupDraft, RotationPlan, TaggerDraft } from './types'

function planLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export function normalizeRotationPlan(plan: RotationPlan): RotationPlan {
  const foundRotations = [...new Set(plan.rotations.filter(Boolean))].sort(compareLabels)
  const rotations = foundRotations.length ? foundRotations : ['1']
  const byRotation = new Map(plan.lineups.map((lineup) => [lineup.rotation, normalizeLineup(lineup)]))
  return {
    ...plan,
    sets: [...new Set(plan.sets.filter(Boolean))].sort(compareLabels),
    rotations,
    lineups: rotations.map(
      (rotation) =>
        byRotation.get(rotation) ?? {
          rotation,
          front: ['', '', ''],
          back: ['', '', ''],
          sub: '',
        },
    ),
  }
}

export function planForSet(draft: Pick<TaggerDraft, 'rotationPlans' | 'set'>, set = draft.set): RotationPlan {
  return (
    draft.rotationPlans.find((plan) => plan.sets.includes(set)) ??
    draft.rotationPlans[0] ?? {
      id: 'plan-a',
      label: 'Rotation A',
      sets: [set],
      rotations: ['1'],
      lineups: [{ rotation: '1', front: ['', '', ''], back: ['', '', ''], sub: '' }],
    }
  )
}

export function assignSetToPlan(plans: RotationPlan[], set: string): RotationPlan[] {
  if (plans.some((plan) => plan.sets.includes(set))) return plans
  return plans.map((plan, index) => (index === 0 ? { ...plan, sets: [...plan.sets, set].sort(compareLabels) } : plan))
}

function nextSuffix(plans: RotationPlan[]): string {
  const used = new Set(
    plans.flatMap((plan) =>
      plan.rotations.flatMap((rotation) => {
        const match = rotation.match(/^[0-9]+([a-z]+)$/i)
        return match ? [match[1].toLowerCase()] : []
      }),
    ),
  )
  for (let i = 0; ; i++) {
    const suffix = planLetter(i).toLowerCase()
    if (!used.has(suffix)) return suffix
  }
}

function relabelLineups(lineups: LineupDraft[], rotations: string[]): LineupDraft[] {
  return lineups.map((lineup, index) => ({
    ...normalizeLineup(lineup),
    rotation: rotations[index] ?? lineup.rotation,
  }))
}

export function createPlanForSet(
  plans: RotationPlan[],
  set: string,
  sourcePlanId: string,
): { plans: RotationPlan[]; plan: RotationPlan } {
  const source = plans.find((plan) => plan.id === sourcePlanId) ?? plans[0]
  const suffix = nextSuffix(plans)
  const rotations = source.rotations.map((rotation, index) => {
    const numeric = rotation.match(/^\d+/)?.[0] ?? String(index + 1)
    return `${numeric}${suffix}`
  })
  const nextIndex = plans.length
  const plan: RotationPlan = {
    id: `plan-${planLetter(nextIndex).toLowerCase()}`,
    label: `Rotation ${planLetter(nextIndex)}`,
    sets: [set],
    rotations,
    lineups: relabelLineups(source.lineups, rotations),
  }
  return {
    plans: [
      ...plans.map((existing) => ({
        ...existing,
        sets: existing.sets.filter((assignedSet) => assignedSet !== set),
      })),
      plan,
    ].filter((existing) => existing.sets.length > 0),
    plan,
  }
}

export function updateRotationPlan(
  plans: RotationPlan[],
  planId: string,
  patch: Partial<Pick<RotationPlan, 'rotations' | 'lineups' | 'sets' | 'label'>>,
): RotationPlan[] {
  return plans.map((plan) => (plan.id === planId ? normalizeRotationPlan({ ...plan, ...patch }) : plan))
}

export function planHasLineupData(plan: RotationPlan): boolean {
  return plan.lineups.some((lineup) => {
    const normalized = normalizeLineup(lineup)
    return normalized.front.some(Boolean) || normalized.back.some(Boolean) || Boolean(normalized.sub)
  })
}

export function rotationPlansFingerprint(plans: RotationPlan[]): string {
  return JSON.stringify(
    plans.map((plan) => ({
      label: plan.label,
      sets: [...plan.sets].sort(compareLabels),
      rotations: plan.rotations,
      lineups: plan.lineups.map(normalizeLineup),
    })),
  )
}
