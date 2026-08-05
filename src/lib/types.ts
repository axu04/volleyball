import type { Touch } from './touches'

export type CauseSide = 'win' | 'loss'

/**
 * earned   - we finished the rally ourselves (kill, tip, roll)
 * ace      - we finished it from the service line
 * gift     - opponent handed it to us
 * conceded - opponent earned it off a ball we had a play on
 * error    - we handed it to them
 */
export type CauseKind = 'earned' | 'ace' | 'gift' | 'conceded' | 'error'

export interface CauseMeta {
  key: string
  label: string
  short: string
  side: CauseSide
  kind: CauseKind
  /** Skill bucket used for error grouping, e.g. "Attacking" */
  group: string
  color: string
}

export interface Rally {
  /** `${sessionId}:${set}:${indexInSet}` */
  id: string
  sessionId: string
  sessionLabel: string
  /** ISO yyyy-mm-dd */
  date: string
  /** Kept as written in the sheet — usually "1", "2", "3", but also things like "et". */
  set: string
  /** 1-based rally number within the set */
  n: number
  serving: boolean
  won: boolean
  cause: string
  players: string[]
  /**
   * Kept as written. Teams of seven run rotations 1–7, and a sheet with more than one line-up
   * distinguishes them with a suffix ("1a".."6a"), so this cannot be a number.
   */
  rotation: string | null
  notes: string
  /**
   * Optional per-contact grades (receive/set/attack/block · 0–3), in rally order.
   * Empty for older sheets that never recorded touches.
   */
  touches: Touch[]
  videoTimestamp: string
  /**
   * Who was at the service line. Derived from the rotation plus the line-up block, and only
   * populated once that mapping has been checked against every serve outcome the sheet tagged
   * by hand. Null on receiving rallies and whenever the check fails.
   */
  server: string | null
  /** running score after this rally, as tracked */
  us: number
  them: number
}

export interface RotationLineup {
  rotation: string
  front: string[]
  back: string[]
  /** Off-court player for 6+1 squads; empty when absent. */
  sub: string
  /** Which line-up block in the sheet this came from, for sheets that record more than one. */
  blockLabel: string
}

export interface SetSummary {
  set: string
  rallies: Rally[]
  trackedUs: number
  trackedThem: number
  officialUs: number | null
  officialThem: number | null
  /** official result when we have it, otherwise the tracked one */
  won: boolean
  /**
   * False when there is no official score and the logged rallies are level, which happens for
   * knock-about extra games. Undecided sets are shown but left out of the win/loss record.
   */
  decided: boolean
}

/** Result of deriving "who served" from the rotation column and the line-up block. */
export interface ServerInference {
  ok: boolean
  byRotation: Record<string, string>
  /** Serve outcomes the sheet tagged by hand that agreed with the derived server. */
  agreed: number
  /** ...and that disagreed. Any disagreement disables the inference entirely. */
  disagreed: number
  note: string
}

export interface Session {
  id: string
  /** e.g. "Jul 16" */
  label: string
  /** ISO yyyy-mm-dd */
  date: string
  fileName: string
  rallies: Rally[]
  sets: SetSummary[]
  lineups: RotationLineup[]
  players: string[]
  warnings: string[]
  serverInference: ServerInference
}
