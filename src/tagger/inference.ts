import { isOppTouch, type Touch } from '../lib/touches'

export interface InferredCause {
  cause: string
  players: string[]
}

/** A rally where our only player touch is the serve is an ace when won or a serve error when lost. */
export function inferSingleServeOutcome(
  serving: boolean,
  won: boolean | null,
  touches: Touch[],
): InferredCause | null {
  if (!serving || won === null || touches.length === 0) return null
  const serve = touches[0]
  if (isOppTouch(serve) || serve.skill !== 'v') return null
  if (touches.slice(1).some((touch) => !isOppTouch(touch))) return null
  return {
    cause: won ? 'aced_on_them_suckas' : 'serve_err',
    players: [serve.player],
  }
}
