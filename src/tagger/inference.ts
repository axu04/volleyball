import { isOppTouch, type Touch } from '../lib/touches'

export interface InferredCause {
  cause: string
  players: string[]
}

/**
 * Infer outcomes that are fully described by the touch sequence:
 * an untouched opponent serve is their error, our lone serve is an ace or service error,
 * and another win defaults to Kill / earned for our last player touch.
 */
export function inferTouchOutcome(
  serving: boolean,
  won: boolean | null,
  touches: Touch[],
): InferredCause | null {
  if (!serving && won === true && touches.length === 0) {
    return { cause: 'opp_err', players: [] }
  }
  if (won === null || touches.length === 0) return null

  if (serving) {
    const serve = touches[0]
    if (!isOppTouch(serve) && serve.skill === 'v' && touches.slice(1).every(isOppTouch)) {
      return {
        cause: won ? 'aced_on_them_suckas' : 'serve_err',
        players: [serve.player],
      }
    }
  }

  if (!won) return null
  for (let index = touches.length - 1; index >= 0; index -= 1) {
    const touch = touches[index]
    if (!isOppTouch(touch)) {
      return { cause: 'our_point', players: [touch.player] }
    }
  }
  return null
}
