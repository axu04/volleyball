import { isOppTouch, type Touch } from '../lib/touches'

export interface InferredCause {
  cause: string
  players: string[]
}

/**
 * Infer outcomes that are fully described by the touch sequence:
 * an untouched opponent serve is their error, while our lone serve is an ace or service error.
 */
export function inferTouchOutcome(
  serving: boolean,
  won: boolean | null,
  touches: Touch[],
): InferredCause | null {
  if (!serving && won === true && touches.length === 0) {
    return { cause: 'opp_err', players: [] }
  }
  if (!serving || won === null || touches.length === 0) return null
  const serve = touches[0]
  if (isOppTouch(serve) || serve.skill !== 'v') return null
  if (touches.slice(1).some((touch) => !isOppTouch(touch))) return null
  return {
    cause: won ? 'aced_on_them_suckas' : 'serve_err',
    players: [serve.player],
  }
}
