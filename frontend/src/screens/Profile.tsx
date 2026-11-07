/* C3 Profile (from the Home avatar) and Edit Profile. No Subscription anywhere. */
import { Camera, ChevronRight, Clock, Info, Mail, SlidersHorizontal, Trash, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage, useApi } from '../api'
import { Avatar } from '../components/Avatar'
import { Notice, PageHeader, Spinner } from '../components/Chrome'
import { Sheet } from '../components/Sheet'
import { totalSelected } from '../lib/catalog'
import { validateName } from '../lib/displayName'
import { avatarDataUrl } from '../lib/image'
import { useLoadedProfile, useProfile } from '../state/ProfileContext'
import { useScanSession } from '../state/ScanSession'

export function Profile() {
  const profile = useLoadedProfile()
  const api = useApi()
  const { invalidate } = useScanSession()
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>((location.state as { flash?: string } | null)?.flash ?? null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const selected = totalSelected(profile.preferences)

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(t)
  }, [flash])

  async function clearHistory() {
    setClearing(true)
    setClearError(null)
    try {
      const { deleted } = await api.clearScans()
      invalidate()
      setConfirmClear(false)
      setFlash(deleted ? `Deleted ${deleted} scan${deleted === 1 ? '' : 's'}.` : 'Your scan history was already empty.')
    } catch (err) {
      setClearError(errorMessage(err))
    } finally {
      setClearing(false)
    }
  }

  return (
    <main className="screen profile">
      <PageHeader title="Profile" back="/home" />
      {flash && <Notice tone="success">{flash}</Notice>}

      <section className="profile-card">
        <Avatar name={profile.display_name} email={profile.email} src={profile.profile_image_url} size={104} />
        <h2 className="profile-name">{profile.display_name || 'Add your name'}</h2>
        {profile.email && <p className="profile-email">{profile.email}</p>}
        <Link to="/profile/edit" className="btn btn-emerald btn-sm">
          Edit Profile
        </Link>
      </section>

      <nav className="menu-list" aria-label="Profile menu">
        <Link to="/profile/preferences" className="menu-row">
          <span className="menu-icon">
            <SlidersHorizontal size={20} aria-hidden="true" />
          </span>
          <span className="menu-text">
            <span className="menu-title">Feed Preferences</span>
            <span className="menu-sub">
              Allergies & diets, ethical values, environmental priorities · {selected} selected
            </span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
        <Link to="/history" className="menu-row">
          <span className="menu-icon">
            <Clock size={20} aria-hidden="true" />
          </span>
          <span className="menu-text">
            <span className="menu-title">Scan History</span>
            <span className="menu-sub">Every product you’ve scanned</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
        <button type="button" className="menu-row" onClick={() => setConfirmClear(true)}>
          <span className="menu-icon">
            <Trash size={20} aria-hidden="true" />
          </span>
          <span className="menu-text">
            <span className="menu-title">Clear Scan History</span>
            <span className="menu-sub">Permanently delete your saved scans</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </nav>

      <p className="profile-footnote">
        <Info size={14} aria-hidden="true" /> Your profile is tied to this browser. Photos you scan are analyzed and
        discarded; root’d stores the product details, your result and its sources.
      </p>

      <Sheet
        open={confirmClear}
        title="Clear scan history?"
        onClose={() => setConfirmClear(false)}
        footer={
          <div className="sheet-actions">
            <button type="button" className="btn btn-outline" onClick={() => setConfirmClear(false)} disabled={clearing}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={clearHistory} disabled={clearing}>
              {clearing && <Spinner label="Deleting" />} Delete all scans
            </button>
          </div>
        }
      >
        <p>This permanently deletes all of your saved scans and their evidence. Your milestones will reset. This can’t be undone.</p>
        {clearError && <Notice tone="error">{clearError}</Notice>}
      </Sheet>
    </main>
  )
}

const PHONE_RE = /^\+?[\d\s().-]{6,32}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function EditProfile() {
  const profile = useLoadedProfile()
  const { save } = useProfile()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.display_name)
  const [email, setEmail] = useState(profile.email)
  const [phone, setPhone] = useState(profile.phone)
  const [photo, setPhoto] = useState(profile.profile_image_url)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((e) => ({ ...e, photo: 'Choose an image file.' }))
      return
    }
    try {
      setPhoto(await avatarDataUrl(file))
      setErrors(({ photo: _ignored, ...rest }) => rest)
    } catch (err) {
      setErrors((e) => ({ ...e, photo: errorMessage(err) }))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    const nameError = validateName(name)
    if (nameError) next.name = nameError
    if (phone.trim() && !PHONE_RE.test(phone.trim())) next.phone = 'Use digits, spaces, +, -, ( and ) only.'
    if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address, or leave it blank.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    setError(null)
    try {
      await save({
        display_name: name.trim(),
        phone: phone.trim(),
        profile_image_url: photo,
        email: email.trim(),
      })
      navigate('/profile', { replace: true, state: { flash: 'Profile saved.' } })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <main className="screen with-footer">
      <PageHeader title="Edit Profile" back="/profile" />
      <form id="edit-profile" onSubmit={onSubmit} noValidate className="edit-form">
        <div className="photo-edit">
          <Avatar name={name} email={email} src={photo} size={112} />
          <div className="photo-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
              <Camera size={16} aria-hidden="true" /> {photo ? 'Change photo' : 'Add photo'}
            </button>
            {photo && (
              <button type="button" className="link-btn muted" onClick={() => setPhoto('')}>
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {errors.photo && <p className="field-error">{errors.photo}</p>}
        </div>

        <label className="field-label" htmlFor="ep-name">
          Display name
        </label>
        <div className="field">
          <span className="field-icon">
            <UserRound size={18} aria-hidden="true" />
          </span>
          <input
            id="ep-name"
            className={`input with-icon${errors.name ? ' invalid' : ''}`}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>
        {errors.name && <p className="field-error">{errors.name}</p>}

        <label className="field-label" htmlFor="ep-email">
          Email address <span className="muted">(optional)</span>
        </label>
        <div className="field">
          <span className="field-icon">
            <Mail size={18} aria-hidden="true" />
          </span>
          <input
            id="ep-email"
            className={`input with-icon${errors.email ? ' invalid' : ''}`}
            type="email"
            inputMode="email"
            value={email}
            maxLength={254}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        {errors.email && <p className="field-error">{errors.email}</p>}

        <label className="field-label" htmlFor="ep-phone">
          Phone number <span className="muted">(optional)</span>
        </label>
        <input
          id="ep-phone"
          className={`input${errors.phone ? ' invalid' : ''}`}
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={32}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 123 4567"
          autoComplete="tel"
        />
        {errors.phone && <p className="field-error">{errors.phone}</p>}
        <p className="field-note">Email and phone are saved to your root’d profile only.</p>

        {error && <Notice tone="error">{error}</Notice>}
      </form>
      <div className="sticky-footer">
        <button type="submit" form="edit-profile" className="btn btn-primary btn-block" disabled={saving}>
          {saving && <Spinner label="Saving" />} Save changes
        </button>
      </div>
    </main>
  )
}
