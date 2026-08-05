import type { CauseMeta } from './types'

export const GROUPS = {
  attack: 'Attacking',
  handling: 'Ball handling',
  serve: 'Serving',
  receive: 'Serve receive',
  defense: 'Defense',
  other: 'Other',
} as const

const META: CauseMeta[] = [
  {
    key: 'our_point',
    label: 'Kill / earned point',
    short: 'Kill',
    side: 'win',
    kind: 'earned',
    group: GROUPS.attack,
    color: '#22c55e',
  },
  {
    key: 'aced_on_them_suckas',
    label: 'Ace',
    short: 'Ace',
    side: 'win',
    kind: 'ace',
    group: GROUPS.serve,
    color: '#ededed',
  },
  {
    key: 'opp_err',
    label: 'Opponent error',
    short: 'Opp error',
    side: 'win',
    kind: 'gift',
    group: GROUPS.other,
    color: '#a1a1a1',
  },
  {
    key: 'opp_point',
    label: 'Opponent kill',
    short: 'Opp kill',
    side: 'loss',
    kind: 'conceded',
    group: GROUPS.defense,
    color: '#737373',
  },
  {
    key: 'attack_out',
    label: 'Attack out',
    short: 'Hit out',
    side: 'loss',
    kind: 'error',
    group: GROUPS.attack,
    color: '#f59e0b',
  },
  {
    key: 'attack_net',
    label: 'Attack into net',
    short: 'Hit net',
    side: 'loss',
    kind: 'error',
    group: GROUPS.attack,
    color: '#fbbf24',
  },
  {
    key: 'handling_bump',
    label: 'Pass / dig error',
    short: 'Pass err',
    side: 'loss',
    kind: 'error',
    group: GROUPS.handling,
    color: '#ef4444',
  },
  {
    key: 'handling_set',
    label: 'Setting error',
    short: 'Set err',
    side: 'loss',
    kind: 'error',
    group: GROUPS.handling,
    color: '#f87171',
  },
  {
    key: 'handling_misc',
    label: 'Misc handling error',
    short: 'Misc err',
    side: 'loss',
    kind: 'error',
    group: GROUPS.handling,
    color: '#fca5a5',
  },
  {
    key: 'serve_err',
    label: 'Service error',
    short: 'Serve err',
    side: 'loss',
    kind: 'error',
    group: GROUPS.serve,
    color: '#f97316',
  },
  {
    key: 'aced_on_us',
    label: 'Aced on us',
    short: 'Aced',
    side: 'loss',
    kind: 'error',
    group: GROUPS.receive,
    color: '#a1a1a1',
  },
  {
    key: 'fault',
    label: 'Call / fault against us',
    short: 'Fault',
    side: 'loss',
    kind: 'conceded',
    group: GROUPS.other,
    color: '#525252',
  },
  {
    key: 'coverage',
    label: 'Coverage breakdown',
    short: 'Coverage',
    side: 'loss',
    kind: 'error',
    group: GROUPS.defense,
    color: '#d4d4d4',
  },
]

const BY_KEY = new Map(META.map((m) => [m.key, m]))

/** Causes we have not seen before still get sane defaults so nothing silently disappears. */
export function causeMeta(key: string, won?: boolean): CauseMeta {
  const known = BY_KEY.get(key)
  if (known) return known
  const side = won ? 'win' : 'loss'
  return {
    key,
    label: key ? key.replace(/_/g, ' ') : 'Untagged',
    short: key || 'Untagged',
    side,
    kind: side === 'win' ? 'gift' : 'error',
    group: GROUPS.other,
    color: side === 'win' ? '#ededed' : '#b45309',
  }
}

export const ALL_CAUSES = META

export function isOurError(cause: string, won: boolean): boolean {
  return !won && causeMeta(cause, won).kind === 'error'
}
