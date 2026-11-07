import { ITEM_META, VERDICT_META } from '../lib/status'
import type { ItemStatus, Verdict } from '../types'

/** Bold clipart-style circular indicator. Always paired with a text label by the caller. */
export function StatusCircle({ status, size = 64 }: { status: ItemStatus; size?: number }) {
  const meta = ITEM_META[status]
  return (
    <span className={`status-circle tone-${meta.tone}`} style={{ width: size, height: size }} aria-hidden="true">
      <meta.Icon size={Math.round(size * 0.46)} strokeWidth={2.4} />
    </span>
  )
}

/** Small pill with dot + text, e.g. on product cards. Text is always present (not colour-only). */
export function VerdictBadge({ status, compact = false }: { status: Verdict; compact?: boolean }) {
  const meta = VERDICT_META[status]
  return (
    <span className={`verdict-badge tone-${meta.tone}`}>
      <span className="dot" aria-hidden="true" />
      {compact ? meta.short : meta.label}
    </span>
  )
}

export function ItemPill({ status }: { status: ItemStatus }) {
  const meta = ITEM_META[status]
  return (
    <span className={`verdict-badge tone-${meta.tone}`}>
      <meta.Icon size={13} strokeWidth={2.6} aria-hidden="true" />
      {meta.label}
    </span>
  )
}
