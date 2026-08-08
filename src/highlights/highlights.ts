import { clipWindow } from '../film/clipWindow'
import { isOppTouch, type PlayerTouch, type TouchSkill } from '../lib/touches'
import type { Rally, Session } from '../lib/types'
import { extractVideoId } from '../tagger/youtube'

export type HighlightKind = 'finish' | 'receive3' | 'set3' | 'attack3'

export interface HighlightClip {
  id: string
  kind: HighlightKind
  rally: Rally
  touch: PlayerTouch
  youtubeUrl: string
  start: number
  end: number
}

const PERFECT_KINDS: Array<{ skill: TouchSkill; kind: Exclude<HighlightKind, 'finish'> }> = [
  { skill: 'r', kind: 'receive3' },
  { skill: 's', kind: 'set3' },
  { skill: 'a', kind: 'attack3' },
]

function lastPlayerTouch(rally: Rally): PlayerTouch | null {
  for (let index = rally.touches.length - 1; index >= 0; index -= 1) {
    const touch = rally.touches[index]
    if (!isOppTouch(touch)) return touch
  }
  return null
}

function lastPerfectTouch(rally: Rally, player: string, skill: TouchSkill): PlayerTouch | null {
  for (let index = rally.touches.length - 1; index >= 0; index -= 1) {
    const touch = rally.touches[index]
    if (!isOppTouch(touch) && touch.player === player && touch.skill === skill && touch.quality === 3) {
      return touch
    }
  }
  return null
}

function compareClips(a: HighlightClip, b: HighlightClip): number {
  if (a.rally.date !== b.rally.date) return b.rally.date.localeCompare(a.rally.date)
  if (a.rally.sessionId !== b.rally.sessionId) return a.rally.sessionId.localeCompare(b.rally.sessionId)
  if (a.rally.set !== b.rally.set) {
    return String(a.rally.set).localeCompare(String(b.rally.set), undefined, { numeric: true })
  }
  return a.rally.n - b.rally.n
}

export function highlightClipsForPlayer(sessions: Session[], player: string): HighlightClip[] {
  const clips: HighlightClip[] = []

  for (const session of sessions) {
    for (const rally of session.rallies) {
      const youtubeUrl = rally.youtubeUrl || session.youtubeBySet[rally.set] || session.youtubeUrl
      if (!youtubeUrl || !extractVideoId(youtubeUrl)) continue

      const last = lastPlayerTouch(rally)
      if (rally.won && last?.player === player) {
        const window = clipWindow(rally, session)
        if (window) {
          clips.push({
            id: `finish:${rally.id}`,
            kind: 'finish',
            rally,
            touch: last,
            youtubeUrl,
            ...window,
          })
        }
      }

      for (const { skill, kind } of PERFECT_KINDS) {
        const touch = lastPerfectTouch(rally, player, skill)
        if (!touch) continue
        const window = clipWindow(rally, session, { lookback: 24, defaultClip: 28, maxClip: 40 })
        if (!window) continue
        clips.push({
          id: `${kind}:${rally.id}`,
          kind,
          rally,
          touch,
          youtubeUrl,
          ...window,
        })
      }
    }
  }

  return clips.sort(compareClips)
}

export function highlightRoster(sessions: Session[]): string[] {
  const names = new Set<string>()
  for (const session of sessions) {
    for (const rally of session.rallies) {
      const youtubeUrl = rally.youtubeUrl || session.youtubeBySet[rally.set] || session.youtubeUrl
      if (!youtubeUrl || !extractVideoId(youtubeUrl)) continue

      const last = lastPlayerTouch(rally)
      if (rally.won && last) names.add(last.player)
      for (const touch of rally.touches) {
        if (!isOppTouch(touch) && touch.quality === 3 && ['r', 's', 'a'].includes(touch.skill)) {
          names.add(touch.player)
        }
      }
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}
