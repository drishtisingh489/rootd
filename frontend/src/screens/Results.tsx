/*
 * E1 Overall Results (animated tree + tappable summary) and E2 Detailed Preference Breakdown.
 * The verdict itself is computed by deterministic backend rules; this screen only presents it and its evidence.
 */
import {
  Ban,
  Check,
  ChevronRight,
  CircleQuestionMark,
  ExternalLink,
  Info,
  Lock,
  ScanLine,
  ShieldCheck,
  ShieldExclamationPoint,
  TriangleExclamationPoint,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, useApi } from '../api'
import { ErrorState, Notice, ResultHeader } from '../components/Chrome'
import { EvidenceSheet } from '../components/EvidenceSheet'
import { ProductWidget } from '../components/Product'
import { StatusCircle, VerdictBadge } from '../components/StatusIcon'
import { Tree, useTreeGrowth } from '../components/Tree'
import { parsePoint, type PointKind } from '../lib/format'
import { shareScan } from '../lib/share'
import { ITEM_META, VERDICT_META } from '../lib/status'
import { useScanSession, type ProductHint } from '../state/ScanSession'
import type { BreakdownItem, ItemStatus, RecallCheck, Scan } from '../types'

function goBack(navigate: ReturnType<typeof useNavigate>, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  if (idx > 0) navigate(-1)
  else navigate(fallback)
}

function useScanResult(scanId: string | undefined) {
  const api = useApi()
  const session = useScanSession()
  const navigate = useNavigate()
  const [scan, setScan] = useState<Scan | null>(() =>
    scanId && scanId !== 'analyzing' ? (session.cached(scanId) ?? null) : null,
  )
  const [error, setError] = useState<ApiError | null>(null)
  const [fresh] = useState(() => scanId === 'analyzing')
  const [hint] = useState<ProductHint | undefined>(() => (scanId === 'analyzing' ? session.pending?.hint : undefined))
  const [preview] = useState<string | null>(() =>
    scanId === 'analyzing' ? (session.pending?.preview ?? null) : scanId ? (session.previewFor(scanId) ?? null) : null,
  )

  useEffect(() => {
    if (!scanId) return
    let alive = true
    if (scanId === 'analyzing') {
      const pending = session.pending
      if (!pending) {
        navigate('/home', { replace: true })
        return
      }
      pending.promise.then(
        (s) => {
          if (!alive) return
          setScan(s)
          navigate(`/results/${s.scan_id}`, { replace: true })
        },
        (e) => alive && setError(e instanceof ApiError ? e : new ApiError(0, 'error', String(e))),
      )
      return () => {
        alive = false
      }
    }
    if (scan?.scan_id === scanId) return
    const cached = session.cached(scanId)
    if (cached) {
      setScan(cached)
      return
    }
    api.getScan(scanId).then(
      (s) => {
        if (!alive) return
        session.remember(s)
        setScan(s)
      },
      (e) => alive && setError(e instanceof ApiError ? e : new ApiError(0, 'error', String(e))),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId])

  return { scan, error, fresh, hint, preview }
}

function useShare(scan: Scan | null) {
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])
  const share = scan
    ? async () => {
        const outcome = await shareScan(scan)
        if (outcome === 'copied') setToast('Result summary copied to clipboard')
        if (outcome === 'failed') setToast('Sharing isn’t available in this browser')
      }
    : undefined
  return { share, toast }
}

const POINT_ICONS: Record<PointKind, { Icon: LucideIcon; tone: string; label: string }> = {
  safety: { Icon: ShieldExclamationPoint, tone: 'red', label: 'Safety' },
  conflict: { Icon: Ban, tone: 'red', label: 'Verified conflict' },
  tradeoff: { Icon: TriangleExclamationPoint, tone: 'yellow', label: 'Tradeoff' },
  unverified: { Icon: CircleQuestionMark, tone: 'gray', label: 'Unverified' },
  unknown: { Icon: CircleQuestionMark, tone: 'gray', label: 'Unknown' },
  aligned: { Icon: Check, tone: 'green', label: 'Aligned' },
  note: { Icon: Info, tone: 'gray', label: 'Note' },
}

