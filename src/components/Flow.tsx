import { Area, AreaChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { causeMeta } from '../lib/causes'
import { scoreFlow } from '../lib/stats'
import type { Rally, Session } from '../lib/types'
import { Card, Empty } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

function FlowTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="tip">
      <div className="t-title">
        Rally {p.n} · {p.us}–{p.them}
      </div>
      <div className="t-row" style={{ color: p.won ? 'var(--win)' : 'var(--loss)' }}>
        {p.won ? 'Won' : 'Lost'} — {p.cause}
      </div>
      {p.players && <div className="t-row">{p.players}</div>}
      {p.notes && <div className="t-row" style={{ fontStyle: 'italic', marginTop: 3 }}>“{p.notes}”</div>}
    </div>
  )
}

export function Flow({ rallies, sessions }: { rallies: Rally[]; sessions: Session[] }) {
  const keys = [...new Set(rallies.map((r) => `${r.sessionId}|${r.set}`))]
  if (!keys.length) return <Empty>No rallies match these filters.</Empty>

  return (
    <div className="grid" style={{ gap: 14 }}>
      {keys.map((key, keyIndex) => {
        const gradientId = `lead-gradient-${keyIndex}`
        const [sessionId, setNo] = key.split('|')
        const session = sessions.find((s) => s.id === sessionId)
        const setSummary = session?.sets.find((s) => s.set === setNo)
        const setRallies = rallies.filter((r) => r.sessionId === sessionId && r.set === setNo)
        const flow = scoreFlow(setRallies)
        const final = flow[flow.length - 1]
        const biggestLead = Math.max(...flow.map((f) => f.lead))
        const biggestDeficit = Math.min(...flow.map((f) => f.lead))
        // Where y=0 falls as a fraction of the chart height, so the fill can be green above the
        // line and red below it rather than colouring a deficit like a lead.
        const zeroOffset =
          biggestLead <= 0 ? 0 : biggestDeficit >= 0 ? 1 : biggestLead / (biggestLead - biggestDeficit)

        return (
          <Card
            key={key}
            title={`${session?.label ?? ''} · Set ${setNo}`}
            action={
              <span className="hint">
                {setSummary?.officialUs !== null && setSummary?.officialUs !== undefined
                  ? `official ${setSummary.officialUs}–${setSummary.officialThem} · `
                  : ''}
                logged {setSummary?.trackedUs ?? final.us}–{setSummary?.trackedThem ?? final.them} · peak lead +
                {Math.max(0, biggestLead)} · worst deficit {Math.min(0, biggestDeficit)}
              </span>
            }
          >
            <div style={{ height: 150 }}>
              <ResponsiveContainer>
                <AreaChart data={flow} margin={{ left: -22, right: 10, top: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset={0} stopColor="#22c55e" stopOpacity={0.5} />
                      <stop offset={zeroOffset} stopColor="#22c55e" stopOpacity={0.05} />
                      <stop offset={zeroOffset} stopColor="#ef4444" stopOpacity={0.05} />
                      <stop offset={1} stopColor="#ef4444" stopOpacity={0.45} />
                    </linearGradient>
                    <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset={zeroOffset} stopColor="#4ade80" />
                      <stop offset={zeroOffset} stopColor="#f87171" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="n" {...axis} axisLine={false} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <ReferenceLine y={0} stroke="#333333" />
                  <Tooltip content={<FlowTip />} />
                  <Area
                    type="stepAfter"
                    dataKey="lead"
                    stroke={`url(#${gradientId}-stroke)`}
                    strokeWidth={1.8}
                    fill={`url(#${gradientId})`}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ height: 130, marginTop: 6 }}>
              <ResponsiveContainer>
                <LineChart data={flow} margin={{ left: -22, right: 10, top: 6, bottom: 0 }}>
                  <XAxis dataKey="n" {...axis} axisLine={false} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<FlowTip />} />
                  <Line type="stepAfter" dataKey="us" stroke="#ededed" strokeWidth={2} dot={false} name="Us" />
                  <Line type="stepAfter" dataKey="them" stroke="#ef4444" strokeWidth={2} dot={false} name="Them" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 10 }}>
              {setRallies.map((r) => {
                const meta = causeMeta(r.cause, r.won)
                return (
                  <span
                    key={r.id}
                    title={`#${r.n} ${r.us}-${r.them} · ${meta.label}${r.players.length ? ` · ${r.players.join(', ')}` : ''}${r.notes ? ` · ${r.notes}` : ''}`}
                    style={{
                      width: 11,
                      height: 18,
                      borderRadius: 3,
                      background: meta.color,
                      opacity: r.won ? 0.95 : 0.72,
                      border: r.won ? '1px solid rgba(255,255,255,.18)' : '1px solid transparent',
                    }}
                  />
                )
              })}
            </div>
            <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
              Each tile is one rally in order, coloured by how it ended. Hover for the note.
            </div>
          </Card>
        )
      })}
    </div>
  )
}
