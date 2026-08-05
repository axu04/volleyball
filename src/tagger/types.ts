import type { Touch } from '../lib/touches'

export interface TaggedRally {
  id: string
  /** Seconds into the video when the rally was committed. */
  videoSeconds: number
  /** YouTube URL active when this rally was tagged (usually one film per set). */
  youtubeUrl: string
  set: string
  serving: boolean
  won: boolean
  cause: string
  players: string[]
  rotation: string
  notes: string
  /** Optional per-contact grades during the rally. */
  touches: Touch[]
}

export interface LineupDraft {
  rotation: string
  /** Left, middle, right — court positions 4, 3, 2. */
  front: string[]
  /** Left, middle, right — court positions 5, 6, 1 (server is right back). */
  back: string[]
  /** Off-court player; enters at front-left on the next clockwise rotate. */
  sub: string
}

export interface LineupBlock {
  id: string
  /** Written into the CSV under the spare columns, e.g. "rotation" or "rotation for game 3". */
  label: string
  lineups: LineupDraft[]
}

export interface OfficialScore {
  set: string
  us: number
  them: number
}

export interface TaggerDraft {
  version: 1
  date: string
  youtubeUrl: string
  videoTitle: string
  roster: string[]
  set: string
  rotation: string
  /** Ordered rotation labels available while tagging. Defaults to 1–7. */
  rotations: string[]
  serving: boolean
  rallies: TaggedRally[]
  /** One entry per rotation in `rotations` — who is on court in that spot. */
  lineups: LineupDraft[]
  /** @deprecated kept so old drafts still load; migrated into `lineups` on read. */
  lineupBlocks?: LineupBlock[]
  officialScores: OfficialScore[]
  updatedAt: number
}

export function defaultRotations(): string[] {
  return ['1', '2', '3', '4', '5', '6', '7']
}

export function emptyLineups(rotations: string[]): LineupDraft[] {
  return rotations.map((rotation) => ({
    rotation,
    front: ['', '', ''],
    back: ['', '', ''],
    sub: '',
  }))
}

export function emptyDraft(partial?: Partial<TaggerDraft>): TaggerDraft {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const rotations = partial?.rotations ?? defaultRotations()
  const lineups = partial?.lineups ?? emptyLineups(rotations)
  const { rotations: _r, lineups: _l, ...rest } = partial ?? {}
  return {
    version: 1,
    date: iso,
    youtubeUrl: '',
    videoTitle: '',
    roster: [],
    set: '1',
    rotation: '1',
    serving: true,
    rallies: [],
    officialScores: [],
    updatedAt: Date.now(),
    ...rest,
    rotations,
    lineups,
  }
}
