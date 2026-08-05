import type { LineupDraft, OfficialScore, TaggedRally } from './types'
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
  officialScores: OfficialScore[]
}): string {
  const { rallies, youtubeUrl, videoTitle, lineups, officialScores } = args

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
    '',
    '',
    '',
    '',
    '',
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
  const pairs: LineupPair[] = []
  for (const raw of lineups) {
    const l = normalizeLineup(raw)
    if (!l.front.some(Boolean) && !l.back.some(Boolean) && !l.sub) continue
    pairs.push({ marker: l.rotation, names: [...l.front] })
    pairs.push({ marker: '', names: [...l.back, l.sub] })
  }

  const body: string[][] = []
  const totalRows = Math.max(rallies.length, pairs.length + 1, setsInOrder.length)

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

    let lineupCells: string[]
    if (i === 0) {
      lineupCells = ['rotation:', '', '', '', '']
    } else {
      const pair = pairs[i - 1]
      if (!pair) {
        lineupCells = ['', '', '', '', '']
      } else if (pair.marker) {
        lineupCells = [pair.marker, pair.names[0] ?? '', pair.names[1] ?? '', pair.names[2] ?? '', '']
      } else {
        // Back L/M/R + sub
        lineupCells = [
          '',
          pair.names[0] ?? '',
          pair.names[1] ?? '',
          pair.names[2] ?? '',
          pair.names[3] ?? '',
        ]
      }
    }

    body.push([...log, videos, ...spare, ...lineupCells])
  }

  if (body.length === 0) {
    body.push(['', '', '', '', '', '', '', '', '', youtubeUrl, '', '', '', 'rotation:', '', '', '', ''])
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
