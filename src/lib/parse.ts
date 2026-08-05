import Papa from 'papaparse'
import { parseTouches } from './touches'
import type { Rally, RotationLineup, ServerInference, Session, SetSummary } from './types'
import { extractVideoId } from '../tagger/youtube'

/** Causes that can only happen on our own serve, so the sheet's Player must be the server. */
const SERVE_OUTCOMES = new Set(['serve_err', 'aced_on_them_suckas'])

/** Used when a file name only gives us month/day (e.g. "7_16"). */
const FALLBACK_YEAR = new Date().getFullYear()

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

const norm = (v: unknown) => String(v ?? '').trim()
const lower = (v: unknown) => norm(v).toLowerCase()

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * Sheets get named all sorts of ways ("volleyball mania - 7_16.csv", "2026-07-16.csv").
 * Try the file name first, then sniff a written-out date from the sheet body.
 */
export function inferDate(fileName: string, body: string): string | null {
  const base = fileName.replace(/\.csv$/i, '')

  const iso = base.match(/(20\d{2})[-_./](\d{1,2})[-_./](\d{1,2})/)
  if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`

  const written = body.match(
    new RegExp(`\\b(${MONTHS.join('|')})\\w*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(20\\d{2})`, 'i'),
  )

  const md = base.match(/(?:^|[^\d])(\d{1,2})[-_./](\d{1,2})(?:[-_./](\d{2,4}))?(?!\d)/)
  if (md) {
    const month = +md[1]
    const day = +md[2]
    let year = md[3] ? +md[3] : null
    if (year !== null && year < 100) year += 2000
    if (year === null && written) year = +written[3]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year ?? FALLBACK_YEAR}-${pad(month)}-${pad(day)}`
    }
  }

  if (written) {
    const month = MONTHS.findIndex((m) => m.startsWith(written[1].toLowerCase())) + 1
    if (month > 0) return `${written[3]}-${pad(month)}-${pad(+written[2])}`
  }

  return null
}

export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function splitPlayers(raw: string, canon: Map<string, string>): string[] {
  return raw
    .split(/[,/&+]|\band\b/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const key = p.toLowerCase()
      if (!canon.has(key)) canon.set(key, p)
      return canon.get(key)!
    })
}

interface ColumnMap {
  set: number
  serving: number
  won: number
  cause: number
  player: number
  rotation: number
  notes: number
  touches: number
  timestamp: number
  score: number
  videos: number
}

function findColumns(header: string[]): ColumnMap | null {
  const find = (...names: string[]) =>
    header.findIndex((h) => {
      const clean = lower(h).replace(/[?:]/g, '').trim()
      return names.some((n) => clean === n || clean.startsWith(n))
    })

  const cause = find('cause')
  if (cause < 0) return null

  return {
    set: find('set', 'game'),
    serving: find('serving', 'serve/receive', 'phase'),
    won: find('won', 'result'),
    cause,
    player: find('player', 'who'),
    rotation: find('rotation', 'rot'),
    notes: find('notes', 'note'),
    touches: find('touches', 'touch sequence'),
    timestamp: find('timestamp', 'time'),
    score: find('official scores', 'official score', 'score'),
    videos: find('videos', 'video', 'youtube'),
  }
}

/** "1", "7", "1a" — a rotation label is a number with an optional suffix. */
const ROTATION_ID = /^\d{1,2}[a-z]?$/i

/**
 * A line-up block lives in the spare columns under a "rotation" heading.
 * Each rotation is two rows: front (L/M/R), then back (L/M/R) + optional sub.
 */
function parseLineups(rows: string[][], startCol: number, endCol: number, blockLabel: string): RotationLineup[] {
  const out: RotationLineup[] = []
  let current: RotationLineup | null = null

  const namesIn = (row: string[], from: number) => {
    const cells: string[] = []
    for (let c = from; c <= endCol; c++) cells.push(norm(row[c]))
    return cells.filter(Boolean)
  }

  for (const row of rows) {
    const marker = norm(row[startCol])
    if (/rotation/i.test(marker)) continue

    if (ROTATION_ID.test(marker)) {
      current = {
        rotation: marker.toLowerCase(),
        front: namesIn(row, startCol + 1).slice(0, 3),
        back: [],
        sub: '',
        blockLabel,
      }
      out.push(current)
      continue
    }

    if (current && current.back.length === 0) {
      const names = namesIn(row, startCol)
      if (names.length) {
        current.back = names.slice(0, 3)
        current.sub = names[3] ?? ''
      }
    }
  }

  return out.filter((l) => l.front.length > 0)
}

/**
 * The server is right back (position 1) — the third back-row name.
 * Checked against hand-tagged aces / service errors before we trust it.
 */
