import { causeMeta, isOurError } from './causes'
import { compareLabels } from './parse'
import type { Rally, Session } from './types'

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0)

export interface CoreStats {
  rallies: number
  won: number
  lost: number
  winPct: number
  diff: number

  serveRallies: number
  servePointsWon: number
  servePointPct: number

  recvRallies: number
  sideouts: number
  sideoutPct: number

  kills: number
  aces: number
  oppErrPoints: number
  earnedWinPct: number

  /** opp_err rallies where the sheet named one of our players — we made them miss. */
  forced: number
  /** opp_err rallies with nobody named — genuinely unprompted opponent mistakes. */
  unprompted: number

  errors: number
  errorRate: number
  conceded: number
  selfInflictedPct: number

  /**
   * Errors where we ended the rally with no opponent attack involved (attack, serve, ball
   * handling). Excludes being aced and coverage breakdowns, which the opponent had a hand in —
   * this is the number that compares like-for-like against the opponent's error count.
   */
  unforced: number

  serveErrs: number
  serveErrRate: number
  aceRate: number
  acedOn: number
  acedOnRate: number
}

export function coreStats(rallies: Rally[]): CoreStats {
  const count = (fn: (r: Rally) => boolean) => rallies.filter(fn).length

  const total = rallies.length
  const won = count((r) => r.won)
  const lost = total - won

  const serveRallies = count((r) => r.serving)
  const servePointsWon = count((r) => r.serving && r.won)
  const recvRallies = total - serveRallies
  const sideouts = count((r) => !r.serving && r.won)

  const kills = count((r) => r.cause === 'our_point')
  const aces = count((r) => r.cause === 'aced_on_them_suckas')
  const oppErrPoints = count((r) => r.cause === 'opp_err')
  const errors = count((r) => isOurError(r.cause, r.won))
  // Everything we lost that is not charged to us — the opponent earning it, or a call going
  // against us. Derived by subtraction so a new cause can never fall between the two buckets.
  const conceded = lost - errors
  const serveErrs = count((r) => r.cause === 'serve_err')
  const acedOn = count((r) => r.cause === 'aced_on_us')
  const unforcedGroups = new Set(['Attacking', 'Ball handling', 'Serving'])
  const unforced = count((r) => isOurError(r.cause, r.won) && unforcedGroups.has(causeMeta(r.cause, r.won).group))

  return {
    rallies: total,
    won,
    lost,
    winPct: pct(won, total),
    diff: won - lost,

    serveRallies,
    servePointsWon,
    servePointPct: pct(servePointsWon, serveRallies),

    recvRallies,
    sideouts,
    sideoutPct: pct(sideouts, recvRallies),

    kills,
    aces,
    oppErrPoints,
    earnedWinPct: pct(kills + aces, won),
    forced: count((r) => r.cause === 'opp_err' && r.players.length > 0),
    unprompted: count((r) => r.cause === 'opp_err' && r.players.length === 0),

    errors,
    errorRate: pct(errors, total),
    conceded,
    selfInflictedPct: pct(errors, lost),
    unforced,

    serveErrs,
    serveErrRate: pct(serveErrs, serveRallies),
    aceRate: pct(aces, serveRallies),
    acedOn,
    acedOnRate: pct(acedOn, recvRallies),
  }
}

export interface CauseCount {
  key: string
  label: string
  short: string
  color: string
  group: string
  side: 'win' | 'loss'
  count: number
  share: number
}

