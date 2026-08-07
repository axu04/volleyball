import {
  Bar as RBar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { playerStats, sessionTrends } from '../lib/stats'
import type { Session } from '../lib/types'
import { Card, Empty, SortableTable, fmtPct, fmtSigned, playerColor } from './ui'
import type { Column } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

const RATE_SERIES = [
  { key: 'winPct', label: 'Point win %', color: '#ededed' },
  { key: 'sideoutPct', label: 'Side-out %', color: '#22c55e' },
  { key: 'servePointPct', label: 'Serve point %', color: '#a1a1a1' },
  { key: 'errorRate', label: 'Error rate %', color: '#ef4444' },
]

export function Trends({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) return <Empty>No sessions loaded.</Empty>

  const trends = sessionTrends(sessions)

  const rateData = trends.map((t) => ({
    label: t.label,
    winPct: +t.core.winPct.toFixed(1),
    sideoutPct: +t.core.sideoutPct.toFixed(1),
    servePointPct: +t.core.servePointPct.toFixed(1),
    errorRate: +t.core.errorRate.toFixed(1),
  }))

  const serveData = trends.map((t) => ({
    label: t.label,
    aces: t.core.aces,
    serveErrs: -t.core.serveErrs,
    acedOn: t.core.acedOn,
  }))

  const allPlayers = [...new Set(sessions.flatMap((s) => s.players))].sort()
  const playerData = sessions.map((s) => {
    const stats = playerStats(s.rallies)
    const row: Record<string, string | number> = { label: s.label }
    for (const name of allPlayers) row[name] = stats.find((p) => p.name === name)?.net ?? 0
    return row
  })

  const columns: Column<(typeof trends)[number]>[] = [
    { key: 'label', label: 'Session', align: 'left', value: (t) => t.date, render: (t) => t.label },
    {
      key: 'sets',
      label: 'Sets',
      value: (t) => t.setsWon - t.setsLost,
      render: (t) => (
        <span style={{ color: t.setsWon >= t.setsLost ? 'var(--win)' : 'var(--loss)' }}>
          {t.setsWon}–{t.setsLost}
        </span>
      ),
    },
    { key: 'rallies', label: 'Rallies', value: (t) => t.core.rallies, render: (t) => t.core.rallies },
    {
      key: 'winPct',
      label: 'Win %',
      value: (t) => t.core.winPct,
      render: (t) => fmtPct(t.core.winPct, 1),
    },
    {
      key: 'sideoutPct',
      label: 'Side-out %',
      value: (t) => t.core.sideoutPct,
      render: (t) => fmtPct(t.core.sideoutPct, 1),
    },
    {
      key: 'servePointPct',
      label: 'Serve pt %',
      value: (t) => t.core.servePointPct,
      render: (t) => fmtPct(t.core.servePointPct, 1),
    },
    { key: 'kills', label: 'Kills', value: (t) => t.core.kills, render: (t) => t.core.kills },
    {
      key: 'forced',
      label: 'Opp err',
      value: (t) => t.core.forced,
      title: 'Opponent errors credited to our named last-touch player',
      render: (t) => t.core.forced,
    },
    {
      key: 'errorRate',
      label: 'Error rate',
      value: (t) => t.core.errorRate,
      render: (t) => <span style={{ color: 'var(--loss)' }}>{fmtPct(t.core.errorRate, 1)}</span>,
    },
    { key: 'aces', label: 'Aces', value: (t) => t.core.aces, render: (t) => t.core.aces },
    { key: 'serveErrs', label: 'Serve err', value: (t) => t.core.serveErrs, render: (t) => t.core.serveErrs },
    { key: 'acedOn', label: 'Aced on', value: (t) => t.core.acedOn, render: (t) => t.core.acedOn },
  ]

  return (
    <>
      {sessions.length === 1 && (
        <div className="notice">
          Only one session is loaded, so the trend lines are a single point. Drop more CSVs into the{' '}
          <code>data/</code> folder (or onto the header) and every chart here fills in over time.
        </div>
      )}

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Card title="Core rates over time" hint="higher is better except error rate">
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={rateData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="label" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">{label}</div>
                        {payload.map((p: any) => (
                          <div className="t-row" key={p.name} style={{ color: p.color }}>
                            {p.name}: {p.value}%
                          </div>
                        ))}
                      </div>
                    ) : null
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 6 }} iconType="circle" iconSize={8} />
                {RATE_SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 3.5, strokeWidth: 0, fill: s.color }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Service battle over time" hint="aces up, service errors down">
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={serveData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }} stackOffset="sign">
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis dataKey="label" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,.04)' }}
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">{label}</div>
                        {payload.map((p: any) => (
                          <div className="t-row" key={p.name} style={{ color: p.color }}>
                            {p.name}: {Math.abs(p.value)}
                          </div>
                        ))}
                      </div>
                    ) : null
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 6 }} iconType="circle" iconSize={8} />
                <RBar dataKey="aces" name="Aces" stackId="s" fill="#22c55e" barSize={36} radius={[4, 4, 0, 0]} />
                <RBar
                  dataKey="serveErrs"
                  name="Service errors"
                  stackId="s"
                  fill="#ef4444"
                  barSize={36}
                  radius={[0, 0, 4, 4]}
                />
                <RBar dataKey="acedOn" name="Aced on us" fill="#a1a1a1" barSize={14} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Player net impact over time" hint="earned points − errors, per session">
        <div style={{ height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={playerData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
              <XAxis dataKey="label" {...axis} axisLine={false} />
              <YAxis {...axis} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div className="tip">
                      <div className="t-title">{label}</div>
                      {[...payload]
                        .sort((a: any, b: any) => b.value - a.value)
                        .map((p: any) => (
                          <div className="t-row" key={p.name} style={{ color: p.color }}>
                            {p.name}: {fmtSigned(p.value)}
                          </div>
                        ))}
                    </div>
                  ) : null
                }
              />
              <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 6 }} iconType="circle" iconSize={8} />
              {allPlayers.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={playerColor(name)}
                  strokeWidth={2}
                  dot={{ r: 3.5, strokeWidth: 0, fill: playerColor(name) }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Session log">
        <SortableTable rows={trends} columns={columns} rowKey={(t) => t.sessionId} initialSort={{ key: 'label', dir: 'asc' }} />
      </Card>

      <Card title="Sets won per session">
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={trends} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <XAxis dataKey="label" {...axis} axisLine={false} />
              <YAxis {...axis} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,.04)' }}
                content={({ active, payload }: any) =>
                  active && payload?.length ? (
                    <div className="tip">
                      <div className="t-title">{payload[0].payload.label}</div>
                      <div className="t-row">
                        {payload[0].payload.setsWon}–{payload[0].payload.setsLost} sets
                      </div>
                    </div>
                  ) : null
                }
              />
              <RBar dataKey="setsWon" name="Sets won" barSize={44} radius={[5, 5, 0, 0]}>
                {trends.map((t) => (
                  <Cell key={t.sessionId} fill={t.setsWon >= t.setsLost ? '#22c55e' : '#f43f5e'} />
                ))}
              </RBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}
