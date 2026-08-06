import { isOppTouch, TOUCH_SKILLS, type PlayerTouch, type Touch, type TouchSkill } from './touches'
import type { Rally } from './types'

export function playerTouches(seq: Touch[]): PlayerTouch[] {
  return seq.filter((t): t is PlayerTouch => !isOppTouch(t))
}

/** Players who appear in a rally's graded touch sequence. */
export function touchParticipantNames(r: Rally): string[] {
  return [...new Set(playerTouches(r.touches).map((t) => t.player))]
}

/** Cause-column tag and/or graded touch — used by the dashboard player filter. */
export function rallyInvolvesPlayer(r: Rally, name: string): boolean {
  return r.players.includes(name) || touchParticipantNames(r).includes(name)
}

export function rallyInvolvesAnyPlayer(r: Rally, names: string[]): boolean {
  return names.some((n) => rallyInvolvesPlayer(r, n))
}

function allowPlayer(name: string, focus?: string[]): boolean {
  return !focus?.length || focus.includes(name)
}

export function ralliesWithTouches(rallies: Rally[]): Rally[] {
  return rallies.filter((r) => playerTouches(r.touches).length > 0)
}

/** Walk a rally sequence with possession context from `o` markers. */
export interface IndexedTouch {
  touch: PlayerTouch
  /** True if this contact is the first our-touch after an `o` (or rally start with no prior our-touch). */
  afterOpp: boolean
  /** Index among our touches only. */
  ourIndex: number
  /** Next our-touch in the same rally, if any. */
  next: PlayerTouch | null
  /** Previous our-touch in the same rally, if any. */
  prev: PlayerTouch | null
}

export function indexTouches(seq: Touch[]): IndexedTouch[] {
  const out: IndexedTouch[] = []
  let afterOpp = true // first ball of a rally is a new possession unless we served without tagging o
  let ourIndex = 0
  const ours: PlayerTouch[] = []

  for (const t of seq) {
    if (isOppTouch(t)) {
      afterOpp = true
      continue
    }
    ours.push(t)
    out.push({
      touch: t,
      afterOpp,
      ourIndex,
      next: null,
      prev: ourIndex > 0 ? ours[ourIndex - 1]! : null,
    })
    afterOpp = false
    ourIndex += 1
  }

  for (let i = 0; i < out.length; i++) {
    out[i]!.next = i + 1 < out.length ? out[i + 1]!.touch : null
  }
  return out
}

export interface SkillBucket {
  skill: TouchSkill
  label: string
  attempts: number
  avg: number
  zeros: number
  threes: number
  zeroPct: number
  threePct: number
  hist: [number, number, number, number]
}

function emptyHist(): [number, number, number, number] {
  return [0, 0, 0, 0]
}

function skillBucket(skill: TouchSkill, touches: PlayerTouch[]): SkillBucket {
  const label = TOUCH_SKILLS.find((s) => s.skill === skill)?.label ?? skill
  const mine = touches.filter((t) => t.skill === skill)
  const hist = emptyHist()
  for (const t of mine) hist[t.quality] += 1
  const attempts = mine.length
  const sum = mine.reduce((a, t) => a + t.quality, 0)
  const zeros = hist[0]
  const threes = hist[3]
  return {
    skill,
    label,
    attempts,
    avg: attempts ? sum / attempts : 0,
    zeros,
    threes,
    zeroPct: attempts ? (zeros / attempts) * 100 : 0,
    threePct: attempts ? (threes / attempts) * 100 : 0,
    hist,
  }
}

export interface TeamTouchSummary {
  ralliesTagged: number
  ralliesTotal: number
  ourTouches: number
  possessions: number
  /** First contact after opponent ball. */
  firstBall: SkillBucket
  /** Emergency digs: r with quality ≤ 1. */
  emergencies: number
  emergenciesKeptAlive: number
  emergenciesWon: number
  emergenciesWasted: number
  /** Classic in-system: r≥2 then s≥2 then a in same possession. */
  inSystemAttempts: number
  inSystemKills: number
  /** Win % when first ball after o is ≥2 vs ≤1. */
  winPctAfterGoodFirst: number
  winPctAfterPoorFirst: number
  goodFirstN: number
  poorFirstN: number
  bySkill: SkillBucket[]
}

