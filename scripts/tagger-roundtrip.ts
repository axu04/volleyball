/** Round-trip check: export a tiny tagged session and parse it with the dashboard parser. */
import { exportTaggerCsv } from '../src/tagger/exportCsv'
import { parseSession } from '../src/lib/parse'
import type { LineupDraft, TaggedRally } from '../src/tagger/types'

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
  },
]

const lineups: LineupDraft[] = [
  { rotation: '1', front: ['Avy', 'Amber', 'Alec'], back: ['Michelle', 'Ish', 'Sofia'] },
  { rotation: '2', front: ['Michelle', 'Avy', 'Amber'], back: ['Ish', 'Sofia', 'Alec'] },
]

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
console.log('lineups', JSON.stringify(session.lineups))
console.log('serverInference ok', session.serverInference.ok)