function inferServers(lineups: RotationLineup[], rallies: Rally[]): ServerInference {
  const byRotation: Record<string, string> = {}
  for (const l of lineups) {
    const server = l.back[2] ?? l.back[l.back.length - 1]
    if (server) byRotation[l.rotation] = server
  }

  if (!Object.keys(byRotation).length) {
    return { ok: false, byRotation, agreed: 0, disagreed: 0, note: 'No line-up block in the sheet.' }
  }

  let agreed = 0
  let disagreed = 0
  for (const r of rallies) {
    if (!SERVE_OUTCOMES.has(r.cause) || r.rotation === null || r.players.length !== 1) continue
    if (byRotation[r.rotation] === r.players[0]) agreed += 1
    else disagreed += 1
  }

  if (disagreed > 0) {
    return {
      ok: false,
      byRotation,
      agreed,
      disagreed,
      note: `Line-up block disagrees with ${disagreed} hand-tagged serve outcome${disagreed === 1 ? '' : 's'}, so serves are not attributed.`,
    }
  }

  if (agreed === 0) {
    return { ok: false, byRotation, agreed, disagreed, note: 'No hand-tagged serve outcomes to check against.' }
  }

  return {
    ok: true,
    byRotation,
    agreed,
    disagreed,
    note: `Server derived from rotation, agreeing with all ${agreed} serve outcomes the sheet tagged by hand.`,
  }
}

/**
 * Find every line-up block. The heading is written freehand ("rotation:", "rotation for games 1
 * and 2"), so we match on the word rather than the exact string, and only in the spare columns to
 * the right of the log so the log's own "Rotation" header cannot trigger it.
 */
function findLineupBlocks(rows: string[][], after: number): Array<{ col: number; label: string }> {
  const found = new Map<number, string>()
  for (const row of rows) {
    for (let c = after; c < row.length; c++) {
      const cell = norm(row[c])
      if (/rotation/i.test(cell) && !found.has(c)) found.set(c, cell.replace(/:$/, ''))
    }
  }
  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([col, label]) => ({ col, label }))
}

/** Sorts "1", "2", "10", "1a", "et" into a sensible order. */
export function compareLabels(a: string, b: string): number {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  const aNum = !Number.isNaN(na)
  const bNum = !Number.isNaN(nb)
  if (aNum && bNum && na !== nb) return na - nb
  if (aNum !== bNum) return aNum ? -1 : 1
  return a.localeCompare(b)
}

