/**
 * Raw audit: counts straight off the CSV with no interpretation, so the dashboard's
 * aggregations can be checked against the sheet itself.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Papa from 'papaparse'

const dir = join(import.meta.dirname, '..', 'data')

for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const text = readFileSync(join(dir, file), 'utf8')
  const rows = (Papa.parse<string[]>(text, { skipEmptyLines: false }).data as string[][]).map((r) =>
    Array.isArray(r) ? r : [],
  )
  const head = rows.findIndex((r) => r.some((c) => String(c).trim().toLowerCase().replace(/\?/g, '') === 'cause'))
  console.log(`\n########## ${file}`)
  console.log('HEADER:', JSON.stringify(rows[head]))

  const body = rows.slice(head + 1).filter((r) => String(r[4] ?? '').trim() || String(r[3] ?? '').trim())
  console.log(`data rows: ${body.length}`)

  const hdr = rows[head].map((h) => String(h).trim().toLowerCase().replace(/[?:]/g, ''))
  const col = (...names: string[]) => hdr.findIndex((h) => names.some((n) => h === n || h.startsWith(n)))
  const C = {
    set: col('set'),
    phase: col('serving'),
    won: col('won'),
    cause: col('cause'),
    player: col('player'),
    rot: col('rotation'),
    notes: col('notes'),
  }
  console.log('COLS:', JSON.stringify(C))
  const get = (r: string[], i: number) => String(r[i] ?? '').trim()

  // 1. cause x phase x result
  const cross = new Map<string, number>()
  for (const r of body) {
    cross.set(`${get(r, C.cause)} | ${get(r, C.phase)} | won=${get(r, C.won)}`, (cross.get(`${get(r, C.cause)} | ${get(r, C.phase)} | won=${get(r, C.won)}`) ?? 0) + 1)
  }
  console.log('\n-- cause | phase | won --')
  for (const [k, v] of [...cross.entries()].sort()) console.log(`   ${v.toString().padStart(3)}  ${k}`)

  // 2. phase/result sanity
  const tally = (fn: (r: string[]) => boolean) => body.filter(fn).length
  console.log('\n-- totals --')
  console.log(`   serving rows   : ${tally((r) => get(r, C.phase) === 'Serving')}`)
  console.log(`   receiving rows : ${tally((r) => get(r, C.phase) === 'Receiving')}`)
  console.log(`   other phase    : ${tally((r) => !['Serving', 'Receiving'].includes(get(r, C.phase)))}`)
  console.log(`   won=Yes        : ${tally((r) => get(r, C.won) === 'Yes')}`)
  console.log(`   won=No         : ${tally((r) => get(r, C.won) === 'No')}`)
  console.log(`   blank cause    : ${tally((r) => !get(r, C.cause))}`)
  console.log(`   blank player   : ${tally((r) => !get(r, C.player))}`)
  console.log(`   multi player   : ${tally((r) => get(r, C.player).includes(','))}`)

  // 3. impossible combinations
  console.log('\n-- suspicious rows --')
  const flag = (label: string, fn: (r: string[]) => boolean) => {
    const hits = body.filter(fn)
    if (hits.length) {
      console.log(`   ${label}: ${hits.length}`)
      for (const r of hits) console.log(`      set${get(r, C.set)} rot${get(r, C.rot)} ${get(r, C.phase)} won=${get(r, C.won)} ${get(r, C.cause)} ${get(r, C.player)} "${get(r, C.notes)}"`)
    }
  }
  flag('serve_err while receiving', (r) => get(r, C.cause) === 'serve_err' && get(r, C.phase) !== 'Serving')
  flag('ace while receiving', (r) => get(r, C.cause) === 'aced_on_them_suckas' && get(r, C.phase) !== 'Serving')
  flag('aced_on_us while serving', (r) => get(r, C.cause) === 'aced_on_us' && get(r, C.phase) !== 'Receiving')
  flag('won=Yes tagged as our error', (r) =>
    get(r, C.won) === 'Yes' && ['serve_err', 'attack_out', 'attack_net', 'aced_on_us', 'coverage'].includes(get(r, C.cause)))
  flag('blank rotation', (r) => !/^[1-6]$/.test(get(r, C.rot)))

  // 4. rally-scoring consistency: winner of rally N serves rally N+1
  console.log('\n-- serve/receive sequence check --')
  let breaks = 0
  const bySet = new Map<string, string[][]>()
  for (const r of body) {
    const s = get(r, C.set)
    if (!bySet.has(s)) bySet.set(s, [])
    bySet.get(s)!.push(r)
  }
  for (const [s, list] of bySet) {
    for (let i = 1; i < list.length; i++) {
      const shouldServe = get(list[i - 1], C.won) === 'Yes'
      const doesServe = get(list[i], C.phase) === 'Serving'
      if (shouldServe !== doesServe) {
        breaks++
        console.log(`   set${s} rally${i + 1}: prev won=${get(list[i - 1], C.won)} but phase=${get(list[i], C.phase)}`)
      }
    }
  }
  console.log(`   sequence breaks: ${breaks}`)

  // 5. rotation consistency: rotate only after winning while receiving
  console.log('\n-- rotation sequence check --')
  let rotBreaks = 0
  for (const [s, list] of bySet) {
    for (let i = 1; i < list.length; i++) {
      const prevRot = +get(list[i - 1], C.rot)
      const rot = +get(list[i], C.rot)
      const sideOut = get(list[i - 1], C.won) === 'Yes' && get(list[i - 1], C.phase) === 'Receiving'
      const expected = sideOut ? (prevRot % 6) + 1 : prevRot
      if (rot !== expected) {
        rotBreaks++
        console.log(`   set${s} rally${i + 1}: expected rot${expected} got rot${rot}`)
      }
    }
  }
  console.log(`   rotation breaks: ${rotBreaks}`)

  // 6. server inferred from the lineup block (position 1 = last name in the back row)
  const lineupCol = 9
  const lineups: Record<number, { front: string[]; back: string[] }> = {}
  let cur = -1
  for (const r of rows.slice(head + 1)) {
    const marker = get(r, lineupCol)
    const names = [get(r, lineupCol + 1), get(r, lineupCol + 2), get(r, lineupCol + 3)].filter(Boolean)
    if (/^\d+$/.test(marker)) {
      cur = +marker
      lineups[cur] = { front: names, back: [] }
    } else if (cur > 0 && lineups[cur] && lineups[cur].back.length === 0 && names.length) {
      lineups[cur].back = names
    }
  }
  console.log('\n-- inferred server per rotation (last name in back row = position 1) --')
  const serverOf: Record<number, string> = {}
  for (const [rot, l] of Object.entries(lineups)) {
    serverOf[+rot] = l.back[l.back.length - 1]
    console.log(`   rot ${rot}: front=${l.front.join('/')} back=${l.back.join('/')} -> server ${serverOf[+rot]}`)
  }

  console.log('\n-- does the tagged player on serve outcomes match the inferred server? --')
  let match = 0
  let mismatch = 0
  for (const r of body) {
    if (!['serve_err', 'aced_on_them_suckas'].includes(get(r, C.cause))) continue
    const expected = serverOf[+get(r, C.rot)]
    const actual = get(r, C.player)
    if (expected === actual) match++
    else {
      mismatch++
      console.log(`   set${get(r, C.set)} rot${get(r, C.rot)} ${get(r, C.cause)}: tagged "${actual}" expected "${expected}"`)
    }
  }
  console.log(`   match=${match} mismatch=${mismatch}`)

  // 7. serves per player using the inferred server across ALL serving rallies
  console.log('\n-- serve attempts per player (every serving rally, via rotation) --')
  const serveAgg: Record<string, { att: number; aces: number; errs: number; ptsWon: number }> = {}
  for (const r of body) {
    if (get(r, C.phase) !== 'Serving') continue
    const server = serverOf[+get(r, C.rot)]
    if (!server) continue
    serveAgg[server] ??= { att: 0, aces: 0, errs: 0, ptsWon: 0 }
    serveAgg[server].att++
    if (get(r, C.cause) === 'aced_on_them_suckas') serveAgg[server].aces++
    if (get(r, C.cause) === 'serve_err') serveAgg[server].errs++
    if (get(r, C.won) === 'Yes') serveAgg[server].ptsWon++
  }
  for (const [name, v] of Object.entries(serveAgg).sort((a, b) => b[1].att - a[1].att)) {
    console.log(
      `   ${name.padEnd(9)} attempts=${String(v.att).padStart(3)} aces=${String(v.aces).padStart(2)} errors=${String(v.errs).padStart(2)} pointsWonOnServe=${String(v.ptsWon).padStart(3)}`,
    )
  }

  // 8. opp_err attribution — is a player named?
  console.log('\n-- opp_err rows: named vs unnamed --')
  const oppErr = body.filter((r) => get(r, C.cause) === 'opp_err')
  console.log(`   total=${oppErr.length} named=${oppErr.filter((r) => get(r, C.player)).length} unnamed=${oppErr.filter((r) => !get(r, C.player)).length}`)
  const named: Record<string, number> = {}
  for (const r of oppErr) if (get(r, C.player)) named[get(r, C.player)] = (named[get(r, C.player)] ?? 0) + 1
  console.log('   ', JSON.stringify(named))
  console.log('   sample notes on named rows:')
  for (const r of oppErr.filter((r) => get(r, C.player) && get(r, C.notes)).slice(0, 10))
    console.log(`      ${get(r, C.player)}: "${get(r, C.notes)}"`)

  // 9. opp_point rows
  console.log('\n-- opp_point rows --')
  for (const r of body.filter((r) => get(r, C.cause) === 'opp_point'))
    console.log(`   set${get(r, C.set)} rot${get(r, C.rot)} ${get(r, C.phase)} ${get(r, C.player)} "${get(r, C.notes)}"`)

  // 10. per-player raw tally over every cause
  console.log('\n-- raw player x cause (multi-player rows credited to each) --')
  const pc: Record<string, Record<string, number>> = {}
  for (const r of body) {
    for (const p of get(r, C.player).split(',').map((x) => x.trim()).filter(Boolean)) {
      pc[p] ??= {}
      pc[p][get(r, C.cause)] = (pc[p][get(r, C.cause)] ?? 0) + 1
    }
  }
  const causes = [...new Set(body.map((r) => get(r, C.cause)))].sort()
  console.log('   player'.padEnd(12) + causes.map((c) => c.slice(0, 11).padStart(12)).join(''))
  for (const [p, m] of Object.entries(pc).sort()) {
    console.log('   ' + p.padEnd(9) + causes.map((c) => String(m[c] ?? 0).padStart(12)).join(''))
  }
  console.log('   ' + 'TOTAL'.padEnd(9) + causes.map((c) => String(body.filter((r) => get(r, C.cause) === c).length).padStart(12)).join(''))
  console.log('   (TOTAL is rows; player rows double-count when two names are tagged)')
}
