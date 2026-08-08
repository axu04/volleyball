import { causeMeta } from '../lib/causes'
import {
  coreStats,
  errorGroups,
  phaseStats,
  playerStats,
  rotationStats,
  streaks,
} from '../lib/stats'
import { ralliesWithTouches, teamTouchSummary } from '../lib/touchStats'
import type { Rally } from '../lib/types'
import type { TaggerDraft } from './types'

export { formatSummaryMarkdown, parseSummaryMarkdown, summaryFilenameForDate } from '../lib/summaries'
export type { GameSummary } from '../lib/summaries'

/** Compact analytical payload for the summary model — not a dashboard dump. */
export function buildMatchDigest(draft: TaggerDraft) {
  const rallies = draftRalliesAsSession(draft)
  const core = coreStats(rallies)
  const players = playerStats(rallies)
  const groups = errorGroups(rallies)
  const phases = phaseStats(rallies)
  const st = streaks(rallies)
  const rotations = rotationStats(rallies).filter((r) => r.rallies >= 4)
  const touchTagged = ralliesWithTouches(rallies)
  const touches = touchTagged.length ? teamTouchSummary(rallies) : null

  const setBuckets = new Map<string, Rally[]>()
  for (const r of rallies) {
    if (!setBuckets.has(r.set)) setBuckets.set(r.set, [])
    setBuckets.get(r.set)!.push(r)
  }

  const setBreakdown = [...setBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([set, rs]) => {
      const c = coreStats(rs)
      return {
        set,
        tracked: `${c.won}-${c.lost}`,
        rallies: c.rallies,
        winPct: +c.winPct.toFixed(0),
        sideoutPct: +c.sideoutPct.toFixed(0),
        servePointPct: +c.servePointPct.toFixed(0),
        errorRate: +c.errorRate.toFixed(0),
        errors: c.errors,
        aces: c.aces,
        serveErrors: c.serveErrs,
        acedOn: c.acedOn,
        topLossCause: topCauses(rs, false)[0] ?? null,
        topWinCause: topCauses(rs, true)[0] ?? null,
      }
    })

  const sortedRot = [...rotations].sort((a, b) => b.winPct - a.winPct)
  const bestRot = sortedRot[0]
  const worstRot = sortedRot[sortedRot.length - 1]

  const early = phases.find((p) => p.phase === 'Early')
  const crunch = phases.find((p) => p.phase === 'Crunch time')

  const serveRallies = rallies.filter((r) => r.serving)
  const recvRallies = rallies.filter((r) => !r.serving)
  const serveCore = coreStats(serveRallies)
  const recvCore = coreStats(recvRallies)

  const official = draft.officialScores.map((s) => ({
    set: s.set,
    score: `${s.us}-${s.them}`,
  }))

  const selfInflictedPct = core.lost ? +((core.errors / core.lost) * 100).toFixed(0) : 0

  return {
    team: "Sunday's Didn't Work For Us",
    date: draft.date,
    videoNote: draft.videoTitle || undefined,
    officialScores: official.length ? official : undefined,
    setBreakdown,
    // Headline numbers — cite sparingly; do not recite this block.
    referenceRates: {
      rallies: core.rallies,
      winPct: +core.winPct.toFixed(1),
      sideoutPct: +core.sideoutPct.toFixed(1),
      servePointPct: +core.servePointPct.toFixed(1),
      errorRate: +core.errorRate.toFixed(1),
      selfInflictedPctOfLosses: selfInflictedPct,
      kills: core.kills,
      aces: core.aces,
      forcedOppErrors: core.forced,
      errors: core.errors,
      serveErrors: core.serveErrs,
      acedOn: core.acedOn,
      aceToServeError: `${core.aces}:${core.serveErrs}`,
    },
    possessionSplit: {
      whenServing: {
        rallies: serveCore.rallies,
        winPct: +serveCore.winPct.toFixed(0),
        errorRate: +serveCore.errorRate.toFixed(0),
        topLoss: topCauses(serveRallies, false).slice(0, 3),
        topWin: topCauses(serveRallies, true).slice(0, 3),
      },
      whenReceiving: {
        rallies: recvCore.rallies,
        winPct: +recvCore.winPct.toFixed(0),
        errorRate: +recvCore.errorRate.toFixed(0),
        topLoss: topCauses(recvRallies, false).slice(0, 3),
        topWin: topCauses(recvRallies, true).slice(0, 3),
      },
    },
    phases: phases.map((p) => ({
      phase: p.phase,
      rallies: p.rallies,
      winPct: +p.winPct.toFixed(0),
      errorRate: +p.errorRate.toFixed(0),
    })),
    momentum: {
      longestRun: st.longestRun,
      longestRunWhere: st.longestRunLabel || null,
      longestSkid: st.longestSkid,
      longestSkidWhere: st.longestSkidLabel || null,
      runsOf3Plus: st.runs3Plus,
      skidsOf3Plus: st.skids3Plus,
    },
    rotations:
      rotations.length > 0
        ? rotations.map((r) => ({
            rotation: r.rotation,
            rallies: r.rallies,
            winPct: +r.winPct.toFixed(0),
            sideoutPct: +r.sideoutPct.toFixed(0),
            servePointPct: +r.servePointPct.toFixed(0),
            errorRate: +r.errorRate.toFixed(0),
            errors: r.errors,
          }))
        : undefined,
    errorGroups: groups.map((g) => ({
      group: g.group,
      count: g.count,
      sharePct: +g.share.toFixed(0),
    })),
    playerImpact: players.slice(0, 12).map((p) => ({
      name: p.name,
      tagged: p.involved,
      net: p.net,
      plus: p.plus,
      errors: p.errors,
      winPctWhenTagged: +p.winPct.toFixed(0),
      errorRateWhenTagged: +p.errorRate.toFixed(0),
      kills: p.kills,
      aces: p.aces,
      forced: p.forced,
      serveErrors: p.serveErrs,
      acedOn: p.acedOn,
      topErrorCauses: Object.entries(p.errorsByCause)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cause, count]) => ({ cause: causeMeta(cause).label, count })),
    })),
    touchQuality: touches
      ? {
          ralliesTagged: touches.ralliesTagged,
          firstBallAvg: +touches.firstBall.avg.toFixed(2),
          firstBallAttempts: touches.firstBall.attempts,
          winPctAfterGoodFirst: +touches.winPctAfterGoodFirst.toFixed(0),
          winPctAfterPoorFirst: +touches.winPctAfterPoorFirst.toFixed(0),
          goodFirstN: touches.goodFirstN,
          poorFirstN: touches.poorFirstN,
          emergencyKeepAlivePct: touches.emergencies
            ? +((touches.emergenciesKeptAlive / touches.emergencies) * 100).toFixed(0)
            : null,
          emergencies: touches.emergencies,
          inSystemKillPct: touches.inSystemAttempts
            ? +((touches.inSystemKills / touches.inSystemAttempts) * 100).toFixed(0)
            : null,
          inSystemAttempts: touches.inSystemAttempts,
          skillAvgs: touches.bySkill
            .filter((s) => s.attempts >= 3)
            .map((s) => ({
              skill: s.label,
              attempts: s.attempts,
              avg: +s.avg.toFixed(2),
              zeroPct: +s.zeroPct.toFixed(0),
            })),
        }
      : undefined,
    // Precomputed contrasts — lean on these for the analysis.
    contrasts: {
      sideoutMinusServePoint: +(core.sideoutPct - core.servePointPct).toFixed(1),
      serveWinMinusRecvWin: +(serveCore.winPct - recvCore.winPct).toFixed(1),
      crunchWinMinusEarlyWin:
        early && crunch ? +(crunch.winPct - early.winPct).toFixed(1) : null,
      bestRotation:
        bestRot && worstRot && bestRot.rotation !== worstRot.rotation
          ? {
              rotation: bestRot.rotation,
              winPct: +bestRot.winPct.toFixed(0),
              vsWorst: {
                rotation: worstRot.rotation,
                winPct: +worstRot.winPct.toFixed(0),
                gapPts: +(bestRot.winPct - worstRot.winPct).toFixed(0),
              },
            }
          : null,
      dominantErrorGroup: groups[0]
        ? { group: groups[0].group, sharePct: +groups[0].share.toFixed(0), count: groups[0].count }
        : null,
      largestPositiveNets: players
        .filter((p) => p.net > 0)
        .slice(0, 3)
        .map((p) => ({ name: p.name, net: p.net, plus: p.plus, errors: p.errors })),
      largestNegativeNets: [...players]
        .filter((p) => p.net < 0)
        .sort((a, b) => a.net - b.net)
        .slice(0, 3)
        .map((p) => ({
          name: p.name,
          net: p.net,
          errors: p.errors,
          topError: Object.entries(p.errorsByCause).sort((a, b) => b[1] - a[1])[0]?.[0],
        }))
        .map((p) => ({
          ...p,
          topError: p.topError ? causeMeta(p.topError).label : null,
        })),
      setSwing:
        setBreakdown.length >= 2
          ? {
              bestSet: [...setBreakdown].sort((a, b) => b.winPct - a.winPct)[0],
              worstSet: [...setBreakdown].sort((a, b) => a.winPct - b.winPct)[0],
            }
          : null,
    },
    notes: draft.rallies
      .filter((r) => r.notes.trim())
      .slice(0, 16)
      .map((r) => ({ set: r.set, cause: r.cause, note: r.notes.trim() })),
  }
}

function topCauses(rallies: Rally[], won: boolean) {
  const map = new Map<string, number>()
  for (const r of rallies) {
    if (r.won !== won) continue
    map.set(r.cause, (map.get(r.cause) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cause, count]) => ({ cause: causeMeta(cause, won).label, count }))
}

function draftRalliesAsSession(draft: TaggerDraft): Rally[] {
  const bySetN = new Map<string, number>()
  return draft.rallies.map((r) => {
    const n = (bySetN.get(r.set) ?? 0) + 1
    bySetN.set(r.set, n)
    return {
      id: r.id,
      sessionId: `draft-${draft.date}`,
      sessionLabel: draft.date,
      date: draft.date,
      set: r.set,
      n,
      serving: r.serving,
      won: r.won,
      cause: r.cause,
      players: r.players,
      rotation: r.rotation || null,
      notes: r.notes,
      touches: r.touches ?? [],
      videoTimestamp: '',
      youtubeUrl: r.youtubeUrl,
      server: null,
      us: 0,
      them: 0,
    }
  })
}
