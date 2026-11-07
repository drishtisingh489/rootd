/* C2 Insights / My Impact: honest, scan-derived stats. Scans are never counted as purchases. */
import {
  Award,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileText,
  Flame,
  ScanLine,
  ShieldCheck,
  Sprout,
  TreeDeciduous,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { errorMessage, useApi } from '../api'
import { ErrorState, PageHeader } from '../components/Chrome'
import { ItemPill } from '../components/StatusIcon'
import { formatDate, formatDateTime } from '../lib/format'
import { useScanSession } from '../state/ScanSession'
import type { Insights as InsightsData, ValueStatus } from '../types'

const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last 12 months' },
]

const VALUE_PILL: Record<ValueStatus, { label: string; tone: string }> = {
  strong: { label: 'Strong', tone: 'green' },
  needs_attention: { label: 'Needs attention', tone: 'yellow' },
  more_data_needed: { label: 'More data needed', tone: 'gray' },
}

const MILESTONE_ICONS: Record<string, LucideIcon> = {
  first_scan: ScanLine,
  five_scans: Flame,
  first_green: Sprout,
  seven_days: CalendarDays,
}

const TOPIC_ICONS: Record<string, LucideIcon> = {
  deforestation: TreeDeciduous,
  'food-safety': ShieldCheck,
  evidence: FileText,
}

function usePeriod(): [number, (d: number) => void] {
  const [params, setParams] = useSearchParams()
  const days = Number(params.get('days')) || 30
  const valid = PERIODS.some((p) => p.days === days) ? days : 30
  return [valid, (d: number) => setParams(d === 30 ? {} : { days: String(d) }, { replace: true })]
}

function useInsights(days: number) {
  const api = useApi()
  const { historyVersion } = useScanSession()
  const [data, setData] = useState<InsightsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setError(null)
    api.insights(days).then(
      (d) => alive && setData(d),
      (e) => alive && setError(errorMessage(e)),
    )
    return () => {
      alive = false
    }
  }, [api, days, historyVersion, attempt])
  return { data, error, retry: () => setAttempt((n) => n + 1) }
}

