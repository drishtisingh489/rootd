import { ArrowLeft, ChevronLeft, LoaderCircle, RefreshCw, Share2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import logoMark from '../assets/rootd-logo-mark.png'

/** Rounded-square back button from the auth reference. `to` makes the destination explicit. */
export function BackButton({ to, label = 'Back', onClick }: { to?: string; label?: string; onClick?: () => void }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="back-btn"
      aria-label={label}
      onClick={onClick ?? (() => (to ? navigate(to) : navigate(-1)))}
    >
      <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
    </button>
  )
}

export function PageHeader({
  title,
  back,
  onBack,
  right,
}: {
  title: string
  back?: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <header className="page-header">
      <BackButton to={back} onClick={onBack} />
      <h1>{title}</h1>
      <div className="page-header-right">{right}</div>
    </header>
  )
}

/** Results chrome: Back on the left, root’d logo centered, Share on the right. */
export function ResultHeader({ onBack, onShare }: { onBack: () => void; onShare?: () => void }) {
  return (
    <header className="result-header">
      <button type="button" className="text-btn" onClick={onBack}>
        <ArrowLeft size={20} aria-hidden="true" /> Back
      </button>
      <img src={logoMark} alt="root’d" className="result-logo" />
      <button type="button" className="text-btn share" onClick={onShare} disabled={!onShare}>
        <Share2 size={18} aria-hidden="true" /> Share
      </button>
    </header>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <LoaderCircle size={22} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function Splash({ message }: { message?: string }) {
  return (
    <div className="splash">
      <img src={logoMark} alt="root’d" />
      <Spinner />
      {message && <p>{message}</p>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
}: {
  title?: string
  message: string
  onRetry?: () => void
  action?: ReactNode
}) {
  return (
    <div className="error-state" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="error-actions">
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
        )}
        {action}
      </div>
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
