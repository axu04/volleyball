/** Per-touch grades during a rally: receive / set / attack / block, quality 0–3. */

export type TouchSkill = 'r' | 's' | 'a' | 'b'

export interface Touch {
  player: string
  skill: TouchSkill
  quality: 0 | 1 | 2 | 3
}

export const TOUCH_SKILLS: { skill: TouchSkill; label: string }[] = [
  { skill: 'r', label: 'Receive' },
  { skill: 's', label: 'Set' },
  { skill: 'a', label: 'Attack' },
  { skill: 'b', label: 'Block' },
]

export function formatTouch(t: Touch): string {
  return `${t.skill}${t.quality}`
}

export function formatTouchLabel(t: Touch): string {
  return `${t.player} ${formatTouch(t)}`
}

/** Compact CSV cell: `Alec:r2|Ish:s3|Michelle:a2` */
export function serializeTouches(touches: Touch[]): string {
  return touches.map((t) => `${t.player}:${t.skill}${t.quality}`).join('|')
}

export function parseTouches(raw: string): Touch[] {
  const text = raw.trim()
  if (!text) return []
  const out: Touch[] = []
  for (const part of text.split('|')) {
    const cell = part.trim()
    if (!cell) continue
    const m = cell.match(/^(.+):([rsab])([0-3])$/i)
    if (!m) continue
    out.push({
      player: m[1].trim(),
      skill: m[2].toLowerCase() as TouchSkill,
      quality: +m[3] as 0 | 1 | 2 | 3,
    })
  }
  return out
}
