import type { LineupDraft, OfficialScore, RotationPlan, TaggedRally } from './types'
import { normalizeLineup } from './lineupRotation'
import { serializeTouches } from '../lib/touches'
import { formatVideoTimestamp } from './youtube'

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Tagging CSV: rally log (incl. Touches) on the left; videos, official scores, and
 * 6+1 line-ups (front row, then back+sub) in the spare columns.
 */
export function exportTaggerCsv(args: {
  rallies: TaggedRally[]
  youtubeUrl: string
  videoTitle: string
  lineups: LineupDraft[]
  rotationPlans?: RotationPlan[]
  officialScores: OfficialScore[]
}): string {
  const { rallies, youtubeUrl, videoTitle, lineups, officialScores } = args
  const rotationPlans = args.rotationPlans?.length
    ? args.rotationPlans
    : [{ id: 'plan-a', label: 'Rotation A', sets: [], rotations: lineups.map((lineup) => lineup.rotation), lineups }]

  const header = [
    'Timestamp',
    'Set',
    'Serving?',
    'Won?',
    'Cause',
    'Player',
    'Rotation',
    'Notes',
    'Touches',
    'Videos',
    '',
    '',
    'official scores',
    ...rotationPlans.flatMap(() => ['', '', '', '', '']),
  ]

  const scoreBySet = new Map(officialScores.map((s) => [s.set, s]))
  const setsInOrder: string[] = []
  for (const r of rallies) {
    if (!setsInOrder.includes(r.set)) setsInOrder.push(r.set)
  }
  for (const s of officialScores) {
    if (!setsInOrder.includes(s.set)) setsInOrder.push(s.set)
  }

  type LineupPair = { marker: string; names: string[] }
  const planPairs = rotationPlans.map((plan) => {
    const pairs: LineupPair[] = []
    for (const raw of plan.lineups) {
      const lineup = normalizeLineup(raw)
      if (!lineup.front.some(Boolean) && !lineup.back.some(Boolean) && !lineup.sub) continue
      pairs.push({ marker: lineup.rotation, names: [...lineup.front] })
      pairs.push({ marker: '', names: [...lineup.back, lineup.sub] })
    }
    const setLabel = plan.sets.length
      ? ` for set${plan.sets.length === 1 ? '' : 's'} ${plan.sets.join(', ')}`
      : ''
    return { heading: `rotation${setLabel}:`, pairs }
  })

  const body: string[][] = []
  const totalRows = Math.max(rallies.length, ...planPairs.map((plan) => plan.pairs.length + 1), setsInOrder.length)

  for (let i = 0; i < totalRows; i++) {
    const r = rallies[i]
    const setKey = setsInOrder[i]
    const score = setKey ? scoreBySet.get(setKey) : undefined

    const log = r
      ? [
          formatVideoTimestamp(r.videoSeconds),
          r.set,
          r.serving ? 'Serving' : 'Receiving',
          r.won ? 'Yes' : 'No',
          r.cause,
          r.players.join(', '),
          r.rotation,
          r.notes,
          serializeTouches(r.touches ?? []),
        ]
      : ['', '', '', '', '', '', '', '', '']

    // Per-point Videos column — typically one URL per set, stamped on every rally row.
    let videos = ''
    if (r) videos = r.youtubeUrl || youtubeUrl
    else if (i === 1 && videoTitle) videos = videoTitle

    const spare = ['', '', score ? `${score.us}-${score.them}` : '']

    const lineupCells = planPairs.flatMap((plan) => {
      if (i === 0) return [plan.heading, '', '', '', '']
      const pair = plan.pairs[i - 1]
      if (!pair) return ['', '', '', '', '']
      if (pair.marker) {
        return [pair.marker, pair.names[0] ?? '', pair.names[1] ?? '', pair.names[2] ?? '', '']
      }
      return ['', pair.names[0] ?? '', pair.names[1] ?? '', pair.names[2] ?? '', pair.names[3] ?? '']
    })

    body.push([...log, videos, ...spare, ...lineupCells])
  }

  if (body.length === 0) {
    body.push([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      youtubeUrl,
      '',
      '',
      '',
      ...planPairs.flatMap((plan) => [plan.heading, '', '', '', '']),
    ])
  }

  return [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
}

export function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
