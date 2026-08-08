/** Shared match-report shape (tagger draft + bundled dashboard). */

export interface GameSummary {
  text: string
  model: string
  generatedAt: string
}

export function parseSummaryMarkdown(md: string): GameSummary | null {
  const text = md.trim()
  if (!text) return null
  const meta = text.match(/_Generated\s+(.+?)\s*·\s*(.+?)_/)
  const generatedAt = meta?.[1]?.trim() || new Date().toISOString()
  const model = meta?.[2]?.trim() || 'unknown'
  const body = text
    .replace(/^#\s+Match summary[^\n]*\n+/i, '')
    .replace(/_Generated\s+.+?_\n*/i, '')
    .trim()
  if (!body) return null
  return { text: body, model, generatedAt }
}

export function formatSummaryMarkdown(summary: GameSummary, date: string): string {
  return [
    `# Match summary — ${date}`,
    '',
    `_Generated ${summary.generatedAt} · ${summary.model}_`,
    '',
    summary.text.trim(),
    '',
  ].join('\n')
}

export function summaryFilenameForDate(date: string): string {
  const safe = date.trim() || 'undated'
  return `${safe}.summary.md`
}

/** `2026-08-06.summary.md` → `2026-08-06` */
export function dateFromSummaryFile(fileName: string): string | null {
  const m = fileName.match(/^(\d{4}-\d{2}-\d{2})\.summary\.md$/i)
  return m?.[1] ?? null
}
