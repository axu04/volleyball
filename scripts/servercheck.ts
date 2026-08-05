/** Why did server inference reject a sheet? Lists the rotations whose server is inconsistent. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSession } from '../src/lib/parse'

const dir = join(import.meta.dirname, '..', 'data')

for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const s = parseSession(file, readFileSync(join(dir, file), 'utf8'))
  if (s.serverInference.ok) continue

  console.log(`\n=== ${file}: ${s.serverInference.note}`)
  console.log('derived from line-up block:')
  for (const [rot, name] of Object.entries(s.serverInference.byRotation)) console.log(`   rot ${rot} -> ${name}`)

  console.log('\nwho the sheet actually tagged on serve outcomes, by rotation and set:')
  const seen = new Map<string, Set<string>>()
  for (const r of s.rallies) {
    if (!['serve_err', 'aced_on_them_suckas'].includes(r.cause) || !r.rotation || r.players.length !== 1) continue
    const key = `rot ${r.rotation}`
    if (!seen.has(key)) seen.set(key, new Set())
    seen.get(key)!.add(`${r.players[0]} (set ${r.set})`)
  }
  for (const [rot, names] of [...seen.entries()].sort()) {
    const derived = s.serverInference.byRotation[rot.replace('rot ', '')]
    const tagged = [...names]
    const conflict = tagged.some((t) => !t.startsWith(derived))
    console.log(`   ${rot}: derived=${derived ?? '—'} tagged=${tagged.join(', ')} ${conflict ? '  <-- CONFLICT' : ''}`)
  }
}
