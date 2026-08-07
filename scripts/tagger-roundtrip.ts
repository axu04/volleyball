/** Round-trip check: export a tagged session and parse it with the dashboard parser. */
import { exportTaggerCsv } from '../src/tagger/exportCsv'
import { autofillLineupsFrom, emptyCourtLineup, isLineupComplete } from '../src/tagger/lineupRotation'
import { parseSession } from '../src/lib/parse'
import { inferSingleServeOutcome } from '../src/tagger/inference'
import type { LineupDraft, TaggedRally } from '../src/tagger/types'

const inferredAce = inferSingleServeOutcome(true, true, [{ player: 'Sofia', skill: 'v', quality: 3 }])
if (inferredAce?.cause !== 'aced_on_them_suckas' || inferredAce.players[0] !== 'Sofia') {
  throw new Error('single-touch winning serve should infer an ace')
}
const inferredError = inferSingleServeOutcome(true, false, [{ player: 'Sofia', skill: 'v', quality: 0 }])
if (inferredError?.cause !== 'serve_err' || inferredError.players[0] !== 'Sofia') {
  throw new Error('single-touch losing serve should infer a serve error')
}
const inferredAceWithOpp = inferSingleServeOutcome(true, true, [
  { player: 'Sofia', skill: 'v', quality: 3 },
  { opp: true },
])
if (inferredAceWithOpp?.cause !== 'aced_on_them_suckas') {
  throw new Error('serve followed only by an opponent marker should still infer an ace')
}
if (
  inferSingleServeOutcome(true, true, [
    { player: 'Sofia', skill: 'v', quality: 3 },
    { opp: true },
    { player: 'Amber', skill: 'r', quality: 2 },
  ])
) {
  throw new Error('a later player touch must disable serve-only inference')
}

const rallies: TaggedRally[] = [
  {
    id: '1',
    videoSeconds: 95,
    set: '1',
    serving: false,
    won: true,
    cause: 'opp_err',
    players: [],
    rotation: '1',
    notes: 'served net',
    touches: [
      { player: 'Alec', skill: 'r', quality: 2 },
      { player: 'Ish', skill: 's', quality: 3 },
      { player: 'Michelle', skill: 'a', quality: 1 },
    ],
  },
  {
    id: '2',
    videoSeconds: 110,
    set: '1',
    serving: true,
    won: true,
    cause: 'aced_on_them_suckas',
    players: ['Sofia'],
    rotation: '1',
    notes: '',
    touches: [],
  },
  {
    id: '3',
    videoSeconds: 125,
    set: '1',
    serving: true,
    won: false,
    cause: 'serve_err',
    players: ['Sofia'],
    rotation: '1',
    notes: 'out',
    touches: [],
  },
]

const base: LineupDraft = {
  rotation: '1',
  front: ['Avy', 'Amber', 'Alec'],
  back: ['Michelle', 'Ish', 'Sofia'],
  sub: 'Christie',
}

const shells = ['1', '2', '3', '4', '5', '6', '7'].map((rotation) =>
  rotation === '1' ? base : emptyCourtLineup(rotation),
)
const lineups = autofillLineupsFrom(0, shells)
if (!lineups.every(isLineupComplete)) throw new Error('autofill left incomplete lineups')
if (lineups[1].front[0] !== 'Christie') throw new Error('sub should enter front-left on rotate')
if (lineups[1].sub !== 'Michelle') throw new Error('left-back should sit after rotate')

const csv = exportTaggerCsv({
  rallies,
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoTitle: 'test game',
  lineups,
  officialScores: [{ set: '1', us: 25, them: 11 }],
})

console.log(csv)
const session = parseSession('2026-08-02.csv', csv)
console.log('rallies', session.rallies.length)
console.log('touches', JSON.stringify(session.rallies[0].touches))
console.log('lineup1', JSON.stringify(session.lineups[0]))
console.log('lineup2', JSON.stringify(session.lineups[1]))
console.log('serverInference ok', session.serverInference.ok)
