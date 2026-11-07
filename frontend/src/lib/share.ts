import type { Scan } from '../types'
import { productTitle } from './format'

/** Shares a plain-text summary (results are private to the signed-in user, so no link is shared). */
export async function shareScan(scan: Scan): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const r = scan.overall_result
  const text = [
    `root’d result for ${productTitle(scan.product)}: ${r.label}.`,
    r.summary_short,
    ...r.summary_points.map((p) => `• ${p}`),
    scan.is_demo ? '(Demo data — fictional product.)' : '',
    'Personal preference fit, not a safety score.',
  ]
    .filter(Boolean)
    .join('\n')
  if (navigator.share) {
    try {
      await navigator.share({ title: 'root’d result', text })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
