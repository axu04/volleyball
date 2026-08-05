/** Sanity check: parse every sheet in /data and print the headline numbers. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSession } from '../src/lib/parse'
import { coreStats, playerStats, rotationStats, serveStats } from '../src/lib/stats'

const dir = join(import.meta.dirname, '..', 'data')

for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const s = parseSession(file, readFileSync(join(dir, file), 'utf8'))
  console.log(`\n=== ${file} → ${s.date} (${s.label}) ===`)
  console.log(`rallies=${s.rallies.length} players=${s.players.join(', ')}`)

  for (const set of s.sets) {
    console.log(
      `  set ${set.set}: tracked ${set.trackedUs}-${set.trackedThem} | official ${set.officialUs ?? '?'}-${set.officialThem ?? '?'} | ${set.won ? 'W' : 'L'}`,
    )
  }

  console.log('  lineups:', JSON.stringify(s.lineups))

  const c = coreStats(s.rallies)
  console.log(
    `  win% ${c.winPct.toFixed(1)} sideout% ${c.sideoutPct.toFixed(1)} servePt% ${c.servePointPct.toFixed(1)}`,
  )
  console.log(
    `  kills=${c.kills} aces=${c.aces} oppErr=${c.oppErrPoints} (forced=${c.forced} unprompted=${c.unprompted}) | errors=${c.errors} conceded=${c.conceded} serveErr=${c.serveErrs} acedOn=${c.acedOn}`,
  )
  console.log(`  check: won=${c.won} == kills+aces+oppErr=${c.kills + c.aces + c.oppErrPoints}`)
  console.log(`  check: lost=${c.lost} == errors+conceded=${c.errors + c.conceded}`)
  console.log(`  check: oppErr=${c.oppErrPoints} == forced+unprompted=${c.forced + c.unprompted}`)

  console.log(`  server inference: ok=${s.serverInference.ok} agreed=${s.serverInference.agreed} disagreed=${s.serverInference.disagreed}`)
  console.log('  serving:')
  const serves = serveStats(s.rallies)
  for (const v of serves) {
    console.log(
      `    ${v.name.padEnd(9)} serves=${String(v.attempts).padStart(3)} aces=${String(v.aces).padStart(2)} missed=${String(v.errors).padStart(2)} pts=${String(v.pointsWon).padStart(3)} turns=${String(v.turns).padStart(2)} pts/turn=${v.pointsPerTurn.toFixed(2)} best=${v.longestTurn}`,
    )
  }
  console.log(
    `  check: attributed serves=${serves.reduce((a, b) => a + b.attempts, 0)} == serving rallies=${c.serveRallies}`,
  )
  console.log(`  check: attributed aces=${serves.reduce((a, b) => a + b.aces, 0)} == ${c.aces}`)
  console.log(`  check: attributed misses=${serves.reduce((a, b) => a + b.errors, 0)} == ${c.serveErrs}`)

  console.log(
    '  rotations:',
    rotationStats(s.rallies)
      .map((r) => `R${r.rotation} ${r.net >= 0 ? '+' : ''}${r.net}`)
      .join(' '),
  )
  console.log('  players (kills+aces+forced-errors = net):')
  const ps = playerStats(s.rallies)
  for (const p of ps) {
    console.log(
      `    ${p.name.padEnd(9)} ${String(p.kills).padStart(2)}k ${String(p.aces).padStart(2)}a ${String(p.forced).padStart(2)}f = ${String(p.plus).padStart(2)} pts  −${String(p.errors).padStart(2)} err  net ${p.net >= 0 ? '+' : ''}${p.net}   beaten=${p.beaten}`,
    )
  }
  const sum = (fn: (p: (typeof ps)[number]) => number) => ps.reduce((a, b) => a + fn(b), 0)
  console.log(
    `  check (double-counts rows naming 2 players): kills ${sum((p) => p.kills)} vs ${c.kills}, aces ${sum((p) => p.aces)} vs ${c.aces}, forced ${sum((p) => p.forced)} vs ${c.forced}, errors ${sum((p) => p.errors)} vs ${c.errors}`,
  )

  if (s.warnings.length) console.log('  warnings:', s.warnings)
}
