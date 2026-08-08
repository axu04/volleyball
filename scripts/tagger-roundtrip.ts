/** Round-trip check: export a tagged session and parse it with the dashboard parser. */
import { exportTaggerCsv } from '../src/tagger/exportCsv'
import { autofillLineupsFrom, emptyCourtLineup, isLineupComplete } from '../src/tagger/lineupRotation'
import { parseSession } from '../src/lib/parse'
import { importTaggerCsv, mergeTaggerCsv } from '../src/tagger/csvDraft'
import { inferLastTouchPlayer, inferTouchOutcome } from '../src/tagger/inference'
import { createPlanForSet } from '../src/tagger/rotationPlans'
import { addRotation, advanceAfterRally } from '../src/tagger/state'
import { emptyDraft, type LineupDraft, type RotationPlan, type TaggedRally } from '../src/tagger/types'

const inferredOpponentServeError = inferTouchOutcome(false, true, [])
if (inferredOpponentServeError?.cause !== 'opp_err' || inferredOpponentServeError.players.length !== 0) {
  throw new Error('an untouched opponent serve should infer an opponent error with no player')
}
if (inferTouchOutcome(true, true, []) || inferTouchOutcome(false, false, [])) {
  throw new Error('empty touches should only infer a winning receive outcome')
}

const inferredAce = inferTouchOutcome(true, true, [{ player: 'Sofia', skill: 'v', quality: 3 }])
if (inferredAce?.cause !== 'aced_on_them_suckas' || inferredAce.players[0] !== 'Sofia') {
  throw new Error('single-touch winning serve should infer an ace')
}
const inferredError = inferTouchOutcome(true, false, [{ player: 'Sofia', skill: 'v', quality: 0 }])
if (inferredError?.cause !== 'serve_err' || inferredError.players[0] !== 'Sofia') {
  throw new Error('single-touch losing serve should infer a serve error')
}
const inferredAceWithOpp = inferTouchOutcome(true, true, [
  { player: 'Sofia', skill: 'v', quality: 3 },
  { opp: true },
])
if (inferredAceWithOpp?.cause !== 'aced_on_them_suckas') {
  throw new Error('serve followed only by an opponent marker should still infer an ace')
}
const inferredKillAfterServe = inferTouchOutcome(true, true, [
  { player: 'Sofia', skill: 'v', quality: 3 },
  { opp: true },
  { player: 'Amber', skill: 'r', quality: 2 },
  { player: 'Jess', skill: 'a', quality: 3 },
  { opp: true },
])
if (inferredKillAfterServe?.cause !== 'our_point' || inferredKillAfterServe.players[0] !== 'Jess') {
  throw new Error('a won rally after a returned serve should infer a kill for the last player touch')
}
const inferredReceiveKill = inferTouchOutcome(false, true, [
  { player: 'Avy', skill: 'r', quality: 2 },
  { player: 'Amber', skill: 's', quality: 3 },
  { player: 'Alec', skill: 'a', quality: 3 },
])
if (inferredReceiveKill?.cause !== 'our_point' || inferredReceiveKill.players[0] !== 'Alec') {
  throw new Error('a receiving win should infer a kill for the last player touch')
}
const inferredLossPlayer = inferLastTouchPlayer([
  { player: 'Avy', skill: 'r', quality: 2 },
  { player: 'Amber', skill: 's', quality: 1 },
  { opp: true },
])
if (inferredLossPlayer !== 'Amber') {
  throw new Error('a loss should suggest the last player touch')
}

