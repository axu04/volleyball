import {
  Bar as RBar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  afterEmergency,
  breakAttribution,
  firstBallOutcome,
  playerTouchStats,
  ralliesWithTouches,
  rallyInvolvesAnyPlayer,
  teamTouchSummary,
} from '../lib/touchStats'
import type { Rally } from '../lib/types'
import { Card, Empty, SortableTable, Stat, fmtPct, playerColor } from './ui'
import type { Column } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }
const GRADE_COLORS = ['#ef4444', '#f59e0b', '#a1a1a1', '#22c55e']

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <div className="t-title">{label ?? payload[0].payload?.label}</div>
      {payload.map((p: any) => (
        <div className="t-row" key={p.dataKey}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed?.(1) ?? p.value : p.value}
        </div>
      ))}
    </div>
  )
}

export function Touches({
  rallies,
  focusPlayers = [],
}: {
  rallies: Rally[]
  /** When set, touch rates only count these players' contacts (full sequences still used for prev/next). */
  focusPlayers?: string[]
}) {
  const focus = focusPlayers.length ? focusPlayers : undefined
  const tagged = ralliesWithTouches(rallies).filter((r) =>
    focus ? rallyInvolvesAnyPlayer(r, focus) : true,
  )
  if (!tagged.length) {
    return (
      <Empty>
        No touch sequences in these rallies yet. Tag contacts in the rally tagger (<code>o</code>, then{' '}
        <code>r2</code> / <code>s3</code> / …) and drop the CSV into <code>data/</code>.
      </Empty>
    )
  }

  const team = teamTouchSummary(rallies, focus)
  const players = playerTouchStats(rallies, focus)
  const firstOut = firstBallOutcome(rallies, focus)
  const afterEm = afterEmergency(rallies, focus)
  const breaks = breakAttribution(rallies, focus)

  const gradeStack = team.bySkill
    .filter((s) => s.attempts > 0)
    .map((s) => ({
      skill: s.label,
      q0: s.hist[0],
      q1: s.hist[1],
      q2: s.hist[2],
      q3: s.hist[3],
      attempts: s.attempts,
      avg: +s.avg.toFixed(2),
    }))

  const saveLeaders = [...players]
    .filter((p) => p.emergencies > 0)
    .sort((a, b) => b.emergenciesKeptAlive - a.emergenciesKeptAlive || b.keepAlivePct - a.keepAlivePct)
    .slice(0, 8)

  const cleanupLeaders = [...players]
    .filter((p) => p.cleanups > 0)
    .sort((a, b) => b.cleanups - a.cleanups)
    .slice(0, 8)

  const keepPct = team.emergencies ? (team.emergenciesKeptAlive / team.emergencies) * 100 : 0
  const inSysPct = team.inSystemAttempts ? (team.inSystemKills / team.inSystemAttempts) * 100 : 0

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
    { key: 'touches', label: 'Touches', value: (p) => p.touches, render: (p) => p.touches },
    {
      key: 'avg',
      label: 'Avg',
      value: (p) => p.avg,
      render: (p) => p.avg.toFixed(2),
      title: 'Average grade across all skills',
    },
    {
      key: 'firstBallAvg',
      label: '1st ball',
      value: (p) => p.firstBallAvg,
      render: (p) => (p.firstBalls ? p.firstBallAvg.toFixed(2) : '—'),
      title: 'Average first contact after opponent possession (o)',
    },
    {
      key: 'emergencies',
      label: 'Saves',
      value: (p) => p.emergencies,
      render: (p) => p.emergencies,
      title: 'Emergency digs: receive graded 0–1',
    },
    {
      key: 'keepAlivePct',
      label: 'Kept %',
      value: (p) => p.keepAlivePct,
      render: (p) => (p.emergencies ? fmtPct(p.keepAlivePct) : '—'),
      title: 'Share of their emergency digs that were followed by another touch',
    },
    {
      key: 'winsAfterSave',
      label: 'Win after',
      value: (p) => p.winsAfterSave,
      render: (p) => p.winsAfterSave,
      title: 'Rallies we won after their continuing emergency dig',
    },
    {
      key: 'cleanups',
      label: 'Cleanups',
      value: (p) => p.cleanups,
      render: (p) => p.cleanups,
      title: 'Touches immediately after a teammate 0/1',
    },
    {
      key: 'cleanupAvg',
      label: 'Cleanup avg',
      value: (p) => p.cleanupAvg,
      render: (p) => (p.cleanups ? p.cleanupAvg.toFixed(2) : '—'),
    },
    {
      key: 'bailedOutPct',
      label: 'Bailed %',
      value: (p) => p.bailedOutPct,
      render: (p) => (p.firstBallPoor ? fmtPct(p.bailedOutPct) : '—'),
      title: 'Poor first balls that a teammate converted to 2+',
    },
    ...(['v', 'r', 's', 'a', 'b'] as const).map((skill) => ({
      key: `avg-${skill}`,
      label: skill.toUpperCase(),
      value: (p: (typeof players)[number]) => p.bySkill.find((s) => s.skill === skill)?.avg ?? 0,
      render: (p: (typeof players)[number]) => {
        const s = p.bySkill.find((x) => x.skill === skill)
        return s && s.attempts ? s.avg.toFixed(1) : '—'
      },
      title: `Average ${skill} grade`,
    })),
  ]

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Rallies with touches"
          value={team.ralliesTagged}
          detail={`of ${team.ralliesTotal} filtered · ${team.ourTouches} contacts`}
          tone="#ededed"
          hint="Only rallies that include at least one graded contact."
        />
        <Stat
          label="First ball avg"
          value={team.firstBall.attempts ? team.firstBall.avg.toFixed(2) : '—'}
          detail={`${team.firstBall.attempts} after o · ${fmtPct(team.firstBall.threePct)} threes`}
          tone={team.firstBall.avg >= 2 ? 'var(--win)' : team.firstBall.avg >= 1 ? 'var(--warn)' : 'var(--loss)'}
          hint="Average quality of our first contact after opponent possession."
        />
        <Stat
          label="Saves kept alive"
          value={team.emergencies ? fmtPct(keepPct) : '—'}
          detail={`${team.emergenciesKeptAlive} of ${team.emergencies} emergency digs · ${team.emergenciesWon} won`}
          tone="#22c55e"
          hint="Receive graded 0–1 that were followed by another touch."
        />
        <Stat
          label="Saves wasted"
          value={team.emergenciesWasted}
          detail="next touch was 0 and we lost"
          tone="var(--loss)"
          hint="Emergency dig continued, but the next contact was a zero and the rally was lost."
        />
        <Stat
          label="Win % after good 1st"
          value={team.goodFirstN ? fmtPct(team.winPctAfterGoodFirst) : '—'}
          detail={`first ball ≥2 · n=${team.goodFirstN}`}
          tone="var(--win)"
          hint="Point win rate when our first contact after o is graded 2 or 3."
        />
        <Stat
          label="Win % after poor 1st"
          value={team.poorFirstN ? fmtPct(team.winPctAfterPoorFirst) : '—'}
          detail={`first ball ≤1 · n=${team.poorFirstN}`}
          tone="var(--loss)"
          hint="Point win rate when our first contact after o is graded 0 or 1."
        />
        <Stat
          label="In-system chains"
          value={team.inSystemAttempts}
          detail={
            team.inSystemAttempts
              ? `${team.inSystemKills} won (${fmtPct(inSysPct)}) · r2+ → s2+ → a`
              : 'r≥2 then s≥2 then attack'
          }
          tone="#a1a1a1"
        />
        <Stat
          label="Grade gap"
          value={
            team.goodFirstN && team.poorFirstN
              ? `${(team.winPctAfterGoodFirst - team.winPctAfterPoorFirst).toFixed(0)} pts`
              : '—'
          }
          detail="win% good 1st − poor 1st"
          tone="#f59e0b"
          hint="How much first-ball quality swings whether we win the rally."
        />
      </div>

      <div className="grid g2">
        <Card title="Grade mix by skill" hint="stacked counts · 0→3">
          {gradeStack.length === 0 ? (
            <Empty>No graded contacts.</Empty>
          ) : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={gradeStack} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="skill" {...axis} axisLine={false} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <RBar dataKey="q0" name="0" stackId="g" fill={GRADE_COLORS[0]} />
                  <RBar dataKey="q1" name="1" stackId="g" fill={GRADE_COLORS[1]} />
                  <RBar dataKey="q2" name="2" stackId="g" fill={GRADE_COLORS[2]} />
                  <RBar dataKey="q3" name="3" stackId="g" fill={GRADE_COLORS[3]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="legend" style={{ marginTop: 8 }}>
            {GRADE_COLORS.map((c, i) => (
              <span key={i}>
                <i className="dot" style={{ background: c }} /> {i}
              </span>
            ))}
          </div>
        </Card>

        <Card
          title="First ball → win rate"
          hint="causal: possession-starting contact quality vs whether we took the point"
        >
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={firstOut} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="quality" tickFormatter={(v) => `Grade ${v}`} {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload
                    return (
                      <div className="tip">
                        <div className="t-title">First ball {p.quality}</div>
                        <div className="t-row">
                          {fmtPct(p.winPct)} win · {p.wins}/{p.n} rallies
                        </div>
                      </div>
                    )
                  }}
                />
                <RBar dataKey="winPct" name="Win %" radius={[4, 4, 0, 0]}>
                  {firstOut.map((d) => (
                    <Cell key={d.quality} fill={GRADE_COLORS[d.quality]} fillOpacity={d.n ? 1 : 0.25} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Card title="After an emergency dig" hint="what happens next when someone posts r0/r1">
          {afterEm.length === 0 ? (
            <Empty>No emergency digs tagged.</Empty>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={afterEm}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {afterEm.map((d) => (
                      <Cell key={d.label} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      const total = afterEm.reduce((s, x) => s + x.count, 0)
                      return (
                        <div className="tip">
                          <div className="t-title">{p.label}</div>
                          <div className="t-row">
                            {p.count} · {fmtPct(total ? (p.count / total) * 100 : 0)}
                          </div>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="legend">
            {afterEm.map((d) => (
              <span key={d.label}>
                <i className="dot" style={{ background: d.color }} /> {d.label} ({d.count})
              </span>
            ))}
          </div>
        </Card>

        <Card title="Who breaks the play" hint="on losses: first our-touch graded 0">
          {breaks.length === 0 ? (
            <Empty>No zero-grade contacts on losses yet.</Empty>
          ) : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <BarChart
                  data={breaks.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 8, right: 12, top: 8, bottom: 0 }}
                >
                  <XAxis type="number" {...axis} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="firstZeroPlayer" width={72} {...axis} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      return (
                        <div className="tip">
                          <div className="t-title">{p.firstZeroPlayer}</div>
                          <div className="t-row">{p.n} first-zero losses</div>
                          <div className="t-row">
                            {p.alsoCause} also named on sheet cause ({fmtPct(p.n ? (p.alsoCause / p.n) * 100 : 0)})
                          </div>
                        </div>
                      )
                    }}
                  />
                  <RBar dataKey="n" name="First zero" radius={[0, 4, 4, 0]}>
                    {breaks.slice(0, 8).map((d) => (
                      <Cell key={d.firstZeroPlayer} fill={playerColor(d.firstZeroPlayer)} fillOpacity={0.85} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid g2" style={{ marginTop: 14 }}>
        <Card title="Save leaders" hint="emergency digs kept alive">
          {saveLeaders.length === 0 ? (
            <Empty>No emergency digs yet.</Empty>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={saveLeaders} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="name" {...axis} axisLine={false} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<Tip />} />
                  <RBar dataKey="emergenciesKeptAlive" name="Kept alive" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <RBar dataKey="emergencies" name="All emergencies" fill="#333" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Cleanup artists" hint="touches right after a teammate 0/1">
          {cleanupLeaders.length === 0 ? (
            <Empty>No cleanup touches yet.</Empty>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={cleanupLeaders} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                  <XAxis dataKey="name" {...axis} axisLine={false} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      return (
                        <div className="tip">
                          <div className="t-title">{p.name}</div>
                          <div className="t-row">
                            {p.cleanups} cleanups · avg {p.cleanupAvg.toFixed(2)}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <RBar dataKey="cleanups" name="Cleanups" radius={[4, 4, 0, 0]}>
                    {cleanupLeaders.map((d) => (
                      <Cell key={d.name} fill={playerColor(d.name)} fillOpacity={0.85} />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Player touch ledger" hint="savers ≠ clean passers — check Kept % vs 1st ball" >
        <SortableTable rows={players} columns={columns} rowKey={(p) => p.name} initialSort={{ key: 'touches', dir: 'desc' }} />
      </Card>
    </>
  )
}
