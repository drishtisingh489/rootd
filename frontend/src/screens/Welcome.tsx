import { useNavigate } from 'react-router-dom'
import logo from '../../../assets/rootd-logo.png'
// Same supplied logo, re-encoded at display resolution (19 KB instead of 1.5 MB); the original PNG is the fallback.
import logoWebp from '../assets/rootd-logo-welcome.webp'
import { CarrotScene } from '../components/CarrotScene'

/**
 * Landing screen: the supplied logo, the exact slogan, one Continue button, carrot-in-soil at the bottom.
 * Continue opens Home; first-time visitors are redirected to the Preferences hub until onboarding is saved.
 */
export function Welcome() {
  const navigate = useNavigate()
  return (
    <main className="welcome">
      <div className="welcome-brand">
        <picture>
          <source srcSet={logoWebp} type="image/webp" />
          <img src={logo} alt="root’d" className="welcome-logo" width={1536} height={1024} />
        </picture>
        <p className="slogan">Food root’d in both your values and the ground</p>
      </div>
      <div className="welcome-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => navigate('/home')}>
          Continue
        </button>
      </div>
      <CarrotScene />
    </main>
  )
}
