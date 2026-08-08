import { highlightClipsForPlayer, highlightRoster } from '../src/highlights/highlights'
import type { Rally, Session } from '../src/lib/types'

function rally(overrides: Partial<Rally>): Rally {
  return {
    id: 'session:1:1',
    sessionId: 'session',
    sessionLabel: 'Aug 7',
    date: '2026-08-07',
    set: '1',
    n: 1,
    serving: false,
    won: true,
    cause: 'our_point',
    players: [],
    rotation: '1',
    notes: '',
    touches: [],
    videoTimestamp: '0:20',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    server: null,
    us: 1,
    them: 0,
    ...overrides,
  }
}

const rallies = [
  rally({
    touches: [
      { player: 'Amber', skill: 'r', quality: 3 },
      { player: 'Avy', skill: 's', quality: 3 },
      { player: 'Jess', skill: 'a', quality: 3 },
      { opp: true },
      { player: 'Jess', skill: 'a', quality: 3 },
      { opp: true },
    ],
  }),
  rally({
    id: 'session:1:2',
    n: 2,
    won: false,
    cause: 'attack_out',
    touches: [{ player: 'Jess', skill: 'a', quality: 3 }],
    videoTimestamp: '0:40',
    us: 1,
    them: 1,
  }),
  rally({
    id: 'session:1:3',
    n: 3,
    serving: true,
    touches: [
      { player: 'Sofia', skill: 'v', quality: 3 },
      { opp: true },
      { player: 'Amber', skill: 'b', quality: 3 },
    ],
    videoTimestamp: '1:00',
    us: 2,
    them: 1,
  }),
]

const session: Session = {
  id: 'session',
  label: 'Aug 7',
  date: '2026-08-07',
  fileName: '2026-08-07.csv',
  youtubeUrl: rallies[0]!.youtubeUrl,
  youtubeBySet: { '1': rallies[0]!.youtubeUrl },
  rallies,
  sets: [],
  lineups: [],
  players: ['Amber', 'Avy', 'Jess', 'Sofia'],
  warnings: [],
  serverInference: { ok: false, byRotation: {}, agreed: 0, disagreed: 0, note: '' },
}

const jess = highlightClipsForPlayer([session], 'Jess')
if (jess.filter((clip) => clip.kind === 'finish').length !== 1) {
  throw new Error('only a won rally should become a rally-ending highlight')
}
if (jess.filter((clip) => clip.kind === 'attack3').length !== 2) {
  throw new Error('quality-3 attacks should be deduplicated per rally, not discarded across rallies')
}
if (jess.find((clip) => clip.kind === 'finish')?.touch.player !== 'Jess') {
  throw new Error('the rally-ending highlight should use the last player touch before trailing opponent markers')
}

const amber = highlightClipsForPlayer([session], 'Amber')
if (
  amber.filter((clip) => clip.kind === 'finish').length !== 1 ||
  amber.filter((clip) => clip.kind === 'receive3').length !== 1 ||
  amber.filter((clip) => clip.kind === 'block3').length !== 1
) {
  throw new Error('quality-3 receives and blocks should overlap with rally-ending clips when applicable')
}

const sofia = highlightClipsForPlayer([session], 'Sofia')
if (sofia.filter((clip) => clip.kind === 'serve3').length !== 1) {
  throw new Error('quality-3 serves should appear in the serve category')
}

const roster = highlightRoster([session])
if (roster.join(',') !== 'Amber,Avy,Jess,Sofia') {
  throw new Error(`unexpected highlight roster: ${roster.join(',')}`)
}

console.log('highlight reel selection ok')
