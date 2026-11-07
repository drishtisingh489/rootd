import type { Scan } from '../types'

export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function initials(displayName: string | null | undefined, email?: string | null): string {
  const source = (displayName || email || '').trim()
  if (!source) return '🌱'
  const parts = source.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '🌱'
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return ''
  const d = new Date(iso.length === 4 ? `${iso}-01-01` : iso)
  if (Number.isNaN(d.getTime())) return iso
  if (iso.length === 4) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', ...opts })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function relativeDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return formatDate(iso, { year: undefined })
}

/** Summary points arrive as "Kind: Label: reason". */
export type PointKind = 'safety' | 'conflict' | 'unverified' | 'tradeoff' | 'aligned' | 'unknown' | 'note'

export function parsePoint(point: string): { kind: PointKind; text: string } {
  const m = point.match(/^(Safety|Conflict|Unverified|Tradeoff|Aligned|Unknown):\s*(.*)$/)
  if (!m) return { kind: 'note', text: point }
  return { kind: m[1].toLowerCase() as PointKind, text: m[2] }
}

/** One concise reason for history cards: the most important point, without its label prefix. */
export function conciseReason(scan: Scan): string {
  const first = scan.overall_result.summary_points[0]
  if (!first) return scan.overall_result.summary_short
  const { text } = parsePoint(first)
  const parts = text.split(': ')
  return parts.length > 1 ? parts.slice(1).join(': ') : text
}

export function productTitle(p: { brand?: string | null; name?: string | null }): string {
  return [p.brand, p.name].filter(Boolean).join(' ') || 'Unnamed product'
}
