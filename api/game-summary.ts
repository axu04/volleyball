/**
 * Generate a permanent match report for the tagger using the cheapest OpenAI text model.
 *
 * POST { secret, digest } → { text, model, generatedAt }
 * Requires TAGGER_SECRET + OPENAI_API_KEY (server-side only).
 */

interface ApiRequest {
  method?: string
  body?: unknown
  query: Record<string, string | string[] | undefined>
}
interface ApiResponse {
  status(code: number): ApiResponse
  json(data: unknown): void
  setHeader(name: string, value: string): void
}

/** Cheapest current OpenAI chat model for text summaries. */
const MODEL = 'gpt-5-nano'

function readBody(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }
  return {}
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  const secret = process.env.TAGGER_SECRET
  const openaiKey = process.env.OPENAI_API_KEY
  if (!secret) {
    res.status(500).json({ error: 'Server not configured: set TAGGER_SECRET.' })
    return
  }
  if (!openaiKey) {
    res.status(500).json({ error: 'Server not configured: set OPENAI_API_KEY.' })
    return
  }

  const body = readBody(req.body)
  const provided = (body.secret as string | undefined) ?? firstQuery(req.query.secret)
  if (provided !== secret) {
    res.status(401).json({ error: 'Wrong password.' })
    return
  }

  const digest = body.digest
  if (!digest || typeof digest !== 'object') {
    res.status(400).json({ error: 'Missing match digest.' })
    return
  }

  const system = `You are the film-room coach for Sunday's Didn't Work For Us (rec volleyball).
Your job is ANALYSIS, not a stats readout. The team already has a dashboard with win%, side-out, nets, and charts — never restate those as a list.

Rules:
- Do NOT open with "We went X-Y" or "Win rate was N%". Mention scores only if they support a contrast (e.g. set 2 flipped because…).
- Prefer relationships: serve vs receive, early vs crunch, best vs worst rotation/set, error mix vs how points were earned, first-ball quality vs outcomes.
- Use the JSON "contrasts", "possessionSplit", "phases", "momentum", "rotations", "touchQuality", and "notes" heavily. Cite 1–2 numbers only when they prove a point.
- Be specific and actionable (drill or in-match cue), not generic ("communicate more").
- Fair on players: credit patterns, not vibes; for needs-work name the skill leak from their error causes.
- No invented stats, no markdown tables, no bullet walls of percentages.

Structure as plain text with short labeled sections:
1) Story of the match — what actually decided it (2–4 sentences)
2) Hidden strengths — what worked that the scoreboard alone wouldn't show
3) Structural leaks — the 2–3 patterns that cost points (possession, phase, rotation, or skill)
4) Player edges — who changed outcomes and how (good + needs-work)
5) Next practice focus — one priority with a concrete cue or drill idea
Aim for ~400–500 words.`

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.55,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Write the deep match analysis from this digest JSON (do not regurgitate referenceRates):\n${JSON.stringify(digest)}`,
          },
        ],
      }),
    })

    const textBody = await aiRes.text()
    let parsed: unknown = null
    try {
      parsed = textBody ? JSON.parse(textBody) : null
    } catch {
      parsed = textBody
    }

    if (!aiRes.ok) {
      const msg =
        parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed
          ? String((parsed as { error?: { message?: string } }).error?.message ?? aiRes.status)
          : `OpenAI responded ${aiRes.status}`
      res.status(502).json({ error: msg })
      return
    }

    const choice = (parsed as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
    const text = choice?.message?.content?.trim()
    if (!text) {
      res.status(502).json({ error: 'OpenAI returned an empty summary.' })
      return
    }

    res.status(200).json({
      text,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