export function teamTouchSummary(rallies: Rally[], focusPlayers?: string[]): TeamTouchSummary {
  const tagged = ralliesWithTouches(rallies)
  const allOur: PlayerTouch[] = []
  let possessions = 0
  let emergencies = 0
  let emergenciesKeptAlive = 0
  let emergenciesWon = 0
  let emergenciesWasted = 0
  let inSystemAttempts = 0
  let inSystemKills = 0

  const firstBalls: PlayerTouch[] = []
  let goodFirstWins = 0
  let goodFirstN = 0
  let poorFirstWins = 0
  let poorFirstN = 0

  for (const r of tagged) {
    const indexed = indexTouches(r.touches)
    for (const x of indexed) {
      if (!allowPlayer(x.touch.player, focusPlayers)) continue
      allOur.push(x.touch)
    }

    // Possessions ≈ number of `o` + 1 if sequence starts with our touch without leading o
    const oppMarks = r.touches.filter(isOppTouch).length
    const startsWithOur = r.touches.length > 0 && !isOppTouch(r.touches[0]!)
    if (!focusPlayers?.length) {
      possessions += oppMarks + (startsWithOur ? 1 : 0)
    } else {
      // Count possessions where a focused player took the first ball after o / rally start.
      possessions += indexed.filter((x) => x.afterOpp && allowPlayer(x.touch.player, focusPlayers)).length
    }

    for (const x of indexed) {
      if (!allowPlayer(x.touch.player, focusPlayers)) continue

      if (x.afterOpp) {
        firstBalls.push(x.touch)
        if (x.touch.quality >= 2) {
          goodFirstN += 1
          if (r.won) goodFirstWins += 1
        } else {
          poorFirstN += 1
          if (r.won) poorFirstWins += 1
        }
      }

      const isEmergency = x.touch.skill === 'r' && x.touch.quality <= 1
      if (isEmergency) {
        emergencies += 1
        const kept = !!x.next
        if (kept) {
          emergenciesKeptAlive += 1
          if (r.won) emergenciesWon += 1
          if (x.next && x.next.quality === 0 && !r.won) emergenciesWasted += 1
        }
      }
    }

    // In-system within each possession segment
    const segments = splitPossessions(r.touches)
    for (const seg of segments) {
      const chain = findInSystem(seg)
      if (!chain) continue
      if (
        focusPlayers?.length &&
        !allowPlayer(chain.receive.player, focusPlayers) &&
        !allowPlayer(chain.set.player, focusPlayers) &&
        !allowPlayer(chain.attack.player, focusPlayers)
      ) {
        continue
      }
      inSystemAttempts += 1
      if (r.won && chain.attack) inSystemKills += 1
    }
  }

  return {
    ralliesTagged: focusPlayers?.length
      ? tagged.filter((r) => rallyInvolvesAnyPlayer(r, focusPlayers)).length
      : tagged.length,
    ralliesTotal: rallies.length,
    ourTouches: allOur.length,
    possessions,
    firstBall: (() => {
      const hist = emptyHist()
      for (const t of firstBalls) hist[t.quality] += 1
      const attempts = firstBalls.length
      const sum = firstBalls.reduce((a, t) => a + t.quality, 0)
      const zeros = hist[0]
      const threes = hist[3]
      return {
        skill: 'r' as TouchSkill,
        label: 'First ball',
        attempts,
        avg: attempts ? sum / attempts : 0,
        zeros,
        threes,
        zeroPct: attempts ? (zeros / attempts) * 100 : 0,
        threePct: attempts ? (threes / attempts) * 100 : 0,
        hist,
      }
    })(),
    emergencies,
    emergenciesKeptAlive,
    emergenciesWon,
    emergenciesWasted,
    inSystemAttempts,
    inSystemKills,
    winPctAfterGoodFirst: goodFirstN ? (goodFirstWins / goodFirstN) * 100 : 0,
    winPctAfterPoorFirst: poorFirstN ? (poorFirstWins / poorFirstN) * 100 : 0,
    goodFirstN,
    poorFirstN,
    bySkill: TOUCH_SKILLS.map((s) => skillBucket(s.skill, allOur)),
  }
}

