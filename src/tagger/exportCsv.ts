import type { LineupDraft, OfficialScore, TaggedRally } from './types'
import { formatVideoTimestamp } from './youtube'

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Serialize a tagging session into the exact CSV shape the dashboard parser expects.
 * Column layout mirrors the hand-written sheets: log on the left, line-ups and official
 * scores in the spare columns to the right.
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
    'Videos',
    '',
    '',
    'official scores',
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
  for (const l of lineups) {
    if (!l.front.some(Boolean) && !l.back.some(Boolean)) continue
    pairs.push({ marker: l.rotation, names: l.front.filter(Boolean) })
    pairs.push({ marker: '', names: l.back.filter(Boolean) })
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
        ]
      : ['', '', '', '', '', '', '', '']

    let videos = ''
    if (i === 0 && youtubeUrl) videos = youtubeUrl
    else if (i === 1 && videoTitle) videos = videoTitle

    const spare = ['', '', score ? `${score.us}-${score.them}` : '']

    let lineupCells: string[]
    if (i === 0) {
      lineupCells = ['rotation:', '', '', '']
    } else {
      const pair = pairs[i - 1]
      if (!pair) {
        lineupCells = ['', '', '', '']
      } else if (pair.marker) {
        lineupCells = [pair.marker, pair.names[0] ?? '', pair.names[1] ?? '', pair.names[2] ?? '']
      } else if (pair.names.length <= 3) {
        lineupCells = ['', pair.names[0] ?? '', pair.names[1] ?? '', pair.names[2] ?? '']
      } else {
        lineupCells = [pair.names[0] ?? '', pair.names[1] ?? '', pair.names[2] ?? '', pair.names[3] ?? '']
      }
    }

    body.push([...log, videos, ...spare, ...lineupCells])
  }

  if (body.length === 0) {
    body.push(['', '', '', '', '', '', '', '', youtubeUrl, '', '', '', 'rotation:', '', '', ''])
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
