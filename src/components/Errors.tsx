import {
  Bar as RBar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { causeMeta, isOurError } from '../lib/causes'
import { causeBreakdown, coreStats, errorGroups } from '../lib/stats'
import type { Rally } from '../lib/types'
import { Bar, Card, Empty, Stat, fmtPct } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

export function Errors({ rallies }: { rallies: Rally[] }) {
  const errs = rallies.filter((r) => isOurError(r.cause, r.won))
  if (!rallies.length) return <Empty>No rallies match these filters.</Empty>

  const c = coreStats(rallies)
  const groups = errorGroups(rallies)
  const causes = causeBreakdown(errs)
  const maxCause = Math.max(1, ...causes.map((x) => x.count))

  const serving = errs.filter((r) => r.serving).length
  const receiving = errs.length - serving

  const bySet = [...new Set(rallies.map((r) => `${r.sessionLabel} S${r.set}`))].map((key) => {
    const setRallies = rallies.filter((r) => `${r.sessionLabel} S${r.set}` === key)
    const setErrs = setRallies.filter((r) => isOurError(r.cause, r.won))
    const row: Record<string, string | number> = { key, total: setErrs.length }
    for (const g of groups) {
      row[g.group] = setErrs.filter((r) => causeMeta(r.cause, r.won).group === g.group).length
    }
    return row
  })

  const topCause = causes[0]

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Errors charged to us"
          value={c.errors}
          detail={`${fmtPct(c.errorRate, 1)} of all rallies`}
          tone="var(--loss)"
          hint="Every rally we lost except the ones the opponent genuinely earned."
        />
        <Stat
          label="Self-inflicted losses"
          value={fmtPct(c.selfInflictedPct, 0)}
          detail={`${c.errors} of ${c.lost} points lost`}
          tone="var(--loss)"
          hint="The rest were points the opponent actually earned."
        />
        <Stat
          label="Biggest leak"
          value={topCause?.short ?? '—'}
          detail={topCause ? `${topCause.count} points · ${fmtPct(topCause.share, 0)} of errors` : ''}
          tone={topCause?.color ?? 'var(--warn)'}
        />
        <Stat
          label="Errors while serving"
          value={serving}
          detail={`vs ${receiving} while receiving`}
          tone="#f97316"
          hint="Errors in the serving phase kill your own runs."
        />
        <Stat
          label="Errors per set"
          value={(c.errors / Math.max(1, new Set(rallies.map((r) => `${r.sessionId}|${r.set}`)).size)).toFixed(1)}
          detail="average"
          tone="var(--warn)"
        />
        <Stat
          label="Mistake battle"
          value={`${c.unforced} : ${c.oppErrPoints}`}
          detail={`${c.oppErrPoints - c.unforced >= 0 ? '+' : ''}${c.oppErrPoints - c.unforced} in our favour`}
          tone={c.oppErrPoints - c.unforced >= 0 ? 'var(--win)' : 'var(--loss)'}
          hint="Our unforced errors (attack, serve, ball handling) versus theirs. Being aced and coverage breakdowns are excluded so the two sides compare like-for-like."
        />
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Card title="Error breakdown" hint={`${errs.length} errors`}>
          {causes.map((x) => (
            <div key={x.key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="dot" style={{ background: x.color }} />
                  {x.label}
                  <span className="faint" style={{ fontSize: 11 }}>
                    {x.group}
                  </span>
                </span>
                <span className="mono muted">
                  {x.count} · {x.share.toFixed(0)}%
                </span>
              </div>
              <Bar value={x.count} max={maxCause} color={x.color} />
            </div>
          ))}
        </Card>

        <Card title="Which skill is costing us" hint="grouped by phase of play">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 190, height: 190, flex: 'none' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={groups}
                    dataKey="count"
                    nameKey="group"
                    innerRadius={54}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {groups.map((g) => (
                      <Cell key={g.group} fill={g.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <div className="tip">
                          <div className="t-title">{payload[0].payload.group}</div>
                          <div className="t-row">
                            {payload[0].payload.count} errors · {payload[0].payload.share.toFixed(0)}%
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {groups.map((g) => (
                <div
                  key={g.group}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="dot" style={{ background: g.color }} />
                    {g.group}
                  </span>
                  <span className="mono muted">
                    {g.count} · {g.share.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card title="Errors set by set" hint="stacked by skill">
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={bySet} margin={{ left: -20, right: 12, top: 6, bottom: 0 }}>
              <XAxis dataKey="key" {...axis} axisLine={false} />
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
              {groups.map((g, i) => (
                <RBar
                  key={g.group}
                  dataKey={g.group}
                  stackId="e"
                  fill={g.color}
                  barSize={44}
                  radius={i === groups.length - 1 ? [4, 4, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  )
}
