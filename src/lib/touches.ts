/** Per-touch grades: serve / receive / set / attack / block (0–3), plus opponent possession. */

export type TouchSkill = 'v' | 'r' | 's' | 'a' | 'b'

/** Our contact with a grade. */
export interface PlayerTouch {
  player: string
  skill: TouchSkill
  quality: 0 | 1 | 2 | 3
}

/** Ball just came from / went to the opponent — starts a new possession for analysis. */
export interface OppMarker {
  opp: true
}

export type Touch = PlayerTouch | OppMarker

export const TOUCH_SKILLS: { skill: TouchSkill; label: string }[] = [
  { skill: 'v', label: 'Serve' },
  { skill: 'r', label: 'Receive' },
  { skill: 's', label: 'Set' },
  { skill: 'a', label: 'Attack' },
  { skill: 'b', label: 'Block' },
]

export const TOUCH_GRADE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'] as const

export function isOppTouch(t: Touch): t is OppMarker {
  return 'opp' in t && t.opp === true
}

export function formatTouch(t: PlayerTouch): string {
  return `${t.skill}${t.quality}`
}

export function formatTouchLabel(t: Touch): string {
  if (isOppTouch(t)) return 'o'
  return `${t.player} ${formatTouch(t)}`
}

/** Compact CSV: `o|Alec:r1|Avy:r0` or `Sofia:v2|o|Alec:r2|…` */
export function serializeTouches(touches: Touch[]): string {
  return touches
    .map((t) => (isOppTouch(t) ? 'o' : `${t.player}:${t.skill}${t.quality}`))
    .join('|')
}

export function parseTouches(raw: string): Touch[] {
  const text = raw.trim()
  if (!text) return []
  const out: Touch[] = []
  for (const part of text.split('|')) {
    const cell = part.trim()
    if (!cell) continue
    if (/^o$/i.test(cell)) {
      out.push({ opp: true })
      continue
    }
    const m = cell.match(/^(.+):([vrsab])([0-3])$/i)
    if (!m) continue
    out.push({
      player: m[1].trim(),
      skill: m[2].toLowerCase() as TouchSkill,
      quality: +m[3] as 0 | 1 | 2 | 3,
    })
  }
  return out
}
