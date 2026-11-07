/*
 * D: Camera / scan and confirm. Both the Home "Scan Ingredient" card and the raised toolbar button open this screen.
 * Flow: live camera (or upload) → barcode (if the browser can read one) → OpenRouter vision identification
 * → "We found: … Is this correct?" → Confirm starts the analysis and opens Results.
 */
import { Barcode, Camera as CameraIcon, ImagePlus, Keyboard, ScanLine, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, errorMessage, useApi } from '../api'
import { Notice, Spinner } from '../components/Chrome'
import { DemoTag, ProductThumb } from '../components/Product'
import { Sheet } from '../components/Sheet'
import { productTitle } from '../lib/format'
import { captureVideoFrame, detectBarcode, prepareFile, type PreparedPhoto } from '../lib/image'
import { useScanSession } from '../state/ScanSession'
import type { AnalyzeRequest, Candidate, DemoProduct, Identification, ProductMatch } from '../types'

type Phase = 'camera' | 'identifying' | 'confirm' | 'manual'

type Selection =
  | { kind: 'record'; match: ProductMatch }
  | {
      kind: 'typed'
      name: string
      brand: string
      barcode: string | null
      package_size: string | null
      variant: string | null
    }
  | { kind: 'demo'; demo: DemoProduct }

type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error'

function useCamera(videoRef: RefObject<HTMLVideoElement | null>, active: boolean) {
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      setMessage(
        window.isSecureContext
          ? 'This browser can’t open the camera. Upload a photo instead.'
          : 'Camera access needs a secure (https or localhost) connection. Upload a photo instead.',
      )
      return
    }
    let cancelled = false
    let stream: MediaStream | null = null
    setStatus('starting')
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        if (video) {
          video.srcObject = s
          void video.play().catch(() => undefined)
        }
        setStatus('live')
      })
      .catch((err: DOMException) => {
        if (cancelled) return
        if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setStatus('denied')
          setMessage('Camera permission was denied. Upload a photo instead, or allow camera access in your browser settings.')
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setStatus('unavailable')
          setMessage('No camera was found on this device. Upload a photo instead.')
        } else {
          setStatus('error')
          setMessage('The camera couldn’t start. Upload a photo instead.')
        }
      })
    const video = videoRef.current
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      if (video) video.srcObject = null
    }
  }, [active, attempt, videoRef])

  return { status, message, retry: () => setAttempt((n) => n + 1) }
}

const words = (s: string | null | undefined) =>
  new Set((s ?? '').toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])

/** Conservative check that a product record plausibly matches what the photo shows. */
function similar(c: Candidate, m: ProductMatch): boolean {
  if (c.barcode && m.barcode && c.barcode === m.barcode) return true
  const cBrand = c.brand.toLowerCase().trim()
  const mBrand = m.brand.toLowerCase().trim()
  const brandOk = Boolean(cBrand && mBrand && (cBrand.includes(mBrand) || mBrand.includes(cBrand)))
  const cw = words(`${c.name} ${c.variant ?? ''}`)
  const overlap = [...words(m.name)].filter((w) => cw.has(w)).length
  return (brandOk && overlap >= 1) || overlap >= 2
}

function fromCandidate(c: Candidate, barcode: string | null): Selection {
  return {
    kind: 'typed',
    name: c.name,
    brand: c.brand,
    barcode: c.barcode ?? barcode,
    package_size: c.package_size,
    variant: c.variant,
  }
}

function selectionTitle(s: Selection): string {
  if (s.kind === 'record') return productTitle(s.match)
  if (s.kind === 'demo') return productTitle(s.demo)
  return productTitle(s)
}

