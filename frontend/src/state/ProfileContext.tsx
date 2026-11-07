/* Loads this browser's root’d profile (GET /api/me) once and shares it with every screen. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, useApi } from '../api'
import type { Profile, ProfileUpdate } from '../types'

interface ProfileState {
  profile: Profile | null
  loading: boolean
  error: ApiError | null
  reload(): void
  save(fields: ProfileUpdate): Promise<Profile>
}

const ProfileContext = createContext<ProfileState | null>(null)

export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>')
  return ctx
}

/** Convenience for screens that only render once the profile has loaded. */
export function useLoadedProfile(): Profile {
  const { profile } = useProfile()
  if (!profile) throw new Error('Profile not loaded')
  return profile
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    api.getMe().then(
      (me) => alive && setProfile(me),
      (err) => alive && setError(err instanceof ApiError ? err : new ApiError(0, 'error', String(err))),
    ).finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [api, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  const save = useCallback(
    async (fields: ProfileUpdate) => {
      const updated = await api.updateMe(fields)
      setProfile(updated)
      return updated
    },
    [api],
  )

  const value = useMemo(() => ({ profile, loading, error, reload, save }), [profile, loading, error, reload, save])
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
