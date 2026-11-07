import { Link } from 'react-router-dom'
import { conciseReason, relativeDay } from '../lib/format'
import { VERDICT_META } from '../lib/status'
import type { Scan } from '../types'
import { DemoTag, ProductThumb } from './Product'
import { VerdictBadge } from './StatusIcon'

/** Recent-scan product tile: pastel image panel, name, concise reason and a labelled verdict badge. */
export function ScanCard({ scan }: { scan: Scan }) {
  const status = scan.overall_result.status
  const tone = VERDICT_META[status].tone
  return (
    <Link to={`/results/${scan.scan_id}`} className="scan-card">
      <div className="scan-card-image">
        <ProductThumb src={scan.product.image_url} tone={status} size="100%" alt="" />
        <span className="scan-card-badge">
          <VerdictBadge status={status} compact />
        </span>
      </div>
      <div className="scan-card-body">
        <p className="scan-card-name">{scan.product.name || scan.product.brand || 'Unnamed product'}</p>
        <p className={`scan-card-reason text-${tone}`}>{conciseReason(scan)}</p>
        <p className="scan-card-meta">
          {relativeDay(scan.created_at)}
          {scan.is_demo && <DemoTag />}
        </p>
      </div>
    </Link>
  )
}