const openingSideout = advanceAfterRally({
  serving: false,
  won: true,
  rotation: '1',
  rotations: ['1', '2', '3'],
  isFirstRallyOfSet: true,
})
if (!openingSideout.serving || openingSideout.rotation !== '1') {
  throw new Error('opening receive win should keep the starting rotation')
}
const laterSideout = advanceAfterRally({
  serving: false,
  won: true,
  rotation: '1',
  rotations: ['1', '2', '3'],
})
if (!laterSideout.serving || laterSideout.rotation !== '2') {
  throw new Error('later receive win should advance the rotation')
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

const planA: RotationPlan = {
  id: 'plan-a',
  label: 'Rotation A',
  sets: ['1', '2'],
  rotations: lineups.map((lineup) => lineup.rotation),
  lineups,
}
const split = createPlanForSet([planA], '2', planA.id)
if (addRotation(split.plan.rotations, split.plan.lineups).added !== '8a') {
  throw new Error('set-specific plans must preserve their suffix when adding a rotation')
}
split.plan.lineups[0] = {
  ...split.plan.lineups[0],
  front: ['Amber', 'Alec', 'Avy'],
  back: ['Ish', 'Sofia', 'Michelle'],
}
const multiPlanCsv = exportTaggerCsv({
  rallies: [
    rallies[0],
    { ...rallies[0], id: 'set-2-plan', set: '2', rotation: split.plan.rotations[0] },
  ],
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoTitle: 'two plans',
  lineups,
  rotationPlans: split.plans,
  officialScores: [],
})
const multiPlanSession = parseSession('2026-08-02.csv', multiPlanCsv)
if (multiPlanSession.lineups.length !== 14) throw new Error('multiple rotation plans did not round-trip')
const importedPlans = importTaggerCsv('2026-08-02.csv', multiPlanCsv).draft.rotationPlans
if (importedPlans.length !== 2 || !importedPlans.some((plan) => plan.sets.includes('2'))) {
  throw new Error('set-specific rotation plan was not restored')
}
const editedMultiPlan = importTaggerCsv('2026-08-02.csv', multiPlanCsv, 'saved-multi-plan').draft
const set2Rally = editedMultiPlan.rallies.find((rally) => rally.set === '2')
if (!set2Rally) throw new Error('set 2 rally was not imported')
set2Rally.notes = 'edited set 2'
const mergedMultiPlan = mergeTaggerCsv('2026-08-02.csv', multiPlanCsv, editedMultiPlan)
if (mergedMultiPlan.changes.map((change) => change.set).join(',') !== '2') {
  throw new Error('editing set 2 should not rewrite other set rotation plans')
}
const mergedMultiDraft = importTaggerCsv('2026-08-02.csv', mergedMultiPlan.csv).draft
if (mergedMultiDraft.rotationPlans.length !== 2) {
  throw new Error('repo merge lost a set-specific rotation plan')
}

const imported = importTaggerCsv('2026-08-02.csv', csv)
if (imported.draft.rallies.length !== rallies.length) throw new Error('import lost rallies')
if (imported.draft.rallies[0].videoSeconds !== rallies[0].videoSeconds) throw new Error('import lost timestamp')
if (imported.draft.rallies[0].touches.length !== rallies[0].touches.length) throw new Error('import lost touches')
if (imported.draft.officialScores[0]?.us !== 25) throw new Error('import lost official score')

const continued = importTaggerCsv('2026-08-02.csv', csv, 'saved-sha').draft
continued.rallies.push({
  ...rallies[0],
  id: 'continued-set-2',
  set: '2',
  youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
})
const continuedMerge = mergeTaggerCsv('2026-08-02.csv', csv, continued)
if (continuedMerge.changes.map((change) => change.set).join(',') !== '2') {
  throw new Error('continued tagging should only append the changed set')
}
const continuedSession = parseSession('2026-08-02.csv', continuedMerge.csv)
if (continuedSession.sets.find((set) => set.set === '1')?.rallies.length !== rallies.length) {
  throw new Error('continued tagging duplicated a preserved set')
}
if (continuedSession.sets.find((set) => set.set === '2')?.rallies.length !== 1) {
  throw new Error('continued tagging did not append exactly one new-set rally')
}

const set2 = emptyDraft({
  date: '2026-08-02',
  set: '2',
  rallies: [
    {
      ...rallies[0],
      id: 'set-2',
      set: '2',
      youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    },
  ],
  officialScores: [{ set: '2', us: 25, them: 20 }],
  lineups,
  rotations: lineups.map((lineup) => lineup.rotation),
})
const merged = mergeTaggerCsv('2026-08-02.csv', csv, set2)
const mergedSession = parseSession('2026-08-02.csv', merged.csv)
if (mergedSession.sets.length !== 2) throw new Error('per-set merge did not preserve the existing set')
if (mergedSession.sets.find((set) => set.set === '1')?.rallies.length !== rallies.length) {
  throw new Error('per-set merge changed the existing set')
}
if (mergedSession.sets.find((set) => set.set === '2')?.rallies.length !== 1) {
  throw new Error('per-set merge did not add the current set')
}
console.log('import and per-set merge ok')
