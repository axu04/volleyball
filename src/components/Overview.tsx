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
import { causeMeta } from '../lib/causes'
import type { Session } from '../lib/types'
import { coreStats, errorGroups, phaseStats, playerStats, streaks } from '../lib/stats'
import { ralliesWithTouches, teamTouchSummary } from '../lib/touchStats'
import type { Rally } from '../lib/types'
import { Bar, Card, Empty, NetBar, Stat, fmtPct, fmtSigned, playerColor } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

function TinyTip({ active, payload, suffix = '' }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="tip">
      <div className="t-title">{p.label ?? p.name ?? p.group}</div>
      <div className="t-row">
        {payload[0].value}
        {suffix} {p.share !== undefined ? `· ${p.share.toFixed(0)}% of total` : ''}
      </div>
    </div>
  )
}

export function Overview({
  rallies,
  sessions,
  focusPlayers = [],
}: {
  /** Session/set/phase context — not pre-filtered by player involvement. */
  rallies: Rally[]
  sessions: Session[]
  focusPlayers?: string[]
}) {
  if (!rallies.length) return <Empty>No rallies match these filters.</Empty>

  const focus = focusPlayers.length ? focusPlayers : undefined
  const allPlayerStats = playerStats(rallies)
  const focusedPlayers = focus ? allPlayerStats.filter((p) => focus.includes(p.name)) : allPlayerStats

  if (focus && !focusedPlayers.length) {
    return (
      <Empty>
        {focus.join(', ')} {focus.length === 1 ? 'is' : 'are'} not named on any cause tags in this filter. Check
        Touches for contact grades.
      </Empty>
    )
  }

  // Player focus: personal attribution (cause tags), not team rates on "rallies they touched".
  if (focus) {
    const involved = focusedPlayers.reduce((s, p) => s + p.involved, 0)
    const wins = focusedPlayers.reduce((s, p) => s + p.wins, 0)
    const errors = focusedPlayers.reduce((s, p) => s + p.errors, 0)
    const plus = focusedPlayers.reduce((s, p) => s + p.plus, 0)
    const kills = focusedPlayers.reduce((s, p) => s + p.kills, 0)
    const aces = focusedPlayers.reduce((s, p) => s + p.aces, 0)
    const forced = focusedPlayers.reduce((s, p) => s + p.forced, 0)
    const net = focusedPlayers.reduce((s, p) => s + p.net, 0)
    const serveErrs = focusedPlayers.reduce((s, p) => s + p.serveErrs, 0)
    const acedOn = focusedPlayers.reduce((s, p) => s + p.acedOn, 0)
    const errorRate = involved ? (errors / involved) * 100 : 0
    const winPct = involved ? (wins / involved) * 100 : 0
    const who = focus.length === 1 ? focus[0]! : `${focus.length} players`

    const touchTeam = ralliesWithTouches(rallies).length ? teamTouchSummary(rallies, focus) : null
    const keepPct =
      touchTeam && touchTeam.emergencies
        ? (touchTeam.emergenciesKeptAlive / touchTeam.emergencies) * 100
        : 0

    const maxNet = Math.max(1, ...focusedPlayers.map((p) => Math.abs(p.net)))

    return (
      <>
        <div className="notice" style={{ marginBottom: 14 }}>
          Showing <b>{who}</b> on cause-tagged rallies only — error rate is errors ÷ rallies they are named on,
          not every rally they touched.
        </div>
        <div className="stat-grid">
          <Stat
            label="Win% when tagged"
            value={fmtPct(winPct, 1)}
            detail={`${wins}–${involved - wins} · ${involved} tagged`}
            tone={winPct >= 50 ? 'var(--win)' : 'var(--loss)'}
            hint="Share of rallies this player is named on (cause column) that we won."
          />
          <Stat
            label="Error rate when tagged"
            value={fmtPct(errorRate, 1)}
            detail={`${errors} errors on ${involved} tagged rallies`}
            tone="var(--loss)"
            hint="Their charged errors ÷ rallies they are named on. Touch-only digs do not count here."
          />
          <Stat
            label="Net"
            value={fmtSigned(net)}
            detail={`${plus} earned − ${errors} errors`}
            tone={net >= 0 ? 'var(--win)' : 'var(--loss)'}
            hint="Kills + aces + opponent errors credited to their last touch − our errors charged to them."
          />
          <Stat
            label="Points credited"
            value={plus}
            detail={`${kills} kills · ${aces} aces · ${forced} opp errors`}
            tone="var(--win)"
          />
          <Stat label="Serve errors" value={serveErrs} detail="charged to them" tone="var(--loss)" />
          <Stat label="Aced on" value={acedOn} detail="receive errors" tone="#737373" />
          {touchTeam && (
            <>
              <Stat
                label="First ball avg"
                value={touchTeam.firstBall.attempts ? touchTeam.firstBall.avg.toFixed(2) : '—'}
                detail={`${touchTeam.firstBall.attempts} first contacts`}
                tone={
                  touchTeam.firstBall.avg >= 2
                    ? 'var(--win)'
                    : touchTeam.firstBall.avg >= 1
                      ? 'var(--warn)'
                      : 'var(--loss)'
                }
                hint="Their first contacts after opponent possession (Touches column)."
              />
              <Stat
                label="Saves kept alive"
                value={touchTeam.emergencies ? fmtPct(keepPct) : '—'}
                detail={`${touchTeam.emergenciesKeptAlive}/${touchTeam.emergencies} emergency digs`}
                tone="#22c55e"
              />
            </>
          )}
        </div>
        <div className="grid g2" style={{ marginBottom: 14 }}>
          <Card title="Net impact" hint="earned − errors">
            <SimpleNet players={focusedPlayers} maxNet={maxNet} />
          </Card>
          <Card title="Error mix" hint="what they are charged with">
            {focusedPlayers.map((p) => {
              const entries = Object.entries(p.errorsByCause).sort((a, b) => b[1] - a[1])
              if (!entries.length) {
                return (
                  <div key={p.name} className="muted" style={{ marginBottom: 10 }}>
                    {p.name}: no charged errors
                  </div>
                )
              }
              return (
                <div key={p.name} style={{ marginBottom: 14 }}>
                  {focus.length > 1 && <div style={{ fontWeight: 600, marginBottom: 6 }}>{p.name}</div>}
                  {entries.map(([key, count]) => (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span>{causeMeta(key).label}</span>
                        <span className="mono muted">{count}</span>
                      </div>
                      <Bar value={count} max={errors || 1} color={causeMeta(key).color} />
                    </div>
                  ))}
                </div>
              )
            })}
          </Card>
        </div>
      </>
    )
  }

  const c = coreStats(rallies)
  const st = streaks(rallies)
  const groups = errorGroups(rallies)

  // Split no-player bad serves from ordinary opponent errors; neither implies a forced win.
  const wins = [
    { key: 'opp_serve_error', label: 'Opponent serve error', color: '#525252', count: c.badServeErrors },
    { key: 'aced_on_them_suckas', label: 'Ace', color: causeMeta('aced_on_them_suckas').color, count: c.aces },
    { key: 'our_point', label: 'Kill / earned', color: causeMeta('our_point').color, count: c.kills },
    { key: 'opp_err', label: 'Opponent error', color: '#a1a1a1', count: c.forced },
  ]
    .filter((w) => w.count > 0)
    .map((w) => ({ ...w, share: c.won > 0 ? (w.count / c.won) * 100 : 0 }))
  const phases = phaseStats(rallies)
  const players = allPlayerStats
  const maxNet = Math.max(1, ...players.map((p) => Math.abs(p.net)))

  // Our errors grouped by skill, then every losing cause that is not charged to us listed
  // individually so nothing hides inside a catch-all bucket.
  const notOurFault = new Map<string, number>()
  for (const r of rallies) {
    if (r.won || causeMeta(r.cause, r.won).kind === 'error') continue
    notOurFault.set(r.cause, (notOurFault.get(r.cause) ?? 0) + 1)
  }

  const lossSources = [
    ...groups.map((g) => ({ label: g.group, count: g.count, share: g.share, color: g.color })),
    ...[...notOurFault.entries()].map(([key, count]) => ({
      label: causeMeta(key).label,
      count,
      share: c.lost > 0 ? (count / c.lost) * 100 : 0,
      color: causeMeta(key).color,
    })),
  ].sort((a, b) => b.count - a.count)

  const allSets = sessions.flatMap((s) => s.sets.map((set) => ({ ...set, session: s })))
  const decided = allSets.filter((s) => s.decided)
  const setsWon = decided.filter((s) => s.won).length
  const touchTagged = ralliesWithTouches(rallies)
  const touchTeam = touchTagged.length ? teamTouchSummary(rallies) : null
  const keepPct =
    touchTeam && touchTeam.emergencies
      ? (touchTeam.emergenciesKeptAlive / touchTeam.emergencies) * 100
      : 0

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Point win rate"
          value={fmtPct(c.winPct, 1)}
          detail={`${c.won}–${c.lost} rallies · ${fmtSigned(c.diff)}`}
          tone={c.winPct >= 50 ? 'var(--win)' : 'var(--loss)'}
          hint="Share of all logged rallies we won."
        />
        <Stat
          label="Side-out rate"
          value={fmtPct(c.sideoutPct, 1)}
          detail={`${c.sideouts} of ${c.recvRallies} receiving`}
          tone="#ededed"
          hint="How often we win the rally when receiving serve. The single best predictor of winning sets — 60%+ is strong at rec level."
        />
        <Stat
          label="Point-scoring rate on serve"
          value={fmtPct(c.servePointPct, 1)}
          detail={`${c.servePointsWon} of ${c.serveRallies} serving`}
          tone="#a1a1a1"
          hint="How often we win the rally when we serve. This is what extends runs."
        />
        <Stat
          label="Opponent errors credited"
          value={c.forced}
          detail={`plus ${c.badServeErrors} bad serve${c.badServeErrors === 1 ? '' : 's'}`}
          tone="#737373"
          hint="opp_err rallies with our last-touch player named. A no-player opp_err is reserved for an opponent serve into the net."
        />
        <Stat
          label="Error rate"
          value={fmtPct(c.errorRate, 1)}
          detail={`${c.errors} errors · ${fmtPct(c.selfInflictedPct, 0)} of points lost`}
          tone="var(--loss)"
          hint="Team: share of all rallies that ended as our unforced error."
        />
        <Stat
          label="Ace : serve error"
          value={`${c.aces} : ${c.serveErrs}`}
          detail={`${fmtPct(c.aceRate, 1)} ace · ${fmtPct(c.serveErrRate, 1)} miss`}
          tone={c.aces >= c.serveErrs ? 'var(--win)' : 'var(--warn)'}
          hint="Aggression payoff at the service line. You want this at or above 1:1."
        />
        <Stat
          label="Aced against us"
          value={c.acedOn}
          detail={`${fmtPct(c.acedOnRate, 1)} of serves received`}
          tone="#737373"
          hint="Free points handed to the other team's server."
        />
        <Stat
          label="Longest run"
          value={st.longestRun}
          detail={st.longestRunLabel || '—'}
          tone="var(--win)"
          hint="Longest streak of consecutive rallies won inside a single set."
        />
        {touchTeam && (
          <>
            <Stat
              label="First ball avg"
              value={touchTeam.firstBall.attempts ? touchTeam.firstBall.avg.toFixed(2) : '—'}
              detail={`${touchTeam.ralliesTagged} rallies with touches`}
              tone={
                touchTeam.firstBall.avg >= 2
                  ? 'var(--win)'
                  : touchTeam.firstBall.avg >= 1
                    ? 'var(--warn)'
                    : 'var(--loss)'
              }
              hint="Average first contact after opponent possession. See the Touches tab."
            />
            <Stat
              label="Saves kept alive"
              value={touchTeam.emergencies ? fmtPct(keepPct) : '—'}
              detail={`${touchTeam.emergenciesKeptAlive}/${touchTeam.emergencies} emergency digs`}
              tone="#22c55e"
              hint="Receive graded 0–1 that were followed by another touch."
            />
          </>
        )}
      </div>

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Card
          title="Where our points come from"
          hint={`${c.won} points won`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 168, height: 168, flex: 'none' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={wins}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {wins.map((w) => (
                      <Cell key={w.key} fill={w.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<TinyTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {wins.map((w) => (
                <div key={w.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <i className="dot" style={{ background: w.color }} />
                      {w.label}
                    </span>
                    <span className="mono muted">
                      {w.count} · {w.share.toFixed(0)}%
                    </span>
                  </div>
                  <Bar value={w.count} max={Math.max(1, ...wins.map((x) => x.count))} color={w.color} />
                </div>
              ))}
              <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
                {fmtPct(((c.kills + c.aces + c.forced) / Math.max(1, c.won)) * 100, 0)} of our points have one of our
                players named on the rally.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Where points go against us" hint={`${c.lost} points lost`}>
          <div style={{ height: 168 }}>
            <ResponsiveContainer>
              <BarChart data={lossSources} layout="vertical" margin={{ left: 8, right: 18, top: 4, bottom: 0 }}>
                <XAxis type="number" {...axis} axisLine={false} />
                <YAxis type="category" dataKey="label" width={124} {...axis} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} content={<TinyTip />} />
                <RBar dataKey="count" radius={[0, 5, 5, 0]} barSize={17}>
                  {lossSources.map((g) => (
                    <Cell key={g.label} fill={g.color} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            {fmtPct(c.selfInflictedPct, 0)} of the points we lost were self-inflicted — the opponent only had to earn{' '}
            {c.conceded}.
          </div>
        </Card>
      </div>

      <div className="grid g3">
        <Card title="Set results" hint={`${setsWon}–${decided.length - setsWon}`}>
          {allSets.map((s) => {
            const official = s.officialUs !== null
            return (
              <div className="setline" key={`${s.session.id}-${s.set}`}>
                <span className={`pill ${!s.decided ? '' : s.won ? 'w' : 'l'}`}>
                  {!s.decided ? '–' : s.won ? 'W' : 'L'}
                </span>
                <span className="sc">
                  {official ? `${s.officialUs}–${s.officialThem}` : `${s.trackedUs}–${s.trackedThem}`}
                </span>
                <span className="muted">
                  {s.session.label} · Set {s.set}
                </span>
                <span className="spacer" />
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {s.rallies.length} logged
                  {official && s.trackedUs + s.trackedThem !== s.officialUs! + s.officialThem!
                    ? ` (${s.officialUs! + s.officialThem! - s.trackedUs - s.trackedThem} missing)`
                    : ''}
                </span>
              </div>
            )
          })}
        </Card>

        <Card title="Performance by game phase" hint="within each set">
          <div style={{ height: 150 }}>
            <ResponsiveContainer>
              <BarChart data={phases} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
                <XAxis dataKey="phase" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,.04)' }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">{payload[0].payload.phase}</div>
                        <div className="t-row">Win rate {payload[0].payload.winPct.toFixed(0)}%</div>
                        <div className="t-row">Error rate {payload[0].payload.errorRate.toFixed(0)}%</div>
                        <div className="t-row">{payload[0].payload.rallies} rallies</div>
                      </div>
                    ) : null
                  }
                />
                <RBar dataKey="winPct" radius={[5, 5, 0, 0]} barSize={40}>
                  {phases.map((p) => (
                    <Cell key={p.phase} fill={p.winPct >= 50 ? '#22c55e' : '#f43f5e'} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            Early = before 9, Middle = 9–17, Crunch = 18+ (by the leading score).
          </div>
        </Card>

        <Card title="Momentum" hint="runs inside sets">
          <div className="stat-grid" style={{ margin: 0, gridTemplateColumns: '1fr 1fr' }}>
            <Stat label="Longest run" value={st.longestRun} detail={st.longestRunLabel} tone="var(--win)" />
            <Stat label="Longest skid" value={st.longestSkid} detail={st.longestSkidLabel} tone="var(--loss)" />
            <Stat label="Runs of 3+" value={st.runs3Plus} detail="scored in a row" tone="var(--win)" />
            <Stat label="Skids of 3+" value={st.skids3Plus} detail="conceded in a row" tone="var(--loss)" />
          </div>
        </Card>

        <Card title="Net impact leaders" hint="earned points − errors">
          <SimpleNet players={players} maxNet={maxNet} />
        </Card>
      </div>

      <MatchSummaries sessions={sessions} />
    </>
  )
}

function MatchSummaries({ sessions }: { sessions: Session[] }) {
  const withSummary = sessions.filter((s) => s.summary?.text?.trim())
  if (!withSummary.length) return null

  return (
    <div className="match-summaries" style={{ marginTop: 14 }}>
      {withSummary.map((s) => {
        const summary = s.summary!
        return (
          <Card
            key={s.id}
            title={withSummary.length > 1 ? `Match summary · ${s.label}` : 'Match summary'}
            hint={`${new Date(summary.generatedAt).toLocaleString()} · ${summary.model}`}
          >
            <pre className="match-summary-text">{summary.text}</pre>
          </Card>
        )
      })}
    </div>
  )
}

function SimpleNet({ players, maxNet }: { players: ReturnType<typeof playerStats>; maxNet: number }) {
  return (
    <div>
      {players.map((p) => (
        <div key={p.name} style={{ marginBottom: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="dot" style={{ background: playerColor(p.name) }} />
              {p.name}
            </span>
            <span className="mono muted">
              <span style={{ color: 'var(--win)' }}>{p.plus}</span> / <span style={{ color: 'var(--loss)' }}>{p.errors}</span>{' '}
              <b style={{ color: p.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>{fmtSigned(p.net)}</b>
            </span>
          </div>
          <NetBar value={p.net} max={maxNet} />
        </div>
      ))}
    </div>
  )
}
