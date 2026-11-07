/* Route layouts: load the anonymous profile, show onboarding exactly once, then go straight to the app. */
import { Navigate, Outlet } from 'react-router-dom'
import { ErrorState, Splash } from '../components/Chrome'
import { PreferencesDraftProvider, type PrefsMode } from '../state/PreferencesDraft'
import { ProfileProvider, useProfile } from '../state/ProfileContext'
import { ScanSessionProvider } from '../state/ScanSession'

/** Everything after the landing screen: loads this browser's profile (GET /api/me creates it on first visit). */
export function AppData() {
  return (
    <ProfileProvider>
      <ScanSessionProvider>
        <ProfileGate />
      </ScanSessionProvider>
    </ProfileProvider>
  )
}

function ProfileGate() {
  const { profile, loading, error, reload } = useProfile()
  if (loading && !profile) return <Splash message="Loading your profile…" />
  if (error && !profile) {
    return (
      <main className="screen center">
        <ErrorState title="We couldn’t load your profile" message={error.message} onRetry={reload} />
      </main>
    )
  }
  return <Outlet />
}

/** First-time users go to the Preferences hub; once onboarding is saved they go straight to Home. */
export function RequireOnboarded() {
  const { profile } = useProfile()
  if (profile && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export function PreferencesLayout({ mode }: { mode: PrefsMode }) {
  const { profile } = useProfile()
  if (mode === 'onboarding' && profile?.onboarding_completed) return <Navigate to="/home" replace />
  return (
    <PreferencesDraftProvider mode={mode}>
      <Outlet />
    </PreferencesDraftProvider>
  )
}
