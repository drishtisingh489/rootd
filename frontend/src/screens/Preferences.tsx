/* B1 hub (exactly three category cards) and B2–B5 category detail screens with multi-select boxes. */
import { Check, ChevronRight, HeartHandshake, Leaf, Plus, Wheat, type LucideIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../api'
import { BackButton, Notice, Spinner } from '../components/Chrome'
import { catalog, categoryCount, OTHER_PREFIX, optionLabel, totalSelected, type CatalogGroup } from '../lib/catalog'
import { usePreferencesDraft } from '../state/PreferencesDraft'

const ICONS: Record<string, LucideIcon> = { wheat: Wheat, 'heart-handshake': HeartHandshake, leaf: Leaf }

export function PreferencesHub() {
  const { mode, draft, dirty, save } = usePreferencesDraft()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onboarding = mode === 'onboarding'

  async function onSave() {
    setSaving(true)
    setError(null)
    try {
      await save()
      if (onboarding) navigate('/home', { replace: true })
      else navigate('/profile', { replace: true, state: { flash: 'Preferences saved.' } })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  function onBack() {
    if (dirty && !window.confirm('Leave without saving your preference changes?')) return
    navigate('/profile')
  }

  return (
    <main className="screen with-footer">
      <header className="page-header">
        {onboarding ? (
          <BackButton to="/" label="Back to start" />
        ) : (
          <BackButton onClick={onBack} label="Back to profile" />
        )}
        <h1>{onboarding ? 'Your Preferences' : 'Feed Preferences'}</h1>
        <span />
      </header>

      <h2 className="hub-title">{onboarding ? 'What matters to you?' : 'Edit what matters to you'}</h2>
      <p className="lede">
        Pick as many or as few as you like in each category. root’d uses them to personalize every scan
        {onboarding ? ', and you can change them anytime from your profile.' : '.'}
      </p>

      <ul className="category-list">
        {catalog.categories.map((cat) => {
          const Icon = ICONS[cat.icon] ?? Leaf
          const count = categoryCount(cat, draft)
          return (
            <li key={cat.id}>
              <Link to={cat.id} className={`category-card${count ? ' has-selection' : ''}`}>
                <span className="category-icon">
                  <Icon size={26} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="category-text">
                  <span className="category-title">{cat.title}</span>
                  <span className="category-hint">{cat.hint}</span>
                  {count > 0 ? (
                    <span className="category-count">
                      <Check size={14} strokeWidth={3} aria-hidden="true" /> {count} selected
                    </span>
                  ) : (
                    <span className="category-count none">Nothing selected yet</span>
                  )}
                </span>
                <ChevronRight size={22} className="chevron" aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="sticky-footer">
        {onboarding && totalSelected(draft) === 0 && (
          <p className="footer-hint">Nothing is required, but root’d can only personalize results for what you choose.</p>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={onSave} disabled={saving}>
          {saving && <Spinner label="Saving" />}
          {onboarding ? 'Save Preferences & Start Scanning' : 'Save Preferences'}
        </button>
      </div>
    </main>
  )
}

export function PreferenceCategory() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const category = catalog.categories.find((c) => c.id === categoryId)
  if (!category) return <Navigate to=".." replace />
  const back = () => navigate('..')

  return (
    <main className="screen with-footer">
      <header className="page-header">
        <BackButton onClick={back} label="Back to preferences" />
        <h1>{category.title}</h1>
        <span />
      </header>
      <p className="lede">Tap every option that applies. Tap again to remove it. Your choices are kept as you move between screens.</p>
      {category.groups.map((group) => (
        <GroupSection key={group.id} group={group} />
      ))}
      <div className="sticky-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={back}>
          Done
        </button>
      </div>
    </main>
  )
}

function OptionBox({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`option-box${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onToggle}>
      <span className="option-check" aria-hidden="true">
        {selected && <Check size={14} strokeWidth={3.2} />}
      </span>
      <span className="option-label">{label}</span>
    </button>
  )
}

function GroupSection({ group }: { group: CatalogGroup }) {
  const { draft, toggle, addOther, setLevel, setCrossContact } = usePreferencesDraft()
  const headingId = useId()
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [otherError, setOtherError] = useState<string | null>(null)
  const selected = draft[group.id]
  const customs = selected.filter((v) => v.startsWith(OTHER_PREFIX))
  const levels = group.level_type ? catalog.levels[group.level_type] : null
  const levelItems = selected.filter((v) => v !== 'prefer_not_to_say')

  function submitOther(e: FormEvent) {
    e.preventDefault()
    const err = addOther(group.id, otherText)
    setOtherError(err)
    if (!err) {
      setOtherText('')
      setOtherOpen(false)
    }
  }

  return (
    <section className="pref-group" aria-labelledby={headingId}>
      <h2 id={headingId} className="group-title">
        {group.title}
        {selected.length > 0 && <span className="group-count">{selected.length} selected</span>}
      </h2>
      {group.note && <p className="group-note">{group.note}</p>}
      <div className="option-grid" role="group" aria-labelledby={headingId}>
        {group.options.map((opt) => (
          <OptionBox
            key={opt.id}
            label={opt.label}
            selected={selected.includes(opt.id)}
            onToggle={() => toggle(group.id, opt.id, opt.exclusive)}
          />
        ))}
        {customs.map((id) => (
          <OptionBox key={id} label={id.slice(OTHER_PREFIX.length)} selected onToggle={() => toggle(group.id, id)} />
        ))}
        {group.allow_other && (
          <button
            type="button"
            className="option-box option-other"
            aria-expanded={otherOpen}
            onClick={() => setOtherOpen((o) => !o)}
          >
            <span className="option-check" aria-hidden="true">
              <Plus size={14} strokeWidth={3} />
            </span>
            <span className="option-label">Other / Add your own</span>
          </button>
        )}
      </div>

      {otherOpen && (
        <form className="other-form" onSubmit={submitOther}>
          <input
            className="input"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Type your own…"
            maxLength={60}
            autoFocus
            aria-label={`Add your own: ${group.title}`}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Add
          </button>
          {otherError && <p className="field-error">{otherError}</p>}
        </form>
      )}

      {group.toggle && (
        <label className="switch-row">
          <input
            type="checkbox"
            role="switch"
            checked={draft.allergy_cross_contact}
            onChange={(e) => setCrossContact(e.target.checked)}
          />
          <span className="switch" aria-hidden="true" />
          <span>{group.toggle.label}</span>
        </label>
      )}

      {levels && levelItems.length > 0 && (
        <div className="level-list">
          <p className="level-title">
            {group.level_type === 'strictness' ? 'Is each one strict, or a preference?' : 'How important is each one?'}
          </p>
          {levelItems.map((id) => {
            const current = draft.levels[`${group.id}:${id}`] ?? levels[0].id
            const label = optionLabel(group.id, id)
            return (
              <div className="level-row" key={id}>
                <span className="level-name">{label}</span>
                <div className="segmented" role="radiogroup" aria-label={`${label}: level`}>
                  {levels.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={current === l.id}
                      className={current === l.id ? 'on' : ''}
                      onClick={() => setLevel(group.id, id, l.id)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