export function Camera() {
  const navigate = useNavigate()
  const api = useApi()
  const session = useScanSession()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const runId = useRef(0)

  const [phase, setPhase] = useState<Phase>('camera')
  const camera = useCamera(videoRef, phase === 'camera')
  const [preview, setPreview] = useState<string | null>(null)
  const [ident, setIdent] = useState<Identification | null>(null)
  const [matches, setMatches] = useState<ProductMatch[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [barcodeRead, setBarcodeRead] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn' | 'error'; text: string } | null>(null)
  const [step, setStep] = useState('Scanning…')

  function close() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/home')
  }

  function reset() {
    runId.current += 1
    setPreview(null)
    setIdent(null)
    setMatches([])
    setSelection(null)
    setBarcodeRead(null)
    setNotice(null)
    setPhase('camera')
  }

  async function identifyPhoto(photo: PreparedPhoto) {
    const run = ++runId.current
    const current = () => run === runId.current
    setPreview(photo.dataUrl)
    setIdent(null)
    setMatches([])
    setSelection(null)
    setNotice(null)
    setBarcodeRead(null)
    setPhase('identifying')

    // 1) Prefer a barcode when the browser can read one from the photo.
    setStep('Looking for a barcode…')
    const code = await detectBarcode(photo.blob)
    if (!current()) return
    if (code) {
      setBarcodeRead(code)
      setStep('Looking up the barcode…')
      try {
        const found = await api.lookup({ barcode: code })
        if (!current()) return
        if (found.matches.length) {
          setMatches(found.matches)
          setSelection({ kind: 'record', match: found.matches[0] })
          setPhase('confirm')
          return
        }
      } catch {
        /* fall back to photo identification */
      }
    }

    // 2) Vision identification on the server (OpenRouter). The result is only a candidate until confirmed.
    setStep('Reading the package…')
    try {
      const res = await api.identify(photo.blob)
      if (!current()) return
      const id = res.identification
      setIdent(id)
      setMatches(res.matches)
      const top = id.candidates[0]
      if (!id.is_food_product || !top) {
        setNotice({
          tone: 'warn',
          text: id.is_food_product
            ? 'We couldn’t read a product name from this photo. Try again closer to the front label, or enter it yourself.'
            : 'This doesn’t look like a packaged food product. Try again, or enter the product yourself.',
        })
        setSelection(null)
      } else {
        const best = res.matches.find((m) => similar(top, m))
        setSelection(best ? { kind: 'record', match: best } : fromCandidate(top, code))
      }
      setPhase('confirm')
    } catch (err) {
      if (!current()) return
      if (err instanceof ApiError && err.code === 'vision_unavailable') setNotice({ tone: 'info', text: err.message })
      else setNotice({ tone: 'error', text: `Photo identification didn’t work: ${errorMessage(err)}` })
      setPhase('manual')
    }
  }

  async function onTrigger() {
    if (phase !== 'camera') return
    if (camera.status !== 'live' || !videoRef.current) {
      fileRef.current?.click()
      return
    }
    try {
      await identifyPhoto(await captureVideoFrame(videoRef.current))
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', text: 'Please choose a photo (JPG, PNG or WEBP).' })
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setNotice({ tone: 'error', text: 'That photo is too large (max 20 MB).' })
      return
    }
    try {
      await identifyPhoto(await prepareFile(file))
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
      setPhase('camera')
    }
  }

  function confirm() {
    if (!selection) return
    const visible = preview ? ident?.visible_ingredients ?? null : null
    let request: AnalyzeRequest
    if (selection.kind === 'demo') {
      request = { demo_fixture_id: selection.demo.id }
      session.startAnalysis(
        request,
        { name: selection.demo.name, brand: selection.demo.brand, package_size: selection.demo.package_size, is_demo: true },
        null,
      )
    } else if (selection.kind === 'record') {
      const m = selection.match
      request = {
        name: m.name,
        brand: m.brand,
        barcode: m.barcode,
        package_size: m.package_size,
        variant: ident?.candidates[0]?.variant ?? null,
        visible_ingredients: visible,
      }
      session.startAnalysis(request, { name: m.name, brand: m.brand, package_size: m.package_size, image_url: m.image_url }, preview)
    } else {
      request = {
        name: selection.name,
        brand: selection.brand,
        barcode: selection.barcode,
        package_size: selection.package_size,
        variant: selection.variant,
        visible_ingredients: visible,
      }
      session.startAnalysis(request, { name: selection.name, brand: selection.brand, package_size: selection.package_size }, preview)
    }
    navigate('/results/analyzing')
  }

  const scanning = phase === 'identifying'
  const showVideo = phase === 'camera'
  const cameraBlocked = ['denied', 'unavailable', 'error'].includes(camera.status)

  return (
    <main className="camera-screen">
      <header className="camera-header">
        <button type="button" className="icon-btn plain" onClick={close} aria-label="Close scanner">
          <X size={26} aria-hidden="true" />
        </button>
        <span className="camera-title">Scan a product</span>
        <span className="icon-btn-spacer" />
      </header>

      <div className={`scan-frame${scanning ? ' scanning' : ''}`}>
        <span className="corner tl" aria-hidden="true" />
        <span className="corner tr" aria-hidden="true" />
        <span className="corner bl" aria-hidden="true" />
        <span className="corner br" aria-hidden="true" />
        <div className="scan-view">
          {showVideo ? (
            <>
              <video ref={videoRef} playsInline muted autoPlay aria-label="Live camera preview" />
              {camera.status !== 'live' && (
                <div className="scan-placeholder">
                  {camera.status === 'starting' || camera.status === 'idle' ? (
                    <>
                      <Spinner label="Starting camera" />
                      <p>Starting camera…</p>
                    </>
                  ) : (
                    <>
                      <CameraIcon size={34} aria-hidden="true" />
                      <p>{camera.message}</p>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
                        <ImagePlus size={16} aria-hidden="true" /> Upload a photo
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : preview ? (
            <img src={preview} alt="Your product photo" />
          ) : (
            <div className="scan-placeholder">
              <Keyboard size={34} aria-hidden="true" />
              <p>Find your product by barcode or name.</p>
            </div>
          )}
          {(camera.status === 'live' && showVideo) || scanning ? <span className="scan-line" aria-hidden="true" /> : null}
        </div>
        <button
          type="button"
          className="scan-trigger"
          onClick={onTrigger}
          disabled={phase !== 'camera'}
          aria-label={camera.status === 'live' ? 'Take photo and scan' : 'Choose a photo to scan'}
        >
          {scanning ? <Spinner label="Scanning" /> : <ScanLine size={28} strokeWidth={2.2} aria-hidden="true" />}
        </button>
      </div>

      <p className="scan-status" aria-live="polite">
        {scanning
          ? step
          : phase === 'camera'
            ? camera.status === 'live'
              ? 'Center the front of the package in the frame'
              : cameraBlocked
                ? 'Camera unavailable — upload a photo instead'
                : ' '
            : ' '}
      </p>

      {notice && phase === 'camera' && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <div className="camera-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={scanning}>
          <ImagePlus size={18} aria-hidden="true" /> Upload photo
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            runId.current += 1
            setPhase('manual')
          }}
          disabled={scanning}
        >
          <Barcode size={18} aria-hidden="true" /> Barcode or name
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <section className="next-steps" aria-labelledby="next-steps-title">
        <h2 id="next-steps-title">Next Steps</h2>
        <ul>
          <li>Allow camera access when your browser asks, or upload a photo instead</li>
          <li>Place the product’s front label or barcode in the center of the frame</li>
          <li>root’d identifies it, you confirm, and we check it against your values</li>
        </ul>
      </section>

      <ConfirmSheet
        open={phase === 'confirm'}
        selection={selection}
        ident={ident}
        matches={matches}
        barcodeRead={barcodeRead}
        preview={preview}
        notice={notice}
        onSelect={setSelection}
        onConfirm={confirm}
        onEdit={() => setPhase('manual')}
        onRetake={reset}
      />
      <ManualSheet
        open={phase === 'manual'}
        notice={notice}
        initial={selection ?? (ident?.candidates[0] ? fromCandidate(ident.candidates[0], barcodeRead) : null)}
        onChoose={(s) => {
          setSelection(s)
          setNotice(null)
          setPhase('confirm')
        }}
        onRetake={reset}
      />
    </main>
  )
}

function ConfirmSheet({
  open,
  selection,
  ident,
  matches,
  barcodeRead,
  preview,
  notice,
  onSelect,
  onConfirm,
  onEdit,
  onRetake,
}: {
  open: boolean
  selection: Selection | null
  ident: Identification | null
  matches: ProductMatch[]
  barcodeRead: string | null
  preview: string | null
  notice: { tone: 'info' | 'warn' | 'error'; text: string } | null
  onSelect: (s: Selection) => void
  onConfirm: () => void
  onEdit: () => void
  onRetake: () => void
}) {
  const top = ident?.candidates[0]
  const uncertain = Boolean(top && (top.confidence < 0.6 || ident?.ambiguity_notes))
  const alternatives = selection?.kind === 'demo' ? [] : matches

  return (
    <Sheet
      open={open}
      title={selection ? 'Is this your product?' : 'We couldn’t identify it'}
      onClose={onRetake}
      footer={
        selection ? (
          <div className="sheet-actions">
            <button type="button" className="btn btn-outline" onClick={onEdit}>
              Edit / Try Again
            </button>
            <button type="button" className="btn btn-primary" onClick={onConfirm}>
              Confirm
            </button>
          </div>
        ) : (
          <div className="sheet-actions">
            <button type="button" className="btn btn-outline" onClick={onRetake}>
              Try Again
            </button>
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              Enter details
            </button>
          </div>
        )
      }
    >
      {!selection ? (
        notice && <Notice tone={notice.tone}>{notice.text}</Notice>
      ) : (
        <>
          <p className="found-line">
            We found: <strong>{selectionTitle(selection)}</strong>. Is this correct?
          </p>
          <div className="found-card">
            <ProductThumb
              src={selection.kind === 'record' ? selection.match.image_url ?? preview : selection.kind === 'typed' ? preview : null}
              size={72}
              alt=""
            />
            <div>
              {selection.kind === 'record' && (
                <>
                  <p className="product-brand">{selection.match.brand || 'Brand not recorded'}</p>
                  <p className="product-name">{selection.match.name || 'Unnamed product'}</p>
                  <p className="product-meta">
                    {[selection.match.package_size, selection.match.barcode && `Barcode ${selection.match.barcode}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="found-source">Matched to an Open Food Facts product record</p>
                </>
              )}
              {selection.kind === 'typed' && (
                <>
                  <p className="product-brand">{selection.brand || 'Brand unknown'}</p>
                  <p className="product-name">{selection.name || 'Name unknown'}</p>
                  <p className="product-meta">
                    {[selection.variant, selection.package_size, selection.barcode && `Barcode ${selection.barcode}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="found-source">
                    {top ? 'Read from your photo — not matched to a product record yet' : 'Entered by you'}
                  </p>
                </>
              )}
              {selection.kind === 'demo' && (
                <>
                  <p className="product-brand">{selection.demo.brand}</p>
                  <p className="product-name">{selection.demo.name}</p>
                  <p className="product-meta">{selection.demo.package_size}</p>
                  <DemoTag />
                  <p className="found-source">Fictional demo product — not a real assessment</p>
                </>
              )}
            </div>
          </div>
          {barcodeRead && <p className="hint-line">Barcode {barcodeRead} was read from your photo.</p>}
          {uncertain && (
            <Notice tone="warn">
              The photo was a little unclear{top ? ` (confidence ${Math.round(top.confidence * 100)}%)` : ''}.
              {ident?.ambiguity_notes ? ` ${ident.ambiguity_notes}` : ''} Please check the brand, variant and size.
            </Notice>
          )}
          {alternatives.length > 0 && (
            <fieldset className="alt-list">
              <legend>{selection.kind === 'record' ? 'Other possible matches' : 'Possible product records'}</legend>
              {alternatives.map((m, i) => {
                const checked = selection.kind === 'record' && selection.match === m
                return (
                  <label key={`${m.barcode}-${i}`} className={`alt-item${checked ? ' on' : ''}`}>
                    <input type="radio" name="match" checked={checked} onChange={() => onSelect({ kind: 'record', match: m })} />
                    <ProductThumb src={m.image_url} size={40} />
                    <span>
                      <span className="alt-name">{productTitle(m)}</span>
                      <span className="alt-meta">{[m.package_size, m.barcode].filter(Boolean).join(' · ')}</span>
                    </span>
                  </label>
                )
              })}
              {top && (
                <label className={`alt-item${selection.kind === 'typed' ? ' on' : ''}`}>
                  <input
                    type="radio"
                    name="match"
                    checked={selection.kind === 'typed'}
                    onChange={() => onSelect(fromCandidate(top, barcodeRead))}
                  />
                  <span className="alt-none">None of these — use what’s printed on my package</span>
                </label>
              )}
            </fieldset>
          )}
          {ident && ident.cannot_determine.length > 0 && (
            <details className="cannot">
              <summary>What the photo can’t tell us</summary>
              <ul>
                {ident.cannot_determine.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Sheet>
  )
}

function ManualSheet({
  open,
  notice,
  initial,
  onChoose,
  onRetake,
}: {
  open: boolean
  notice: { tone: 'info' | 'warn' | 'error'; text: string } | null
  initial: Selection | null
  onChoose: (s: Selection) => void
  onRetake: () => void
}) {
  const api = useApi()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductMatch[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', brand: '', package_size: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [demos, setDemos] = useState<DemoProduct[]>([])

  useEffect(() => {
    if (!open) return
    const seed =
      initial?.kind === 'typed'
        ? { name: initial.name, brand: initial.brand, package_size: initial.package_size ?? '' }
        : initial?.kind === 'record'
          ? { name: initial.match.name, brand: initial.match.brand, package_size: initial.match.package_size ?? '' }
          : { name: '', brand: '', package_size: '' }
    setForm(seed)
    setFormError(null)
    setSearchError(null)
    setResults(null)
    setQuery(initial?.kind === 'record' && initial.match.barcode ? initial.match.barcode : '')
    let alive = true
    api.demoProducts().then(
      (r) => alive && setDemos(r.products),
      () => undefined,
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function search(e: FormEvent) {
    e.preventDefault()
    const value = query.trim()
    if (!value) {
      setSearchError('Enter a barcode number or a product name.')
      return
    }
    const digits = value.replace(/[\s-]/g, '')
    const isBarcode = /^\d+$/.test(digits)
    if (isBarcode && (digits.length < 8 || digits.length > 14)) {
      setSearchError('A barcode should be 8–14 digits.')
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const r = await api.lookup(isBarcode ? { barcode: digits } : { q: value })
      setResults(r.matches)
    } catch (err) {
      setSearchError(errorMessage(err))
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  function submitTyped(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() && !form.brand.trim()) {
      setFormError('Enter at least a product name or brand.')
      return
    }
    onChoose({
      kind: 'typed',
      name: form.name.trim(),
      brand: form.brand.trim(),
      barcode: initial?.kind === 'typed' ? initial.barcode : null,
      package_size: form.package_size.trim() || null,
      variant: initial?.kind === 'typed' ? initial.variant : null,
    })
  }

  return (
    <Sheet
      open={open}
      title="Find your product"
      onClose={onRetake}
      footer={
        <button type="button" className="btn btn-outline btn-block" onClick={onRetake}>
          <CameraIcon size={18} aria-hidden="true" /> Retake photo
        </button>
      }
    >
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <form className="manual-search" onSubmit={search}>
        <label className="field-label" htmlFor="manual-query">
          Barcode number or product name
        </label>
        <div className="inline-form">
          <input
            id="manual-query"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 3017620422003 or oat milk"
            maxLength={120}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={searching} aria-label="Search">
            {searching ? <Spinner label="Searching" /> : <Search size={18} aria-hidden="true" />}
          </button>
        </div>
        {searchError && <p className="field-error">{searchError}</p>}
      </form>
      {results && (
        <div className="manual-results">
          {results.length === 0 ? (
            <p className="hint-line">No product records found. You can enter the details below instead.</p>
          ) : (
            results.map((m, i) => (
              <button
                key={`${m.barcode}-${i}`}
                type="button"
                className="alt-item"
                onClick={() => onChoose({ kind: 'record', match: m })}
              >
                <ProductThumb src={m.image_url} size={40} />
                <span>
                  <span className="alt-name">{productTitle(m)}</span>
                  <span className="alt-meta">{[m.package_size, m.barcode].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))
          )}
          <p className="hint-line">Product records come from Open Food Facts (crowdsourced).</p>
        </div>
      )}

      <form className="manual-form" onSubmit={submitTyped}>
        <h3>Or enter what’s on the package</h3>
        <input
          className="input"
          placeholder="Product name"
          value={form.name}
          maxLength={120}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-label="Product name"
        />
        <input
          className="input"
          placeholder="Brand"
          value={form.brand}
          maxLength={80}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
          aria-label="Brand"
        />
        <input
          className="input"
          placeholder="Package size (optional)"
          value={form.package_size}
          maxLength={40}
          onChange={(e) => setForm({ ...form, package_size: e.target.value })}
          aria-label="Package size"
        />
        {formError && <p className="field-error">{formError}</p>}
        <button type="submit" className="btn btn-secondary btn-block">
          Use these details
        </button>
      </form>

      {demos.length > 0 && (
        <div className="demo-list">
          <h3>
            Try a demo product <DemoTag />
          </h3>
          <p className="hint-line">Fictional products for trying the flow without a camera. Not real assessments.</p>
          {demos.map((d) => (
            <button key={d.id} type="button" className="alt-item" onClick={() => onChoose({ kind: 'demo', demo: d })}>
              <ProductThumb size={40} />
              <span>
                <span className="alt-name">{d.name}</span>
                <span className="alt-meta">
                  {d.brand} · {d.package_size}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