function RecallStrip({ recall }: { recall: RecallCheck }) {
  const tone = ITEM_META[recall.verdict].tone
  const title =
    recall.verdict === 'red'
      ? 'Active FDA recall'
      : recall.verdict === 'yellow'
        ? 'Recall caution'
        : recall.verdict === 'green'
          ? 'No matching FDA recall found'
          : 'Recall not checked'
  const Icon = recall.verdict === 'green' ? ShieldCheck : ShieldExclamationPoint
  const link = recall.sources.find((s) => s.url)?.url
  return (
    <section className={`recall-strip tone-${tone}`} aria-label="Food safety check">
      <Icon size={22} aria-hidden="true" />
      <div>
        <p className="recall-title">{title}</p>
        <p className="recall-msg">{recall.message}</p>
        {recall.verdict !== 'gray' && <p className="recall-note">{recall.coverage_note}</p>}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="recall-link">
            {recall.verdict === 'green' ? 'View the openFDA search' : 'View the FDA record'}{' '}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  )
}

const LOADING_STEPS = ['Looking up product records', 'Checking FDA recall records', 'Comparing with your preferences']

export function Results() {
  const { scanId } = useParams()
  const navigate = useNavigate()
  const { scan, error, fresh, hint, preview } = useScanResult(scanId)
  const growth = useTreeGrowth(!fresh)
  const { share, toast } = useShare(scan)
  const [stepIdx, setStepIdx] = useState(0)
  const settled = growth.grown && scan !== null

  useEffect(() => {
    if (settled) return
    const t = setInterval(() => setStepIdx((i) => Math.min(i + 1, LOADING_STEPS.length - 1)), 1300)
    return () => clearInterval(t)
  }, [settled])

  const back = () => (fresh ? navigate('/home') : goBack(navigate, '/home'))

  if (error) {
    return (
      <main className="screen result-screen">
        <ResultHeader onBack={back} />
        <ErrorState
          title={error.status === 404 ? 'Scan not found' : 'We couldn’t analyze this product'}
          message={error.message}
          action={
            <Link to="/scan" replace className="btn btn-primary btn-sm">
              Back to scanner
            </Link>
          }
        />
      </main>
    )
  }

  const r = scan?.overall_result
  const meta = r ? VERDICT_META[r.status] : null
  const product = scan?.product
  const counts = r?.counts

  return (
    <main className="screen result-screen">
      <ResultHeader onBack={back} onShare={share} />
      {(scan?.is_demo || hint?.is_demo) && (
        <Notice tone="warn">
          <strong>Demo data.</strong> Fictional product used to show the flow — not a real assessment.
        </Notice>
      )}
      <ProductWidget
        name={product?.name ?? hint?.name ?? ''}
        brand={product?.brand ?? hint?.brand ?? ''}
        size={product?.package_size ?? hint?.package_size}
        variant={product?.variant}
        image={product?.image_url ?? hint?.image_url ?? preview}
        isDemo={scan?.is_demo ?? hint?.is_demo}
      />

      <section className="tree-stage" aria-live="polite">
        <Tree
          result={r ? { status: r.status, score: r.alignment_score } : null}
          label={meta?.label ?? ''}
          growth={growth}
        />
        {settled && r && meta ? (
          <div className="verdict-block">
            <p className={`verdict-label tone-${meta.tone}`}>
              <meta.Icon size={22} strokeWidth={2.4} aria-hidden="true" />
              {meta.label}
            </p>
            {r.alignment_score !== null && (
              <p className="score-line">
                Preference-fit estimate <strong>{r.alignment_score}</strong>/100 · not a safety score
              </p>
            )}
            {counts && (
              <p className="counts-line">
                {(['green', 'yellow', 'red', 'gray'] as ItemStatus[])
                  .filter((s) => counts[s])
                  .map((s) => `${counts[s]} ${ITEM_META[s].label.toLowerCase()}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        ) : (
          <div className="verdict-block">
            <p className="growing-title">Growing your results…</p>
            <ul className="growing-steps">
              {LOADING_STEPS.map((s, i) => (
                <li key={s} className={i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {settled && scan && r && (
        <>
          <Link to={`/results/${scan.scan_id}/details`} className="summary-card">
            <span className="summary-title">Why it’s {r.status === 'unknown' ? 'marked' : 'a'} {r.label}</span>
            <span className="summary-short">{r.summary_short}</span>
            <ul className="summary-points">
              {r.summary_points.map((p) => {
                const { kind, text } = parsePoint(p)
                const icon = POINT_ICONS[kind]
                return (
                  <li key={p}>
                    <span className={`pt-icon tone-${icon.tone}`} title={icon.label}>
                      <icon.Icon size={14} strokeWidth={2.6} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="sr-only">{icon.label}: </span>
                      {text}
                    </span>
                  </li>
                )
              })}
            </ul>
            <span className="summary-cta">
              Tap to see detailed breakdown <ChevronRight size={18} aria-hidden="true" />
            </span>
          </Link>

          <RecallStrip recall={scan.recall_check} />

          <div className="next-actions">
            <Link to="/scan" className="btn btn-primary btn-block">
              <ScanLine size={18} aria-hidden="true" /> Scan another product
            </Link>
            <Link to="/home" className="btn btn-outline btn-block">
              Back to Home
            </Link>
          </div>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}

const SECTION_ORDER = [
  'Food Safety / Recalls',
  'Allergies & Diets',
  'Nutrition Goals',
  'Ethical Values',
  'Environmental Priorities',
]

export function ResultDetails() {
  const { scanId } = useParams()
  const navigate = useNavigate()
  const { scan, error } = useScanResult(scanId)
  const { share, toast } = useShare(scan)
  const [open, setOpen] = useState<BreakdownItem | null>(null)
  const back = () => goBack(navigate, `/results/${scanId}`)

  if (error) {
    return (
      <main className="screen result-screen">
        <ResultHeader onBack={back} />
        <ErrorState message={error.message} />
      </main>
    )
  }
  if (!scan) {
    return (
      <main className="screen result-screen">
        <ResultHeader onBack={back} />
        <div className="skeleton-block" aria-label="Loading breakdown" />
      </main>
    )
  }

  const groups = [
    ...SECTION_ORDER,
    ...new Set(scan.preference_breakdown.map((i) => i.group).filter((g) => !SECTION_ORDER.includes(g))),
  ]
    .map((g) => ({ group: g, items: scan.preference_breakdown.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0)
  const onlySafety = groups.length === 1 && groups[0].group === SECTION_ORDER[0]

  return (
    <main className="screen result-screen">
      <ResultHeader onBack={back} onShare={share} />
      {scan.is_demo && (
        <Notice tone="warn">
          <strong>Demo data.</strong> Fictional product — not a real assessment.
        </Notice>
      )}
      <ProductWidget
        name={scan.product.name}
        brand={scan.product.brand}
        size={scan.product.package_size}
        variant={scan.product.variant}
        image={scan.product.image_url}
        isDemo={scan.is_demo}
      />

      <div className="breakdown-head">
        <h1>Your detailed breakdown</h1>
        <VerdictBadge status={scan.overall_result.status} />
      </div>
      <ul className="legend" aria-label="What the icons mean">
        {(['green', 'yellow', 'red', 'gray'] as ItemStatus[]).map((s) => (
          <li key={s}>
            <StatusCircle status={s} size={22} />
            {s === 'green' ? 'Looks good' : s === 'yellow' ? 'Caution' : s === 'red' ? 'Conflict' : 'Not enough data'}
          </li>
        ))}
      </ul>
      <p className="hint-line">
        Tap any rating to see the evidence and its original source.{' '}
        <Lock size={11} aria-hidden="true" /> marks allergies and restrictions you set as strict.
      </p>

      {groups.map(({ group, items }) => (
        <section key={group} className="tile-section" aria-label={group}>
          <h2>{group}</h2>
          <div className="tile-grid">
            {items.map((item) => {
              const meta = ITEM_META[item.status]
              return (
                <button
                  key={item.id}
                  type="button"
                  className="rating-tile"
                  onClick={() => setOpen(item)}
                  aria-label={`${item.label}: ${meta.label}. ${item.short_reason} Tap for evidence.`}
                >
                  <StatusCircle status={item.status} size={60} />
                  <span className="tile-label">{item.label}</span>
                  <span className={`tile-status text-${meta.tone}`}>
                    {item.hard && <Lock size={11} aria-hidden="true" />} {meta.label}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {onlySafety && (
        <Notice tone="info">
          You haven’t saved any food preferences yet, so only the safety check ran.{' '}
          <Link to="/profile/preferences">Add preferences</Link> to get a personalized rating.
        </Notice>
      )}

      {scan.data_gaps.length > 0 && (
        <details className="gaps">
          <summary>What we couldn’t check ({scan.data_gaps.length})</summary>
          <ul>
            {scan.data_gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </details>
      )}

      <EvidenceSheet item={open} isDemo={scan.is_demo} onClose={() => setOpen(null)} />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}
