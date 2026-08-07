import { useMemo, useState } from 'react'
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
import { groupRotations, isServeOnlyPoint, type RotationGroup } from '../lib/rotations'
import { summarizeRotation, type RotationStat } from '../lib/stats'
import type { Rally, Session } from '../lib/types'
import { Card, Empty, SortableTable, fmtPct, fmtSigned, playerColor } from './ui'
import type { Column } from './ui'

const axis = { stroke: '#333333', fontSize: 11, tickLine: false }

interface RotationRow extends RotationStat {
  group: RotationGroup
}

function sourceLabel(source: RotationGroup['sources'][number]): string {
  const sets = source.sets.length ? `set${source.sets.length === 1 ? '' : 's'} ${source.sets.join(', ')}` : ''
  const rotations = source.rotationLabels.length
    ? source.rotationLabels.map((rotation) => `R${rotation.toUpperCase()}`).join(', ')
    : ''
  return [source.sessionLabel, sets, rotations].filter(Boolean).join(' · ')
}

export function Rotations({ rallies, sessions }: { rallies: Rally[]; sessions: Session[] }) {
  const [includeServeOnly, setIncludeServeOnly] = useState(false)
  const excludedCount = rallies.filter(isServeOnlyPoint).length
  const analyzedRallies = useMemo(
    () => (includeServeOnly ? rallies : rallies.filter((rally) => !isServeOnlyPoint(rally))),
    [includeServeOnly, rallies],
  )
  const groups = useMemo(() => groupRotations(analyzedRallies, sessions), [analyzedRallies, sessions])
  const rots: RotationRow[] = groups.map((group) => ({
    ...summarizeRotation(group.label, group.rallies),
    group,
  }))

  const controls = (
    <div className="filter-group" style={{ marginBottom: 14 }}>
      <button
        type="button"
        className={`chip ${includeServeOnly ? 'on' : ''}`}
        onClick={() => setIncludeServeOnly((value) => !value)}
      >
        {includeServeOnly ? 'Including' : 'Include'} aces + opponent serve errors
      </button>
      <span className="faint" style={{ fontSize: 11.5 }}>
        {includeServeOnly
          ? 'Serve-only points are included.'
          : `${excludedCount} serve-only point${excludedCount === 1 ? '' : 's'} excluded by default.`}
      </span>
    </div>
  )

  if (!rots.length) {
    return (
      <>
        {controls}
        <Empty>No rotations remain in the selected rallies.</Empty>
      </>
    )
  }

  const best = [...rots].sort((a, b) => b.net - a.net)[0]
  const worst = [...rots].sort((a, b) => a.net - b.net)[0]

  const columns: Column<RotationRow>[] = [
    {
      key: 'rotation',
      label: 'Rotation',
      align: 'left',
      value: (row) => row.rotation,
      render: (row) => (
        <div>
          <span className="name-cell">{row.rotation}</span>
          <div className="faint" style={{ fontSize: 10.5, marginTop: 2 }}>
            {row.group.sources.map(sourceLabel).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      key: 'net',
      label: 'Net',
      value: (row) => row.net,
      render: (row) => (
        <b style={{ color: row.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>{fmtSigned(row.net)}</b>
      ),
    },
    { key: 'won', label: 'W', value: (row) => row.won, render: (row) => row.won },
    { key: 'lost', label: 'L', value: (row) => row.lost, render: (row) => row.lost },
    {
      key: 'winPct',
      label: 'Win %',
      value: (row) => row.winPct,
      render: (row) => (
        <span style={{ color: row.winPct >= 50 ? 'var(--win)' : 'var(--loss)' }}>{fmtPct(row.winPct)}</span>
      ),
    },
    {
      key: 'sideoutPct',
      label: 'Side-out %',
      value: (row) => row.sideoutPct,
      title: 'Rally win rate while receiving in this ordered lineup',
      render: (row) => fmtPct(row.sideoutPct),
    },
    {
      key: 'servePointPct',
      label: 'Serve pt %',
      value: (row) => row.servePointPct,
      title: 'Rally win rate while serving in this ordered lineup',
      render: (row) => fmtPct(row.servePointPct),
    },
    { key: 'kills', label: 'Kills', value: (row) => row.kills, render: (row) => row.kills },
    ...(includeServeOnly
      ? [
          {
            key: 'aces',
            label: 'Aces',
            value: (row: RotationRow) => row.aces,
            render: (row: RotationRow) => row.aces,
          },
        ]
      : []),
    {
      key: 'errors',
      label: 'Errors',
      value: (row) => row.errors,
      render: (row) => <span style={{ color: 'var(--loss)' }}>{row.errors}</span>,
    },
    {
      key: 'errorRate',
      label: 'Err rate',
      value: (row) => row.errorRate,
      render: (row) => <span className="muted">{fmtPct(row.errorRate)}</span>,
    },
    { key: 'rallies', label: 'Rallies', value: (row) => row.rallies, render: (row) => row.rallies },
  ]

  const radarData = rots.map((row) => ({
    rotation: row.rotation,
    'Side-out %': +row.sideoutPct.toFixed(1),
    'Serve pt %': +row.servePointPct.toFixed(1),
  }))

  return (
    <>
      <div className="notice" style={{ marginBottom: 12 }}>
        <b>Lineup identity:</b> the letter is the ordered lineup family; the number is its tagged court position.
        Identical lineups combine across games, while a different lineup also called R1 becomes B1, C1, and so on.
      </div>
      {controls}

      <div className="grid g2" style={{ marginBottom: 14 }}>
        <Card title="Net points by rotation" hint={`best ${best.rotation} · worst ${worst.rotation}`}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={rots} margin={{ left: -20, right: 12, top: 10, bottom: 0 }}>
                <XAxis dataKey="rotation" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} allowDecimals={false} />
                <ReferenceLine y={0} stroke="#333333" />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,.04)' }}
                  content={({ active, payload }: any) =>
                    active && payload?.length ? (
                      <div className="tip">
                        <div className="t-title">{payload[0].payload.rotation}</div>
                        <div className="t-row">
                          {payload[0].payload.won}–{payload[0].payload.lost} ·{' '}
                          {fmtSigned(payload[0].payload.net)} net
                        </div>
                        <div className="t-row">Side-out {fmtPct(payload[0].payload.sideoutPct)}</div>
                        <div className="t-row">Serve point {fmtPct(payload[0].payload.servePointPct)}</div>
                      </div>
                    ) : null
                  }
                />
                <RBar dataKey="net" radius={[5, 5, 0, 0]} barSize={44}>
                  {rots.map((row) => (
                    <Cell key={row.group.id} fill={row.net >= 0 ? '#22c55e' : '#f43f5e'} />
                  ))}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            In these {analyzedRallies.length} included rallies, {best.rotation} is {fmtSigned(best.net)} and{' '}
            {worst.rotation} is {fmtSigned(worst.net)}. Treat the difference as a noisy sample, not a lineup grade.
          </div>
        </Card>

        <Card title="Side-out vs serve pressure" hint="by ordered lineup">
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
                        <div className="t-title">{label}</div>
                        {payload.map((entry: any) => (
                          <div className="t-row" key={entry.name} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}%
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

      <Card title="Rotation ledger" hint="same ordered lineups combined across dates and sets">
        <SortableTable
          rows={rots}
          columns={columns}
          rowKey={(row) => row.group.id}
          initialSort={{ key: 'rotation', dir: 'asc' }}
        />
      </Card>

      <Card title="Rotation identities" hint="front row on top · identical ordered lineups combined">
        <div className="grid g3" style={{ marginTop: 4 }}>
          {rots
            .filter((row) => row.group.lineup)
            .map((row) => {
              const lineup = row.group.lineup!
              return (
                <div className="lineup" key={row.group.id}>
                  <div className="rot-no">
                    <span>{row.rotation}</span>
                    <span style={{ color: row.net >= 0 ? 'var(--win)' : 'var(--loss)' }}>{fmtSigned(row.net)}</span>
                  </div>
                  <div className="court-row" style={{ gridTemplateColumns: `repeat(${lineup.front.length || 1}, 1fr)` }}>
                    {lineup.front.map((player) => (
                      <div className="court-cell" key={player} style={{ borderColor: playerColor(player) + '88' }}>
                        {player}
                      </div>
                    ))}
                  </div>
                  <div className="court-row" style={{ gridTemplateColumns: `repeat(${lineup.back.length || 1}, 1fr)` }}>
                    {lineup.back.map((player) => (
                      <div
                        className="court-cell back"
                        key={player}
                        style={{ borderColor: playerColor(player) + '88' }}
                      >
                        {player}
                      </div>
                    ))}
                  </div>
                  {lineup.sub ? (
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                      Sub · {lineup.sub}
                    </div>
                  ) : null}
                  <div className="faint" style={{ fontSize: 10.5, marginTop: 5 }}>
                    {row.group.sources.map(sourceLabel).join(' · ')}
                  </div>
                </div>
              )
            })}
        </div>
      </Card>
    </>
  )
}
