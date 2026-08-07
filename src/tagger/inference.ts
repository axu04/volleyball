import { isOppTouch, type Touch } from '../lib/touches'

export interface InferredCause {
  cause: string
  players: string[]
}

/** A serve-only rally is an ace when won or a serve error when lost. */
export function inferSingleServeOutcome(
  serving: boolean,
  won: boolean | null,
  touches: Touch[],
): InferredCause | null {
  if (!serving || won === null || touches.length !== 1) return null
  const touch = touches[0]
  if (isOppTouch(touch) || touch.skill !== 'v') return null
  return {
    cause: won ? 'aced_on_them_suckas' : 'serve_err',
    players: [touch.player],
  }
}
