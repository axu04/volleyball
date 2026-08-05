import {
  Bar as RBar,
  BarChart,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { rotationStats } from '../lib/stats'
import type { Rally, Session } from '../lib/types'
import { Card, Empty, SortableTable, fmtPct, fmtSigned, playerColor } from './ui'
import type { Column } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

export function Rotations({ rallies, sessions }: { rallies: Rally[]; sessions: Session[] }) {
  const rots = rotationStats(rallies)
  if (!rots.length) return <Empty>No rotations tagged in these rallies.</Empty>

  const best = [...rots].sort((a, b) => b.net - a.net)[0]
  const worst = [...rots].sort((a, b) => a.net - b.net)[0]

  const columns: Column<(typeof rots)[number]>[] = [
    {
      key: 'rotation',
      label: 'Rotation',
      align: 'left',
      value: (r) => r.rotation,
      render: (r) => <span className="name-cell">R{r.rotation.toUpperCase()}</span>,
    },
    {
      key: 'net',
      label: 'Net',
      value: (r) => r.net,
      render: (r) => <b style={{ color: r.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>{fmtSigned(r.net)}</b>,
    },
    { key: 'won', label: 'W', value: (r) => r.won, render: (r) => r.won },
    { key: 'lost', label: 'L', value: (r) => r.lost, render: (r) => r.lost },
    {
      key: 'winPct',
      label: 'Win %',
      value: (r) => r.winPct,
      render: (r) => <span style={{ color: r.winPct >= 50 ? 'var(--win)' : 'var(--loss)' }}>{fmtPct(r.winPct)}</span>,
    },
    {
      key: 'sideoutPct',
      label: 'Side-out %',
      value: (r) => r.sideoutPct,
      title: 'Rally win rate while receiving in this rotation',
      render: (r) => fmtPct(r.sideoutPct),
    },
    {
      key: 'servePointPct',
      label: 'Serve pt %',
      value: (r) => r.servePointPct,
      title: 'Rally win rate while serving in this rotation',
      render: (r) => fmtPct(r.servePointPct),
    },
    { key: 'kills', label: 'Kills', value: (r) => r.kills, render: (r) => r.kills },
    { key: 'aces', label: 'Aces', value: (r) => r.aces, render: (r) => r.aces },
    {
      key: 'errors',
      label: 'Errors',
      value: (r) => r.errors,
      render: (r) => <span style={{ color: 'var(--loss)' }}>{r.errors}</span>,
    },
    {
      key: 'errorRate',
      label: 'Err rate',
      value: (r) => r.errorRate,
      render: (r) => <span className="muted">{fmtPct(r.errorRate)}</span>,
    },
    { key: 'rallies', label: 'Rallies', value: (r) => r.rallies, render: (r) => r.rallies },
  ]

  const radarData = rots.map((r) => ({
    rotation: `R${r.rotation}`,
    'Side-out %': +r.sideoutPct.toFixed(1),
    'Serve pt %': +r.servePointPct.toFixed(1),
  }))

  const lineups = sessions.flatMap((s) => s.lineups.map((l) => ({ ...l, session: s })))
  const uniqueLineups = lineups.filter(
    (l, i) => lineups.findIndex((x) => x.rotation === l.rotation && x.session.id === l.session.id) === i,
  )

  return (
    <>
      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Card title="Net points by rotation" hint={`best R${best.rotation} · worst R${worst.rotation}`}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={rots} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
                <XAxis dataKey="rotation" tickFormatter={(v) => `R${v}`} {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} allowDecimals={false} />
                <ReferenceLine y={0} stroke="#333333" />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,.04)' }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">Rotation {payload[0].payload.rotation}</div>
                        <div className="t-row">
                          {payload[0].payload.won}–{payload[0].payload.lost} · {fmtSigned(payload[0].payload.net)} net
                        </div>
                        <div className="t-row">Side-out {fmtPct(payload[0].payload.sideoutPct)}</div>
                        <div className="t-row">Serve point {fmtPct(payload[0].payload.servePointPct)}</div>
                      </div>
                    ) : null
                  }
                />
                <RBar dataKey="net" radius={[5, 5, 0, 0]} barSize={44}>
                  {rots.map((r) => (
                    <Cell key={r.rotation} fill={r.net >= 0 ? '#22c55e' : '#f43f5e'} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            Rotation {best.rotation} is worth {fmtSigned(best.net)} and rotation {worst.rotation} is{' '}
            {fmtSigned(worst.net)} — a {Math.abs(best.net - worst.net)}-point swing between your best and worst spots on
            the wheel.
          </div>
        </Card>

        <Card title="Side-out vs serve pressure" hint="by rotation">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,.08)" />
                <PolarAngleAxis dataKey="rotation" tick={{ fill: '#93a4bd', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Side-out %" dataKey="Side-out %" stroke="#ededed" fill="#ededed" fillOpacity={0.18} />
                <Radar name="Serve pt %" dataKey="Serve pt %" stroke="#a1a1a1" fill="#a1a1a1" fillOpacity={0.14} />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">Rotation {String(label).replace('R', '')}</div>
                        {payload.map((p: any) => (
                          <div className="t-row" key={p.name} style={{ color: p.color }}>
                            {p.name}: {p.value}%
                          </div>
                        ))}
                      </div>
                    ) : null
                  }
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span>
              <i className="dot" style={{ background: '#ededed' }} /> Side-out % (receiving)
            </span>
            <span>
              <i className="dot" style={{ background: '#a1a1a1' }} /> Serve point % (serving)
            </span>
          </div>
        </Card>
      </div>

      <Card title="Rotation ledger">
        <SortableTable rows={rots} columns={columns} rowKey={(r) => String(r.rotation)} initialSort={{ key: 'rotation', dir: 'asc' }} />
      </Card>

      {uniqueLineups.length > 0 && (
        <Card title="Line-ups on court" hint="front row on top" >
          <div className="grid g3" style={{ marginTop: 4 }}>
            {uniqueLineups.map((l) => {
              const stat = rots.find((r) => r.rotation === l.rotation)
              return (
                <div className="lineup" key={`${l.session.id}-${l.rotation}`}>
                  <div className="rot-no">
                    <span>Rotation {l.rotation.toUpperCase()}</span>
                    {stat && (
                      <span style={{ color: stat.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>{fmtSigned(stat.net)}</span>
                    )}
                  </div>
                  <div className="court-row" style={{ gridTemplateColumns: `repeat(${l.front.length || 1}, 1fr)` }}>
                    {l.front.map((p) => (
                      <div className="court-cell" key={p} style={{ borderColor: playerColor(p) + '55' }}>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div className="court-row" style={{ gridTemplateColumns: `repeat(${l.back.length || 1}, 1fr)` }}>
                    {l.back.map((p) => (
                      <div className="court-cell back" key={p}>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div className="faint" style={{ fontSize: 10.5, marginTop: 2 }}>
                    {l.session.label}
                    {l.blockLabel && !/^rotation:?$/i.test(l.blockLabel) ? ` · ${l.blockLabel}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}