export function parseSession(fileName: string, text: string): Session {
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: false })
  const rows = (data as string[][]).map((r) => (Array.isArray(r) ? r : []))

  const headerIdx = rows.findIndex((r) => r.some((c) => lower(c).replace(/[?:]/g, '') === 'cause'))
  if (headerIdx < 0) throw new Error(`${fileName}: could not find a "Cause" column`)

  const cols = findColumns(rows[headerIdx])
  if (!cols) throw new Error(`${fileName}: could not map columns`)

  const body = rows.slice(headerIdx + 1)
  const warnings: string[] = []
  const canon = new Map<string, string>()

  const date = inferDate(fileName, text) ?? '1970-01-01'
  if (date === '1970-01-01') warnings.push('Could not read a date from the file name.')
  const id = `${date}__${fileName}`
  const label = date === '1970-01-01' ? fileName.replace(/\.csv$/i, '') : formatDateLabel(date)

  // Start looking one column past the log itself. The score column can sit among the spare
  // columns too, but it only ever holds "25-22" style text, which never parses as a name.
  const logEnd = Math.max(cols.notes, cols.touches, cols.player, cols.rotation, cols.cause, 0) + 1
  const blocks = findLineupBlocks(body, logEnd)
  const lineups = blocks.flatMap(({ col, label }, i) => {
    const endCol = i + 1 < blocks.length ? blocks[i + 1].col - 1 : Math.max(...body.map((r) => r.length))
    return parseLineups(body, col, endCol, label)
  })

  const officialScores: Array<{ us: number; them: number }> = []
  if (cols.score >= 0) {
    for (const row of body) {
      const m = norm(row[cols.score]).match(/^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/)
      if (m) officialScores.push({ us: +m[1], them: +m[2] })
    }
  }

  let youtubeUrl = ''
  let lastRallyUrl = ''
  const normalizeVideoCell = (cell: string): string => {
    if (!cell || !/youtu\.?be|youtube\.com/i.test(cell)) return ''
    const id = extractVideoId(cell)
    return id ? `https://www.youtube.com/watch?v=${id}` : cell.trim()
  }
  const considerVideoCell = (cell: string) => {
    if (youtubeUrl || !cell) return
    const url = normalizeVideoCell(cell)
    if (url) youtubeUrl = url
  }
  if (cols.videos >= 0) {
    for (const row of body) considerVideoCell(norm(row[cols.videos]))
  }
  if (!youtubeUrl) {
    for (const row of body) {
      for (const cell of row) {
        considerVideoCell(norm(cell))
        if (youtubeUrl) break
      }
      if (youtubeUrl) break
    }
  }

  const rallies: Rally[] = []
  const counters = new Map<string, { n: number; us: number; them: number }>()
  let lastSet = '1'

  for (const row of body) {
    const cause = lower(row[cols.cause])
    const wonRaw = lower(row[cols.won])
    if (!cause && !wonRaw) continue

    // Set labels are kept verbatim so an "et" (extra time) block stays separate from set 3
    // instead of being silently folded into it.
    const setRaw = norm(row[cols.set])
    const set = setRaw || lastSet
    if (!setRaw) warnings.push(`A rally tagged "${cause}" has no set number; filed under set ${set}.`)
    lastSet = set

    const c = counters.get(set) ?? { n: 0, us: 0, them: 0 }
    const won = wonRaw.startsWith('y') || wonRaw === 'true' || wonRaw === 'w'
    c.n += 1
    if (won) c.us += 1
    else c.them += 1
    counters.set(set, c)

    const rotRaw = norm(row[cols.rotation])
    const rotation = ROTATION_ID.test(rotRaw) ? rotRaw.toLowerCase() : null

    const servingRaw = lower(row[cols.serving])
    const serving = servingRaw.startsWith('serv') || servingRaw === 'yes' || servingRaw === 's'

    if (!cause) warnings.push(`Set ${set} rally ${c.n} has no cause tagged.`)

    // Per-rally film link. A fresh URL in Videos updates the carry-forward; blank cells inherit
    // the last URL so older sheets that only stamped the first row still work.
    let rallyYoutube = ''
    if (cols.videos >= 0) {
      const fromCell = normalizeVideoCell(norm(row[cols.videos]))
      if (fromCell) lastRallyUrl = fromCell
      rallyYoutube = lastRallyUrl
    }
    if (!rallyYoutube) rallyYoutube = youtubeUrl

    rallies.push({
      id: `${id}:${set}:${c.n}`,
      sessionId: id,
      sessionLabel: label,
      date,
      set,
      n: c.n,
      serving,
      won,
      cause,
      players: splitPlayers(norm(row[cols.player]), canon),
      rotation,
      notes: norm(row[cols.notes]),
      touches: cols.touches >= 0 ? parseTouches(norm(row[cols.touches])) : [],
      videoTimestamp: norm(row[cols.timestamp]),
      youtubeUrl: rallyYoutube,
      server: null,
      us: c.us,
      them: c.them,
    })
  }

  const serverInference = inferServers(lineups, rallies)
  if (serverInference.ok) {
    for (const r of rallies) {
      if (r.serving && r.rotation !== null) r.server = serverInference.byRotation[r.rotation] ?? null
    }
  }

  const setNumbers = [...new Set(rallies.map((r) => r.set))].sort(compareLabels)
  const sets: SetSummary[] = setNumbers.map((set, i) => {
    const setRallies = rallies.filter((r) => r.set === set)
    const trackedUs = setRallies.filter((r) => r.won).length
    const trackedThem = setRallies.length - trackedUs
    const official = officialScores[i] ?? null
    return {
      set,
      rallies: setRallies,
      trackedUs,
      trackedThem,
      officialUs: official?.us ?? null,
      officialThem: official?.them ?? null,
      won: official ? official.us > official.them : trackedUs > trackedThem,
      decided: Boolean(official) || trackedUs !== trackedThem,
    }
  })

  for (const s of sets) {
    if (s.officialUs === null || s.officialThem === null) continue
    const drift = Math.abs(s.officialUs - s.trackedUs) + Math.abs(s.officialThem - s.trackedThem)
    if (drift > 0) {
      warnings.push(
        `Set ${s.set}: logged ${s.trackedUs}-${s.trackedThem} but official was ${s.officialUs}-${s.officialThem} (${drift} rall${drift === 1 ? 'y' : 'ies'} missing).`,
      )
    }
  }

  const players = [...new Set(rallies.flatMap((r) => r.players))].sort((a, b) => a.localeCompare(b))

  const youtubeBySet: Record<string, string> = {}
  for (const r of rallies) {
    if (r.youtubeUrl && !youtubeBySet[r.set]) youtubeBySet[r.set] = r.youtubeUrl
  }
  if (!youtubeUrl) {
    youtubeUrl = Object.values(youtubeBySet)[0] ?? ''
  }
  if (!youtubeUrl) {
    warnings.push('No YouTube URL found in the Videos column — error film clips need a link per set.')
  }

  return {
    id,
    label,
    date,
    fileName,
    youtubeUrl,
    youtubeBySet,
    rallies,
    sets,
    lineups,
    players,
    warnings,
    serverInference,
  }
}
