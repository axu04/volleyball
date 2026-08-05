/** Cross-session totals, to work out which blind spots are actually worth closing. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSession } from '../src/lib/parse'
import { coreStats, playerStats } from '../src/lib/stats'

const dir = join(import.meta.dirname, '..', 'data')
const sessions = readdirSync(dir)
  .filter((f) => f.endsWith('.csv'))
  .map((f) => parseSession(f, readFileSync(join(dir, f), 'utf8')))

const all = sessions.flatMap((s) => s.rallies)
const c = coreStats(all)

const pctOf = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`

console.log(`sessions=${sessions.length} rallies=${c.rallies}  won=${c.won} lost=${c.lost} (${pctOf(c.won, c.rallies)})`)
console.log(`\nPOINTS WON (${c.won})`)
console.log(`  aces          ${c.aces}  ${pctOf(c.aces, c.won)}`)
console.log(`  opp errors    ${c.oppErrPoints}  ${pctOf(c.oppErrPoints, c.won)}   (forced ${c.forced} / unprompted ${c.unprompted})`)
console.log(`  kills         ${c.kills}  ${pctOf(c.kills, c.won)}`)
console.log(`\nPOINTS LOST (${c.lost})`)
console.log(`  our errors    ${c.errors}  ${pctOf(c.errors, c.lost)}`)
console.log(`  opp earned    ${c.conceded}  ${pctOf(c.conceded, c.lost)}`)
console.log(`\nSERVE / RECEIVE`)
console.log(`  serving  ${c.serveRallies}  point rate ${pctOf(c.servePointsWon, c.serveRallies)}  ace ${pctOf(c.aces, c.serveRallies)}  miss ${pctOf(c.serveErrs, c.serveRallies)}`)
console.log(`  receiving ${c.recvRallies}  side-out ${pctOf(c.sideouts, c.recvRallies)}  aced on ${c.acedOn} (${pctOf(c.acedOn, c.recvRallies)})`)

console.log(`\nPER SESSION`)
for (const s of sessions) {
  const x = coreStats(s.rallies)
  console.log(
    `  ${s.label}  rallies=${String(x.rallies).padStart(3)} win=${pctOf(x.won, x.rallies).padStart(6)} sideout=${pctOf(x.sideouts, x.recvRallies).padStart(6)} kills=${String(x.kills).padStart(2)} aces=${String(x.aces).padStart(2)} acedOn=${String(x.acedOn).padStart(2)} errors=${String(x.errors).padStart(3)}`,
  )
}

console.log(`\nERROR MIX (all sessions)`)
const byCause = new Map<string, number>()
for (const r of all) if (!r.won) byCause.set(r.cause, (byCause.get(r.cause) ?? 0) + 1)
for (const [k, v] of [...byCause.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(22)} ${String(v).padStart(3)}  ${pctOf(v, c.lost)}`)

console.log(`\nPLAYERS (all sessions)`)
for (const p of playerStats(all))
  console.log(
    `  ${p.name.padEnd(9)} net ${String(p.net).padStart(4)}  ${String(p.kills).padStart(2)}k ${String(p.aces).padStart(2)}a ${String(p.forced).padStart(2)}f  err ${String(p.errors).padStart(3)}`,
  )

console.log(`\nHOW OFTEN IS A RALLY DECIDED BY AN ATTACK AT ALL?`)
const attackEnded = all.filter((r) => ['our_point', 'opp_point', 'attack_out', 'attack_net'].includes(r.cause)).length
console.log(`  rallies ending on somebody's attack: ${attackEnded} of ${c.rallies} (${pctOf(attackEnded, c.rallies)})`)
const serveEnded = all.filter((r) => ['aced_on_them_suckas', 'aced_on_us', 'serve_err'].includes(r.cause)).length
console.log(`  rallies ending on the serve:         ${serveEnded} of ${c.rallies} (${pctOf(serveEnded, c.rallies)})`)