export function causeBreakdown(rallies: Rally[], side?: 'win' | 'loss'): CauseCount[] {
  const map = new Map<string, number>()
  for (const r of rallies) {
    const meta = causeMeta(r.cause, r.won)
    if (side && meta.side !== side) continue
    map.set(r.cause, (map.get(r.cause) ?? 0) + 1)
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  return [...map.entries()]
    .map(([key, count]) => {
      const meta = causeMeta(key)
      return {
        key,
        label: meta.label,
        short: meta.short,
        color: meta.color,
        group: meta.group,
        side: meta.side,
        count,
        share: pct(count, total),
      }
    })
    .sort((a, b) => b.count - a.count)
}

export interface GroupCount {
  group: string
  count: number
  share: number
  color: string
}

export function errorGroups(rallies: Rally[]): GroupCount[] {
  const map = new Map<string, { count: number; color: string }>()
  for (const r of rallies) {
    if (!isOurError(r.cause, r.won)) continue
    const meta = causeMeta(r.cause, r.won)
    const entry = map.get(meta.group) ?? { count: 0, color: meta.color }
    entry.count += 1
    map.set(meta.group, entry)
  }
  const total = [...map.values()].reduce((a, b) => a + b.count, 0)
  return [...map.entries()]
    .map(([group, v]) => ({ group, count: v.count, share: pct(v.count, total), color: v.color }))
    .sort((a, b) => b.count - a.count)
}

export interface RotationStat {
  rotation: string
  rallies: number
  won: number
  lost: number
  winPct: number
  net: number
  sideoutPct: number
  serveRallies: number
  servePointPct: number
  errors: number
  errorRate: number
  aces: number
  kills: number
}

export function rotationStats(rallies: Rally[]): RotationStat[] {
  const out: RotationStat[] = []
  // Whatever rotations the sheet actually used: six, seven, or two labelled sets of them.
  const found = [...new Set(rallies.map((r) => r.rotation).filter((r): r is string => r !== null))].sort(compareLabels)
  for (const rot of found) {
    const rs = rallies.filter((r) => r.rotation === rot)
    if (!rs.length) continue
    const c = coreStats(rs)
    out.push({
      rotation: rot,
      rallies: c.rallies,
      won: c.won,
      lost: c.lost,
      winPct: c.winPct,
      net: c.diff,
      sideoutPct: c.sideoutPct,
      serveRallies: c.serveRallies,
      servePointPct: c.servePointPct,
      errors: c.errors,
      errorRate: c.errorRate,
      aces: c.aces,
      kills: c.kills,
    })
  }
  return out
}

export interface PlayerStat {
  name: string
  involved: number
  wins: number
  losses: number
  kills: number
  aces: number
  /** opp_err rallies the sheet put this player's name on — they made the opponent miss. */
  forced: number
  /** kills + aces + forced errors: every point the sheet credits to this player */
  plus: number
  errors: number
  /** opp_point rallies with this player's name. The opponent earned it; not counted as an error. */
  beaten: number
  net: number
  serveErrs: number
  acedOn: number
  attackErrs: number
  handlingErrs: number
  coverageErrs: number
  errorsByCause: Record<string, number>
  /** share of the team's total errors */
  errorShare: number
  /** share of the team's earned points (kills + aces) */
  pointShare: number
  /** errors per rally the player is tagged in */
  errorRate: number
  winPct: number
}

export function playerStats(rallies: Rally[]): PlayerStat[] {
  const names = [...new Set(rallies.flatMap((r) => r.players))]
  const team = coreStats(rallies)
  const teamEarned = team.kills + team.aces + team.forced

  const stats = names.map((name) => {
    const mine = rallies.filter((r) => r.players.includes(name))
    const count = (fn: (r: Rally) => boolean) => mine.filter(fn).length

    const errorsByCause: Record<string, number> = {}
    for (const r of mine) {
      if (isOurError(r.cause, r.won)) errorsByCause[r.cause] = (errorsByCause[r.cause] ?? 0) + 1
    }

    const kills = count((r) => r.cause === 'our_point')
    const aces = count((r) => r.cause === 'aced_on_them_suckas')
    const forced = count((r) => r.cause === 'opp_err')
    const errors = count((r) => isOurError(r.cause, r.won))
    const wins = count((r) => r.won)
    const groupCount = (group: string) =>
      mine.filter((r) => isOurError(r.cause, r.won) && causeMeta(r.cause, r.won).group === group).length

    return {
      name,
      involved: mine.length,
      wins,
      losses: mine.length - wins,
      kills,
      aces,
      forced,
      plus: kills + aces + forced,
      errors,
      beaten: count((r) => r.cause === 'opp_point'),
      net: kills + aces + forced - errors,
      serveErrs: errorsByCause['serve_err'] ?? 0,
      acedOn: errorsByCause['aced_on_us'] ?? 0,
      attackErrs: groupCount('Attacking'),
      handlingErrs: groupCount('Ball handling'),
      coverageErrs: groupCount('Defense'),
      errorsByCause,
      errorShare: pct(errors, team.errors),
      pointShare: pct(kills + aces + forced, teamEarned),
      errorRate: pct(errors, mine.length),
      winPct: pct(wins, mine.length),
    }
  })

  return stats.sort((a, b) => b.net - a.net || b.plus - a.plus)
}

export interface ServeStat {
  name: string
  /** every rally we served with this player at the line, not just the ones that ended on the serve */
  attempts: number
  aces: number
  errors: number
  pointsWon: number
  acePct: number
  errorPct: number
  pointPct: number
  /** how many times they stepped to the line to start a service turn */
  turns: number
  /** points scored across those turns, per turn */
  pointsPerTurn: number
  longestTurn: number
}

/**
 * Needs `rally.server`, which only exists when the line-up block validated against the sheet's
 * own serve tags. Returns an empty list otherwise rather than guessing.
 */
export function serveStats(rallies: Rally[]): ServeStat[] {
  const serving = rallies.filter((r) => r.serving && r.server)
  if (!serving.length) return []

  const agg = new Map<string, { attempts: number; aces: number; errors: number; pointsWon: number }>()
  for (const r of serving) {
    const e = agg.get(r.server!) ?? { attempts: 0, aces: 0, errors: 0, pointsWon: 0 }
    e.attempts += 1
    if (r.cause === 'aced_on_them_suckas') e.aces += 1
    if (r.cause === 'serve_err') e.errors += 1
    if (r.won) e.pointsWon += 1
    agg.set(r.server!, e)
  }

  // A service turn is an unbroken block of serving rallies by the same player inside one set.
  const turns = new Map<string, number[]>()
  const bySet = new Map<string, Rally[]>()
  for (const r of rallies) {
    const key = `${r.sessionId}|${r.set}`
    if (!bySet.has(key)) bySet.set(key, [])
    bySet.get(key)!.push(r)
  }
  for (const list of bySet.values()) {
    const ordered = [...list].sort((a, b) => a.n - b.n)
    let current: { name: string; points: number } | null = null
    const flush = () => {
      if (!current) return
      if (!turns.has(current.name)) turns.set(current.name, [])
      turns.get(current.name)!.push(current.points)
      current = null
    }
    for (const r of ordered) {
      if (!r.serving || !r.server) {
        flush()
        continue
      }
      if (!current || current.name !== r.server) {
        flush()
        current = { name: r.server, points: 0 }
      }
      if (r.won) current.points += 1
    }
    flush()
  }

  return [...agg.entries()]
    .map(([name, v]) => {
      const runs = turns.get(name) ?? []
      const scored = runs.reduce((a, b) => a + b, 0)
      return {
        name,
        attempts: v.attempts,
        aces: v.aces,
        errors: v.errors,
        pointsWon: v.pointsWon,
        acePct: pct(v.aces, v.attempts),
        errorPct: pct(v.errors, v.attempts),
        pointPct: pct(v.pointsWon, v.attempts),
        turns: runs.length,
        pointsPerTurn: runs.length ? scored / runs.length : 0,
        longestTurn: runs.length ? Math.max(...runs) : 0,
      }
    })
    .sort((a, b) => b.attempts - a.attempts)
}

export interface StreakInfo {
  longestRun: number
  longestRunLabel: string
  longestSkid: number
  longestSkidLabel: string
  runs3Plus: number
  skids3Plus: number
}

export function streaks(rallies: Rally[]): StreakInfo {
  let longestRun = 0
  let longestSkid = 0
  let runLabel = ''
  let skidLabel = ''
  let runs3 = 0
  let skids3 = 0

  const bySet = new Map<string, Rally[]>()
  for (const r of rallies) {
    const key = `${r.sessionId}|${r.set}`
    if (!bySet.has(key)) bySet.set(key, [])
    bySet.get(key)!.push(r)
  }

  for (const list of bySet.values()) {
    const ordered = [...list].sort((a, b) => a.n - b.n)
    let run = 0
    let skid = 0
    for (const r of ordered) {
      if (r.won) {
        run += 1
        if (skid >= 3) skids3 += 1
        skid = 0
        if (run > longestRun) {
          longestRun = run
          runLabel = `${r.sessionLabel} · Set ${r.set}`
        }
      } else {
        skid += 1
        if (run >= 3) runs3 += 1
        run = 0
        if (skid > longestSkid) {
          longestSkid = skid
          skidLabel = `${r.sessionLabel} · Set ${r.set}`
        }
      }
    }
    if (run >= 3) runs3 += 1
    if (skid >= 3) skids3 += 1
  }

  return {
    longestRun,
    longestRunLabel: runLabel,
    longestSkid,
    longestSkidLabel: skidLabel,
    runs3Plus: runs3,
    skids3Plus: skids3,
  }
}

export interface FlowPoint {
  n: number
  us: number
  them: number
  lead: number
  won: boolean
  cause: string
  players: string
  notes: string
}

export function scoreFlow(rallies: Rally[]): FlowPoint[] {
  return [...rallies]
    .sort((a, b) => a.n - b.n)
    .map((r) => ({
      n: r.n,
      us: r.us,
      them: r.them,
      lead: r.us - r.them,
      won: r.won,
      cause: causeMeta(r.cause, r.won).label,
      players: r.players.join(', '),
      notes: r.notes,
    }))
}

/** Split each set into thirds so we can see whether we start slow or tighten up late. */
export interface PhaseStat {
  phase: string
  rallies: number
  winPct: number
  errorRate: number
}

export function phaseStats(rallies: Rally[]): PhaseStat[] {
  const buckets: Record<string, Rally[]> = { Early: [], Middle: [], 'Crunch time': [] }

  const bySet = new Map<string, Rally[]>()
  for (const r of rallies) {
    const key = `${r.sessionId}|${r.set}`
    if (!bySet.has(key)) bySet.set(key, [])
    bySet.get(key)!.push(r)
  }

  for (const list of bySet.values()) {
    for (const r of list) {
      const before = Math.max(r.us - (r.won ? 1 : 0), r.them - (r.won ? 0 : 1))
      if (before >= 18) buckets['Crunch time'].push(r)
      else if (before >= 9) buckets.Middle.push(r)
      else buckets.Early.push(r)
    }
  }

  return Object.entries(buckets).map(([phase, rs]) => {
    const c = coreStats(rs)
    return { phase, rallies: c.rallies, winPct: c.winPct, errorRate: c.errorRate }
  })
}

export interface SessionTrend {
  sessionId: string
  label: string
  date: string
  setsWon: number
  setsLost: number
  core: CoreStats
}

export function sessionTrends(sessions: Session[]): SessionTrend[] {
  return sessions.map((s) => ({
    sessionId: s.id,
    label: s.label,
    date: s.date,
    setsWon: s.sets.filter((x) => x.decided && x.won).length,
    setsLost: s.sets.filter((x) => x.decided && !x.won).length,
    core: coreStats(s.rallies),
  }))
}

export interface PlayerTrendPoint {
  label: string
  date: string
  net: number
  plus: number
  errors: number
  involved: number
}

export function playerTrend(sessions: Session[], name: string): PlayerTrendPoint[] {
  return sessions.map((s) => {
    const stat = playerStats(s.rallies).find((p) => p.name === name)
    return {
      label: s.label,
      date: s.date,
      net: stat?.net ?? 0,
      plus: stat?.plus ?? 0,
      errors: stat?.errors ?? 0,
      involved: stat?.involved ?? 0,
    }
  })
}

export interface Highlight {
  rally: Rally
  label: string
}

/** Rallies worth rewatching: tagged with a video timestamp or a juicy note. */
export function highlights(rallies: Rally[]): Highlight[] {
  return rallies
    .filter((r) => r.notes.length > 3)
    .map((r) => ({ rally: r, label: causeMeta(r.cause, r.won).label }))
}