export function Insights() {
  const [days, setDays] = usePeriod()
  const { data, error, retry } = useInsights(days)
  const periodLabel = PERIODS.find((p) => p.days === days)?.label.toLowerCase() ?? `last ${days} days`

  return (
    <main className="screen tab-screen insights">
      <header className="insights-header">
        <h1>My Impact 🌱</h1>
        <label className="period-select">
          <CalendarDays size={16} aria-hidden="true" />
          <span className="sr-only">Date range</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p className="eyebrow">YOUR SCANS, YOUR VALUES</p>

      {error ? (
        <ErrorState title="Couldn’t load your insights" message={error} onRetry={retry} />
      ) : !data ? (
        <div className="skeleton-block" aria-label="Loading insights" />
      ) : (
        <>
          <section className="alignment-card" aria-labelledby="align-title">
            <p id="align-title" className="alignment-title">
              Your values alignment
            </p>
            {data.alignment.percent !== null ? (
              <>
                <p className="alignment-pct">{data.alignment.percent}%</p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.alignment.percent}
                  aria-label="Share of rated scans that were a Good Match"
                >
                  <span style={{ width: `${data.alignment.percent}%` }} />
                </div>
                <p className="alignment-sub">
                  {data.alignment.aligned} of {data.alignment.rated} rated scan{data.alignment.rated === 1 ? '' : 's'} in
                  the {periodLabel} were a Good Match for your values
                  {data.alignment.unknown > 0 &&
                    ` (${data.alignment.unknown} with insufficient data not counted)`}
                  .
                </p>
              </>
            ) : (
              <p className="alignment-sub">
                No rated scans in the {periodLabel} yet. <Link to="/scan">Scan a product</Link> to start tracking.
              </p>
            )}
            <details className="definition">
              <summary>How is this calculated?</summary>
              <p>{data.alignment.definition}</p>
            </details>
          </section>

          <section aria-labelledby="progress-title">
            <h2 id="progress-title" className="section-title">
              Your progress <span className="muted">· {periodLabel}</span>
            </h2>
            <div className="counter-row">
              <div className="counter">
                <p className="counter-num">{data.counts.scans}</p>
                <p className="counter-label">Scans</p>
              </div>
              <div className="counter">
                <p className="counter-num">{data.counts.aligned_scans}</p>
                <p className="counter-label">Aligned scans</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="values-title">
            <h2 id="values-title" className="section-title">
              Your values
            </h2>
            {data.values.length === 0 ? (
              <p className="empty-text">
                You haven’t chosen any values yet. <Link to="/profile/preferences">Add preferences</Link>
              </p>
            ) : (
              <ul className="value-list">
                {data.values.map((v) => (
                  <li key={v.id}>
                    <span className="value-name">
                      {v.label}
                      <span className="value-meta">
                        {v.checked_scans ? `Checked in ${v.checked_scans} scan${v.checked_scans === 1 ? '' : 's'}` : 'Not checked yet'}
                      </span>
                    </span>
                    <span className={`value-pill tone-${VALUE_PILL[v.status].tone}`}>{VALUE_PILL[v.status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="explore-title">
            <h2 id="explore-title" className="section-title">
              Explore your impact
            </h2>
            <div className="menu-list">
              {data.topics.map((t) => {
                const Icon = TOPIC_ICONS[t.id] ?? FileText
                return (
                  <Link key={t.id} to={`/insights/${t.id}${days !== 30 ? `?days=${days}` : ''}`} className="menu-row">
                    <span className="menu-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="menu-text">
                      <span className="menu-title">{t.title}</span>
                      <span className="menu-sub">
                        {t.subtitle} · {t.count} item{t.count === 1 ? '' : 's'}
                      </span>
                    </span>
                    <ChevronRight size={20} aria-hidden="true" />
                  </Link>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="milestones-title">
            <h2 id="milestones-title" className="section-title">
              Scanning milestones
            </h2>
            <div className="milestone-grid">
              {data.milestones.map((m) => {
                const Icon = MILESTONE_ICONS[m.id] ?? Award
                return (
                  <div key={m.id} className={`milestone${m.achieved ? ' achieved' : ''}`}>
                    <span className="milestone-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <p className="milestone-title">{m.title}</p>
                    <p className="milestone-desc">{m.description}</p>
                    {m.achieved ? (
                      <p className="milestone-date">Achieved {formatDate(m.achieved_at)}</p>
                    ) : (
                      <div className="milestone-progress">
                        <div className="progress small" aria-hidden="true">
                          <span style={{ width: `${(m.progress / m.target) * 100}%` }} />
                        </div>
                        <span>
                          {m.progress}/{m.target}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <p className="disclaimer">{data.disclaimer}</p>
        </>
      )}
    </main>
  )
}

const TOPIC_TITLES: Record<string, { title: string; intro: string }> = {
  deforestation: {
    title: 'Deforestation insights',
    intro: 'How the products you scanned rated on deforestation risk, based on ingredient and sourcing evidence.',
  },
  'food-safety': {
    title: 'Food safety insights',
    intro: 'FDA recall checks and allergen conflicts found in your scans for this period.',
  },
  evidence: {
    title: 'Your evidence report',
    intro: 'Every source behind your results, when it was checked, and what couldn’t be verified.',
  },
}

export function InsightTopic() {
  const { topic = '' } = useParams()
  const [days] = usePeriod()
  const { data, error, retry } = useInsights(days)
  const meta = TOPIC_TITLES[topic]
  if (!meta) return <Navigate to="/insights" replace />
  const backTo = `/insights${days !== 30 ? `?days=${days}` : ''}`

  let body = null
  if (data && (topic === 'deforestation' || topic === 'food-safety')) {
    const entries = data.details[topic]
    body =
      entries.length === 0 ? (
        <p className="empty-text">
          {topic === 'deforestation'
            ? 'No deforestation ratings yet. Add “Reduced deforestation risk” in your preferences and scan products to see them here.'
            : 'No safety checks in this period yet.'}
        </p>
      ) : (
        <ul className="evidence-list">
          {entries.map((e, i) => {
            const src = e.item.evidence_sources.find((s) => s.url)
            return (
              <li key={`${e.scan_id}-${e.item.id}-${i}`} className="evidence-row">
                <div className="evidence-row-head">
                  <Link to={`/results/${e.scan_id}`} className="evidence-product">
                    {e.product || 'Unnamed product'}
                  </Link>
                  <ItemPill status={e.item.status} />
                </div>
                <p className="evidence-row-label">{e.item.label}</p>
                <p className="evidence-row-reason">{e.item.short_reason}</p>
                {src?.url ? (
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="source-inline">
                    {src.publisher || src.title} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <p className="source-inline muted">{e.item.no_source_note ?? 'No source link available.'}</p>
                )}
              </li>
            )
          })}
        </ul>
      )
  } else if (data && topic === 'evidence') {
    const { sources, gaps } = data.details.evidence
    body = (
      <>
        <h2 className="section-title">Sources ({sources.length})</h2>
        {sources.length === 0 ? (
          <p className="empty-text">No sources yet. Scan a product to build your evidence report.</p>
        ) : (
          <ul className="evidence-list">
            {sources.map((s, i) => (
              <li key={`${s.scan_id}-${i}`} className="evidence-row">
                <div className="evidence-row-head">
                  <Link to={`/results/${s.scan_id}`} className="evidence-product">
                    {s.product || 'Unnamed product'}
                  </Link>
                </div>
                <p className="evidence-row-label">{s.title}</p>
                <p className="evidence-row-reason">
                  {s.publisher}
                  {s.checked_at ? ` · checked ${formatDateTime(s.checked_at)}` : ''}
                </p>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="source-inline">
                    View original source <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <p className="source-inline muted">No link — derived from product data or your photo.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <h2 className="section-title">Unknowns ({gaps.length})</h2>
        {gaps.length === 0 ? (
          <p className="empty-text">No data gaps recorded.</p>
        ) : (
          <ul className="evidence-list compact">
            {gaps.map((g, i) => (
              <li key={`${g.scan_id}-${i}`} className="evidence-row">
                <Link to={`/results/${g.scan_id}`} className="evidence-product">
                  {g.product || 'Unnamed product'}
                </Link>
                <p className="evidence-row-reason">{g.gap}</p>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  return (
    <main className="screen tab-screen">
      <PageHeader title={meta.title} back={backTo} />
      <p className="lede">
        {meta.intro} <span className="muted">({PERIODS.find((p) => p.days === days)?.label.toLowerCase()})</span>
      </p>
      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : !data ? (
        <div className="skeleton-block" aria-label="Loading" />
      ) : (
        body
      )}
    </main>
  )
}
