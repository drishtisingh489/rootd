import { ChevronRight, ExternalLink, ScanLine, Search, Sprout } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, useApi } from '../api'
import { Avatar } from '../components/Avatar'
import { ErrorState, PageHeader } from '../components/Chrome'
import { ScanCard } from '../components/ScanCard'
import { greeting, productTitle } from '../lib/format'
import { VERDICT_META } from '../lib/status'
import { useLoadedProfile } from '../state/ProfileContext'
import { useScanSession } from '../state/ScanSession'
import type { DailyBranch, Scan, Verdict } from '../types'

function useScans() {
  const api = useApi()
  const { historyVersion, remember } = useScanSession()
  const [scans, setScans] = useState<Scan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setError(null)
    api.listScans().then(
      (r) => {
        if (!alive) return
        r.scans.forEach(remember)
        setScans(r.scans)
      },
      (e) => alive && setError(errorMessage(e)),
    )
    return () => {
      alive = false
    }
  }, [api, historyVersion, remember, attempt])
  return { scans, error, retry: () => setAttempt((n) => n + 1) }
}

function DailyBranchCard() {
  const api = useApi()
  const [item, setItem] = useState<DailyBranch | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    api.dailyBranch().then(
      (b) => alive && setItem(b),
      (e) => alive && setError(errorMessage(e)),
    )
    return () => {
      alive = false
    }
  }, [api])

  return (
    <section className="daily-branch" aria-labelledby="daily-branch-title">
      <div className="db-label">
        <span className="db-icon">
          <Sprout size={16} aria-hidden="true" />
        </span>
        <span id="daily-branch-title">Daily Branch</span>
        {item && <span className="db-context">{item.context_label}</span>}
      </div>
      {item ? (
        <>
          <h2 className="db-headline">{item.headline}</h2>
          <p className="db-summary">{item.summary}</p>
          <div className="db-foot">
            <span className="db-source">
              {item.publisher}
              {item.published_at ? ` · ${item.published_at.slice(0, 4)}` : ''}
            </span>
            <a className="db-link" href={item.source_url} target="_blank" rel="noopener noreferrer">
              Read more <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </>
      ) : error ? (
        <p className="db-summary muted">Today’s Daily Branch couldn’t load. {error}</p>
      ) : (
        <div className="skeleton-lines" aria-label="Loading Daily Branch">
          <span />
          <span />
          <span className="short" />
        </div>
      )}
    </section>
  )
}

function EmptyScans() {
  return (
    <div className="empty-scans">
      <span className="empty-icon">
        <ScanLine size={30} aria-hidden="true" />
      </span>
      <p className="empty-title">No scans yet</p>
      <p className="empty-text">Scan your first product to see how it lines up with your values.</p>
      <Link to="/scan" className="btn btn-primary btn-sm">
        Scan your first product
      </Link>
    </div>
  )
}

export function Home() {
  const profile = useLoadedProfile()
  const { scans, error, retry } = useScans()
  const name = profile.display_name.trim() // exactly what the user asked to be called

  return (
    <main className="screen tab-screen home">
      <header className="home-header">
        <Link to="/profile" className="home-avatar" aria-label="Open your profile">
          <Avatar name={profile.display_name} email={profile.email} src={profile.profile_image_url} size={52} />
        </Link>
        <div className="home-greeting">
          {name ? (
            <>
              <p>{greeting()},</p>
              <h1>{name}</h1>
            </>
          ) : (
            <h1>{greeting()}</h1>
          )}
        </div>
      </header>

      <DailyBranchCard />

      <Link to="/scan" className="scan-hero">
        <span className="scan-hero-icon">
          <ScanLine size={34} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="scan-hero-text">
          <span className="scan-hero-title">Scan Item</span>
          <span className="scan-hero-sub">Check how food aligns with your values.</span>
        </span>
        <ChevronRight size={24} className="scan-hero-chevron" aria-hidden="true" />
      </Link>

      <section className="recent" aria-labelledby="recent-title">
        <div className="section-head">
          <h2 id="recent-title">Recent Scans</h2>
          <Link to="/history" className="view-all">
            View All <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {error ? (
          <ErrorState title="Couldn’t load your scans" message={error} onRetry={retry} />
        ) : scans === null ? (
          <div className="scan-grid" aria-label="Loading scans">
            {[0, 1].map((i) => (
              <div key={i} className="scan-card skeleton" />
            ))}
          </div>
        ) : scans.length === 0 ? (
          <EmptyScans />
        ) : (
          <div className="scan-grid">
            {scans.slice(0, 6).map((s) => (
              <ScanCard key={s.scan_id} scan={s} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

const FILTERS: (Verdict | 'all')[] = ['all', 'green', 'yellow', 'red', 'unknown']

export function History() {
  const { scans, error, retry } = useScans()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Verdict | 'all'>('all')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (scans ?? []).filter(
      (s) =>
        (filter === 'all' || s.overall_result.status === filter) &&
        (!q || productTitle(s.product).toLowerCase().includes(q)),
    )
  }, [scans, query, filter])

  return (
    <main className="screen tab-screen">
      <PageHeader title="Scan History" back="/home" />
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search your scans</span>
        <input type="search" placeholder="Search your scans" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="chip-row" role="group" aria-label="Filter by result">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${filter === f ? ' on' : ''}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : VERDICT_META[f].short}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorState title="Couldn’t load your scans" message={error} onRetry={retry} />
      ) : scans === null ? (
        <div className="scan-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="scan-card skeleton" />
          ))}
        </div>
      ) : scans.length === 0 ? (
        <EmptyScans />
      ) : shown.length === 0 ? (
        <p className="empty-text center">No scans match that search.</p>
      ) : (
        <>
          <p className="count-line">
            {shown.length} of {scans.length} scan{scans.length === 1 ? '' : 's'}
          </p>
          <div className="scan-grid">
            {shown.map((s) => (
              <ScanCard key={s.scan_id} scan={s} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
