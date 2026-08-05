import { Bar as RBar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { coreStats, serveStats } from '../lib/stats'
import type { Rally, Session } from '../lib/types'
import { Card, Empty, SortableTable, Stat, fmtPct, playerColor } from './ui'
import type { Column } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

export function Serving({ rallies, sessions }: { rallies: Rally[]; sessions: Session[] }) {
  const c = coreStats(rallies)
  const servers = serveStats(rallies)
  const blocked = sessions.filter((s) => !s.serverInference.ok)

  const columns: Column<(typeof servers)[number]>[] = [
    {
      key: 'name',
      label: 'Server',
      align: 'left',
      value: (s) => s.name,
      render: (s) => (
        <span className="name-cell">
          <i className="dot" style={{ background: playerColor(s.name) }} />
          {s.name}
        </span>
      ),
    },
    {
      key: 'attempts',
      label: 'Serves',
      value: (s) => s.attempts,
      title: 'Every rally this player served, not just the ones that ended on the serve',
      render: (s) => s.attempts,
    },
    { key: 'aces', label: 'Aces', value: (s) => s.aces, render: (s) => <span style={{ color: 'var(--win)' }}>{s.aces}</span> },
    {
      key: 'acePct',
      label: 'Ace %',
      value: (s) => s.acePct,
      render: (s) => fmtPct(s.acePct, 1),
    },
    {
      key: 'errors',
      label: 'Missed',
      value: (s) => s.errors,
      render: (s) => <span style={{ color: 'var(--loss)' }}>{s.errors}</span>,
    },
    {
      key: 'errorPct',
      label: 'Miss %',
      value: (s) => s.errorPct,
      render: (s) => (
        <span style={{ color: s.errorPct > 15 ? 'var(--loss)' : undefined }}>{fmtPct(s.errorPct, 1)}</span>
      ),
    },
    {
      key: 'pointsWon',
      label: 'Pts won',
      value: (s) => s.pointsWon,
      title: 'Rallies won while this player was at the line, however the rally ended',
      render: (s) => s.pointsWon,
    },
    {
      key: 'pointPct',
      label: 'Point %',
      value: (s) => s.pointPct,
      title: 'Share of their serves that ended in a point for us',
      render: (s) => (
        <span style={{ color: s.pointPct >= 50 ? 'var(--win)' : 'var(--loss)' }}>{fmtPct(s.pointPct, 1)}</span>
      ),
    },
    { key: 'turns', label: 'Turns', value: (s) => s.turns, title: 'Times they stepped to the line', render: (s) => s.turns },
    {
      key: 'pointsPerTurn',
      label: 'Pts / turn',
      value: (s) => s.pointsPerTurn,
      title: 'Average points scored per service turn — the run generator',
      render: (s) => s.pointsPerTurn.toFixed(2),
    },
    { key: 'longestTurn', label: 'Best run', value: (s) => s.longestTurn, render: (s) => s.longestTurn },
  ]

  const chart = [...servers].sort((a, b) => b.attempts - a.attempts).map((s) => ({ ...s, missed: -s.errors }))

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Serves"
          value={c.serveRallies}
          detail={`${fmtPct(c.servePointPct, 1)} became points`}
          tone="#a1a1a1"
        />
        <Stat
          label="Aces"
          value={c.aces}
          detail={fmtPct(c.aceRate, 1) + ' of serves'}
          tone="var(--win)"
        />
        <Stat
          label="Service errors"
          value={c.serveErrs}
          detail={fmtPct(c.serveErrRate, 1) + ' of serves'}
          tone="var(--loss)"
        />
        <Stat
          label="Aced against us"
          value={c.acedOn}
          detail={`${fmtPct(c.acedOnRate, 1)} of serves received`}
          tone="#737373"
        />
      </div>

      {blocked.length > 0 && (
        <div className="notice">
          <b>
            {blocked.length === 1 ? 'One session is' : `${blocked.length} sessions are`} left out of the per-server
            numbers below
          </b>
          <ul>
            {blocked.map((s) => (
              <li key={s.id}>
                {s.label} — {s.serverInference.note}
              </li>
            ))}
          </ul>
          Team totals in the cards above still cover every session; only the ledger is restricted.
        </div>
      )}

      {servers.length === 0 ? (
        <Empty>No serves can be attributed for this selection.</Empty>
      ) : (
        <>
          <Card
            title="Serving ledger"
            hint={`${servers.reduce((a, b) => a + b.attempts, 0)} of ${c.serveRallies} serves attributed`}
          >
            <SortableTable
              rows={servers}
              columns={columns}
              rowKey={(s) => s.name}
              initialSort={{ key: 'attempts', dir: 'desc' }}
            />
            <div className="faint" style={{ fontSize: 11.5, marginTop: 10 }}>
              The sheet only names a player on serves that ended immediately, so the server here is worked out from the
              Rotation column and the line-up block: position 1 is right back (third back-row name). That
              mapping reproduces every hand-tagged ace and service error in the file, which is why the rest of the
              serves can be attributed too. If a future sheet disagrees on even one, this tab switches itself off rather
              than guess.
            </div>
          </Card>

          <Card title="Aces against service errors" hint="by server, sized by volume">
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ left: -20, right: 12, top: 10, bottom: 0 }} stackOffset="sign">
                  <XAxis dataKey="name" {...axis} axisLine={false} />
                  <YAxis {...axis} axisLine={false} allowDecimals={false} />
                  <ReferenceLine y={0} stroke="#333333" />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,.04)' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0].payload
                      return (
                        <div className="tip">
                          <div className="t-title">{p.name}</div>
                          <div className="t-row">
                            {p.attempts} serves · {p.aces} aces · {p.errors} missed
                          </div>
                          <div className="t-row">
                            {p.pointsWon} points won ({p.pointPct.toFixed(0)}%)
                          </div>
                          <div className="t-row">
                            {p.turns} turns · {p.pointsPerTurn.toFixed(2)} points per turn · best run {p.longestTurn}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <RBar dataKey="aces" name="Aces" stackId="s" barSize={44} radius={[5, 5, 0, 0]}>
                    {chart.map((s) => (
                      <Cell key={s.name} fill="#22c55e" />
                    ))}
                  </RBar>
                  <RBar dataKey="missed" name="Service errors" stackId="s" barSize={44} radius={[0, 0, 5, 5]}>
                    {chart.map((s) => (
                      <Cell key={s.name} fill="#ef4444" />
                    ))}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend">
              <span>
                <i className="dot" style={{ background: '#22c55e' }} /> Aces
              </span>
              <span>
                <i className="dot" style={{ background: '#ef4444' }} /> Service errors
              </span>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
