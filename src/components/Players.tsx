import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { GROUPS, causeMeta } from '../lib/causes'
import { playerStats } from '../lib/stats'
import type { Rally } from '../lib/types'
import { Card, Empty, NetBar, SortableTable, fmtPct, fmtSigned, playerColor } from './ui'
import type { Column } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

const ERROR_GROUPS = [
  { key: 'attackErrs' as const, label: GROUPS.attack, color: '#f59e0b' },
  { key: 'handlingErrs' as const, label: GROUPS.handling, color: '#ef4444' },
  { key: 'serveErrs' as const, label: GROUPS.serve, color: '#f97316' },
  { key: 'acedOn' as const, label: GROUPS.receive, color: '#737373' },
  { key: 'coverageErrs' as const, label: GROUPS.defense, color: '#a1a1a1' },
]

export function Players({
  rallies,
  focusPlayers = [],
}: {
  rallies: Rally[]
  focusPlayers?: string[]
}) {
  const players = playerStats(rallies).filter((p) =>
    focusPlayers.length ? focusPlayers.includes(p.name) : true,
  )
  if (!players.length) return <Empty>No players tagged in these rallies.</Empty>

  const maxNet = Math.max(1, ...players.map((p) => Math.abs(p.net)))

  const columns: Column<(typeof players)[number]>[] = [
    {
      key: 'name',
      label: 'Player',
      align: 'left',
      value: (p) => p.name,
      render: (p) => (
        <span className="name-cell">
          <i className="dot" style={{ background: playerColor(p.name) }} />
          {p.name}
        </span>
      ),
    },
    {
      key: 'net',
      label: 'Net',
      value: (p) => p.net,
      title: 'Earned points minus unforced errors',
      render: (p) => (
        <b style={{ color: p.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>{fmtSigned(p.net)}</b>
      ),
    },
    {
      key: 'netbar',
      label: '',
      render: (p) => (
        <div className="bar-cell">
          <NetBar value={p.net} max={maxNet} />
        </div>
      ),
    },
    {
      key: 'plus',
      label: 'Points',
      value: (p) => p.plus,
      title: 'Kills + aces + opponent errors credited to this player as our last touch',
      render: (p) => <span style={{ color: 'var(--win)' }}>{p.plus}</span>,
    },
    { key: 'kills', label: 'Kills', value: (p) => p.kills, render: (p) => p.kills },
    { key: 'aces', label: 'Aces', value: (p) => p.aces, render: (p) => p.aces },
    {
      key: 'forced',
      label: 'Opp err',
      value: (p) => p.forced,
      title: 'opp_err rallies credited to this player as our last touch',
      render: (p) => p.forced,
    },
    {
      key: 'errors',
      label: 'Errors',
      value: (p) => p.errors,
      render: (p) => <span style={{ color: 'var(--loss)' }}>{p.errors}</span>,
    },
    {
      key: 'beaten',
      label: 'Beaten',
      value: (p) => p.beaten,
      title: 'opp_point rallies with this player named. The opponent earned it, so it is not counted as an error.',
      render: (p) => <span className="faint">{p.beaten}</span>,
    },
    {
      key: 'errorRate',
      label: 'Err rate',
      value: (p) => p.errorRate,
      title: 'Their charged errors ÷ rallies they are named on (cause column) — not all rallies they touched',
      render: (p) => <span className="muted">{fmtPct(p.errorRate)}</span>,
    },
    {
      key: 'errorShare',
      label: 'Err share',
      value: (p) => p.errorShare,
      title: "Share of the team's total errors",
      render: (p) => <span className="muted">{fmtPct(p.errorShare)}</span>,
    },
    {
      key: 'pointShare',
      label: 'Pt share',
      value: (p) => p.pointShare,
      title: "Share of the team's earned points",
      render: (p) => <span className="muted">{fmtPct(p.pointShare)}</span>,
    },
    {
      key: 'involved',
      label: 'Rallies',
      value: (p) => p.involved,
      title: 'Rallies where this player was tagged',
      render: (p) => p.involved,
    },
    {
      key: 'winPct',
      label: 'Win% tagged',
      value: (p) => p.winPct,
      title: 'How often rallies this player was tagged in ended in our favour',
      render: (p) => fmtPct(p.winPct),
    },
  ]

  const scatterData = players.map((p) => ({
    name: p.name,
    errors: p.errors,
    plus: p.plus,
    involved: p.involved,
    net: p.net,
  }))

  const errorMix = players
    .filter((p) => p.errors > 0)
    .map((p) => ({
      name: p.name,
      attackErrs: p.attackErrs,
      handlingErrs: p.handlingErrs,
      serveErrs: p.serveErrs,
      acedOn: p.acedOn,
      coverageErrs: p.coverageErrs,
    }))
    .sort(
      (a, b) =>
        ERROR_GROUPS.reduce((s, g) => s + b[g.key], 0) - ERROR_GROUPS.reduce((s, g) => s + a[g.key], 0),
    )

  return (
    <>
      <Card title="Player ledger" hint="click any column to sort">
        <SortableTable rows={players} columns={columns} rowKey={(p) => p.name} initialSort={{ key: 'net', dir: 'desc' }} />
        <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
          Credit follows the Player column exactly. On a rally we won that is who made the play — including{' '}
          <code>opp_err</code> rallies, where the named player is our last touch. Leave Player blank only when the
          opponent served into the net. On a rally we lost, Player is who made the mistake, except{' '}
          <code>opp_point</code>, which the opponent earned and which therefore counts against nobody. Net is points
          minus errors. Rallies naming two players credit both, so the column totals run slightly ahead of team totals.
        </div>
      </Card>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Card title="Impact map" hint="points credited vs errors">
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ left: -14, right: 16, top: 10, bottom: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,.05)" />
                <XAxis
                  type="number"
                  dataKey="errors"
                  name="Errors"
                  {...axis}
                  axisLine={false}
                  label={{ value: 'Errors →', position: 'insideBottomRight', offset: -4, fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="plus"
                  name="Earned"
                  {...axis}
                  axisLine={false}
                  label={{ value: 'Earned', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="involved" range={[80, 460]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3', stroke: '#333333' }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">{payload[0].payload.name}</div>
                        <div className="t-row">
                          {payload[0].payload.plus} earned · {payload[0].payload.errors} errors ·{' '}
                          {fmtSigned(payload[0].payload.net)} net
                        </div>
                        <div className="t-row">{payload[0].payload.involved} rallies tagged</div>
                      </div>
                    ) : null
                  }
                />
                <Scatter data={scatterData}>
                  {scatterData.map((d) => (
                    <Cell key={d.name} fill={playerColor(d.name)} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            Bubble size is how many rallies the player was tagged in. Up and to the left is where you want to be — high
            output, low error volume.
          </div>
        </Card>

        <Card title="Error mix by player" hint="what each person is losing points on">
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={errorMix} margin={{ left: -20, right: 12, top: 6, bottom: 0 }}>
                <XAxis dataKey="name" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,.04)' }}
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">{label}</div>
                        {payload
                          .filter((p: any) => p.value > 0)
                          .map((p: any) => (
                            <div className="t-row" key={p.name} style={{ color: p.color }}>
                              {p.name}: {p.value}
                            </div>
                          ))}
                      </div>
                    ) : null
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 6 }} iconType="circle" iconSize={8} />
                {ERROR_GROUPS.map((g, i) => (
                  <RBar
                    key={g.key}
                    dataKey={g.key}
                    name={g.label}
                    stackId="e"
                    fill={g.color}
                    radius={i === ERROR_GROUPS.length - 1 ? [4, 4, 0, 0] : undefined}
                    barSize={34}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid g3" style={{ marginTop: 14 }}>
        {players.map((p) => {
          const causes = Object.entries(p.errorsByCause).sort((a, b) => b[1] - a[1])
          return (
            <Card key={p.name} title={p.name} hint={`${fmtSigned(p.net)} net`}>
              <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                <div>
                  <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Kills
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 650 }}>{p.kills}</div>
                </div>
                <div>
                  <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Aces
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 650 }}>{p.aces}</div>
                </div>
                <div>
                  <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Opp err
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 650 }}>{p.forced}</div>
                </div>
                <div>
                  <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Errors
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 650, color: 'var(--loss)' }}>{p.errors}</div>
                </div>
              </div>
              {causes.length ? (
                causes.map(([key, count]) => {
                  const meta = causeMeta(key)
                  return (
                    <div
                      key={key}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <i className="dot" style={{ background: meta.color }} />
                        <span className="muted">{meta.label}</span>
                      </span>
                      <span className="mono">{count}</span>
                    </div>
                  )
                })
              ) : (
                <div className="faint" style={{ fontSize: 12.5 }}>
                  No errors tagged. Clean sheet.
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