function splitPossessions(seq: Touch[]): PlayerTouch[][] {
  const segments: PlayerTouch[][] = []
  let cur: PlayerTouch[] = []
  let started = false
  for (const t of seq) {
    if (isOppTouch(t)) {
      if (cur.length) segments.push(cur)
      cur = []
      started = true
      continue
    }
    cur.push(t)
    started = true
  }
  if (cur.length) segments.push(cur)
  if (!started) return []
  return segments
}

function findInSystem(seg: PlayerTouch[]): { receive: PlayerTouch; set: PlayerTouch; attack: PlayerTouch } | null {
  for (let i = 0; i < seg.length - 2; i++) {
    const a = seg[i]!
    const b = seg[i + 1]!
    const c = seg[i + 2]!
    if (a.skill === 'r' && a.quality >= 2 && b.skill === 's' && b.quality >= 2 && c.skill === 'a') {
      return { receive: a, set: b, attack: c }
    }
  }
  return null
}

export interface PlayerTouchStat {
  name: string
  touches: number
  avg: number
  bySkill: SkillBucket[]
  /** r≤1 contacts. */
  emergencies: number
  emergenciesKeptAlive: number
  keepAlivePct: number
  winsAfterSave: number
  /** Touch immediately after teammate 0/1. */
  cleanups: number
  cleanupAvg: number
  /** First ball after `o`. */
  firstBalls: number
  firstBallAvg: number
  firstBallPoor: number
  /** Their poor first ball that a teammate converted to ≥2 next. */
  bailedOut: number
  bailedOutPct: number
}

export function playerTouchStats(rallies: Rally[], focusPlayers?: string[]): PlayerTouchStat[] {
  const tagged = ralliesWithTouches(rallies)
  type Acc = {
    touches: PlayerTouch[]
    emergencies: number
    emergenciesKeptAlive: number
    winsAfterSave: number
    cleanups: { sum: number; n: number }
    firstBalls: PlayerTouch[]
    firstBallPoor: number
    bailedOut: number
  }
  const by = new Map<string, Acc>()

  const acc = (name: string): Acc => {
    let a = by.get(name)
    if (!a) {
      a = {
        touches: [],
        emergencies: 0,
        emergenciesKeptAlive: 0,
        winsAfterSave: 0,
        cleanups: { sum: 0, n: 0 },
        firstBalls: [],
        firstBallPoor: 0,
        bailedOut: 0,
      }
      by.set(name, a)
    }
    return a
  }

  for (const r of tagged) {
    const indexed = indexTouches(r.touches)
    for (const x of indexed) {
      if (!allowPlayer(x.touch.player, focusPlayers)) continue
      const a = acc(x.touch.player)
      a.touches.push(x.touch)

      if (x.afterOpp) {
        a.firstBalls.push(x.touch)
        if (x.touch.quality <= 1) {
          a.firstBallPoor += 1
          if (x.next && x.next.quality >= 2 && x.next.player !== x.touch.player) a.bailedOut += 1
        }
      }

      if (x.touch.skill === 'r' && x.touch.quality <= 1) {
        a.emergencies += 1
        if (x.next) {
          a.emergenciesKeptAlive += 1
          if (r.won) a.winsAfterSave += 1
        }
      }

      if (x.prev && x.prev.quality <= 1 && x.prev.player !== x.touch.player) {
        a.cleanups.n += 1
        a.cleanups.sum += x.touch.quality
      }
    }
  }

  return [...by.entries()]
    .map(([name, a]) => {
      const touches = a.touches.length
      const sum = a.touches.reduce((s, t) => s + t.quality, 0)
      return {
        name,
        touches,
        avg: touches ? sum / touches : 0,
        bySkill: TOUCH_SKILLS.map((s) => skillBucket(s.skill, a.touches)),
        emergencies: a.emergencies,
        emergenciesKeptAlive: a.emergenciesKeptAlive,
        keepAlivePct: a.emergencies ? (a.emergenciesKeptAlive / a.emergencies) * 100 : 0,
        winsAfterSave: a.winsAfterSave,
        cleanups: a.cleanups.n,
        cleanupAvg: a.cleanups.n ? a.cleanups.sum / a.cleanups.n : 0,
        firstBalls: a.firstBalls.length,
        firstBallAvg: a.firstBalls.length
          ? a.firstBalls.reduce((s, t) => s + t.quality, 0) / a.firstBalls.length
          : 0,
        firstBallPoor: a.firstBallPoor,
        bailedOut: a.bailedOut,
        bailedOutPct: a.firstBallPoor ? (a.bailedOut / a.firstBallPoor) * 100 : 0,
      }
    })
    .sort((a, b) => b.touches - a.touches)
}

