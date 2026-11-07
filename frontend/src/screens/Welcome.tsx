import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../../../assets/rootd-logo.png'
// Same supplied logo, re-encoded at display resolution (19 KB instead of 1.5 MB); the original PNG is the fallback.
import logoWebp from '../assets/rootd-logo-welcome.webp'
import { CarrotScene } from '../components/CarrotScene'
import { NAME_MAX, rememberName, savedName, validateName } from '../lib/displayName'

/**
 * Landing screen: the supplied logo, the slogan, one name field, Continue, and carrot-in-soil at the bottom.
 * Continue opens Home; first-time visitors are redirected to the Preferences hub until onboarding is saved.
 */
export function Welcome() {
  const navigate = useNavigate()
  const [name, setName] = useState(savedName) // returning users see their saved name and can just tap Continue
  const [touched, setTouched] = useState(false)
  const error = validateName(name)
  // Show "too long" right away; show "please enter a name" only once the field has been left or submitted.
  const showError = Boolean(error) && (touched || name.trim().length > NAME_MAX)

  function onChange(value: string) {
    setName(value)
    if (validateName(value) === null) rememberName(value) // saved locally immediately
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error) return
    rememberName(name, true) // ProfileProvider saves it as display_name once the profile loads
    navigate('/home')
  }

  return (
    <main className="welcome">
      <div className="welcome-brand">
        <picture>
          <source srcSet={logoWebp} type="image/webp" />
          <img src={logo} alt="root’d" className="welcome-logo" width={1536} height={1024} />
        </picture>
        <p className="slogan">Food Root’d in Both Your Values and the Ground</p>
      </div>
      <form className="welcome-actions" onSubmit={onSubmit} noValidate>
        <label htmlFor="welcome-name" className="sr-only">
          What should we call you?
        </label>
        <input
          id="welcome-name"
          className={`input welcome-name${showError ? ' invalid' : ''}`}
          placeholder="What should we call you?"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={60}
          aria-invalid={showError}
          aria-describedby={showError ? 'welcome-name-error' : undefined}
        />
        {showError && (
          <p className="field-error" id="welcome-name-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={Boolean(error)}>
          Continue
        </button>
      </form>
      <CarrotScene />
    </main>
  )
}
