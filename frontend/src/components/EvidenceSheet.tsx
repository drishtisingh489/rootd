import { ExternalLink, FileText, Lock } from 'lucide-react'
import { formatDateTime } from '../lib/format'
import { EVIDENCE_LEVEL } from '../lib/status'
import type { BreakdownItem, EvidenceSource } from '../types'
import { Sheet } from './Sheet'
import { ItemPill, StatusCircle } from './StatusIcon'

const RECORD_LABELS: Record<string, string> = {
  recall_number: 'Recall number',
  status: 'Recall status',
  classification: 'Classification',
  report_date: 'Report date',
  product_description: 'Product description',
  reason_for_recall: 'Reason for recall',
  code_info: 'Lot / code info',
}

function formatReportDate(value: string): string {
  // openFDA dates are YYYYMMDD.
  const m = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : value
}

function SourceCard({ source }: { source: EvidenceSource }) {
  const details = Object.entries(source.record_details ?? {}).filter(([, v]) => v)
  return (
    <article className="source-card">
      <div className="source-head">
        <FileText size={18} aria-hidden="true" />
        <div>
          <p className="source-title">{source.title}</p>
          {source.publisher && <p className="source-publisher">{source.publisher}</p>}
          {source.checked_at && <p className="source-checked">Checked {formatDateTime(source.checked_at)}</p>}
        </div>
      </div>
      {details.length > 0 && (
        <dl className="record-details">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt>{RECORD_LABELS[k] ?? k}</dt>
              <dd>{k === 'report_date' ? formatReportDate(String(v)) : v}</dd>
            </div>
          ))}
        </dl>
      )}
      {source.url ? (
        <a className="btn btn-primary btn-sm source-link" href={source.url} target="_blank" rel="noopener noreferrer">
          View original source <ExternalLink size={16} aria-hidden="true" />
        </a>
      ) : (
        <p className="source-nolink">No link for this source — it was derived from the product data described above.</p>
      )}
    </article>
  )
}

/** Per-rating evidence: criterion, rating, reason, sources and a one-tap link to each original source. */
export function EvidenceSheet({
  item,
  isDemo = false,
  onClose,
}: {
  item: BreakdownItem | null
  isDemo?: boolean
  onClose: () => void
}) {
  const linked = item?.evidence_sources ?? []
  return (
    <Sheet open={Boolean(item)} title={item?.label ?? ''} onClose={onClose}>
      {item && (
        <div className="evidence">
          <div className="evidence-top">
            <StatusCircle status={item.status} size={52} />
            <div>
              <ItemPill status={item.status} />
              <p className="evidence-group">
                {item.group}
                {item.hard && (
                  <span className="hard-tag">
                    <Lock size={12} aria-hidden="true" /> Must avoid
                  </span>
                )}
              </p>
            </div>
          </div>
          <p className="evidence-reason">{item.short_reason}</p>
          {item.detail && <p className="evidence-detail">{item.detail}</p>}
          <p className="evidence-level">
            Evidence:{' '}
            <strong>
              {isDemo && item.evidence_level !== 'unknown'
                ? 'Demo data (fictional product)'
                : (EVIDENCE_LEVEL[item.evidence_level] ?? item.evidence_level)}
            </strong>
          </p>

          <h3 className="evidence-sources-title">Sources</h3>
          {linked.length > 0 ? (
            linked.map((s, i) => <SourceCard key={`${s.title}-${i}`} source={s} />)
          ) : (
            <div className="source-card source-none">
              <p className="source-title">No source link available</p>
              <p>
                {item.no_source_note ??
                  'This rating was derived from structured product fields we extracted from packaging / Open Food Facts.'}
              </p>
            </div>
          )}
          {linked.length > 0 && item.no_source_note && <p className="evidence-footnote">{item.no_source_note}</p>}
        </div>
      )}
    </Sheet>
  )
}