/** Win rate by first-ball quality (0–3) after opponent possession. */
export function firstBallOutcome(
  rallies: Rally[],
  focusPlayers?: string[],
): { quality: number; n: number; wins: number; winPct: number }[] {
  const buckets = [0, 1, 2, 3].map((quality) => ({ quality, n: 0, wins: 0, winPct: 0 }))
  for (const r of ralliesWithTouches(rallies)) {
    for (const x of indexTouches(r.touches)) {
      if (!x.afterOpp) continue
      if (!allowPlayer(x.touch.player, focusPlayers)) continue
      const b = buckets[x.touch.quality]!
      b.n += 1
      if (r.won) b.wins += 1
    }
  }
  for (const b of buckets) b.winPct = b.n ? (b.wins / b.n) * 100 : 0
  return buckets
}

/** What follows an emergency dig (r≤1): next touch quality hist + terminal. */
export function afterEmergency(
  rallies: Rally[],
  focusPlayers?: string[],
): { label: string; count: number; color: string }[] {
  let next0 = 0
  let next1 = 0
  let nextGood = 0
  let terminal = 0
  for (const r of ralliesWithTouches(rallies)) {
    for (const x of indexTouches(r.touches)) {
      if (!(x.touch.skill === 'r' && x.touch.quality <= 1)) continue
      if (!allowPlayer(x.touch.player, focusPlayers)) continue
      if (!x.next) {
        terminal += 1
        continue
      }
      if (x.next.quality === 0) next0 += 1
      else if (x.next.quality === 1) next1 += 1
      else nextGood += 1
    }
  }
  return [
    { label: 'Next touch 2–3', count: nextGood, color: '#22c55e' },
    { label: 'Next touch 1', count: next1, color: '#f59e0b' },
    { label: 'Next touch 0', count: next0, color: '#ef4444' },
    { label: 'Died on that dig', count: terminal, color: '#737373' },
  ].filter((x) => x.count > 0)
}

/** Lost rallies: first our 0-touch vs sheet cause player — simple causal split. */
export function breakAttribution(
  rallies: Rally[],
  focusPlayers?: string[],
): {
  firstZeroPlayer: string
  n: number
  alsoCause: number
}[] {
  const map = new Map<string, { n: number; alsoCause: number }>()
  for (const r of ralliesWithTouches(rallies)) {
    if (r.won) continue
    const firstZero = indexTouches(r.touches).find((x) => x.touch.quality === 0)
    if (!firstZero) continue
    if (!allowPlayer(firstZero.touch.player, focusPlayers)) continue
    const name = firstZero.touch.player
    const cur = map.get(name) ?? { n: 0, alsoCause: 0 }
    cur.n += 1
    if (r.players.includes(name)) cur.alsoCause += 1
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([firstZeroPlayer, v]) => ({ firstZeroPlayer, ...v }))
    .sort((a, b) => b.n - a.n)
}
