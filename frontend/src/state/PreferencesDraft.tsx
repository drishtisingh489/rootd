/*
 * Shared draft of the user's preferences for the hub → category → hub flow.
 * It lives in the layout route that wraps the hub and all category screens, so back navigation never resets it.
 * Nothing is saved to the server until the hub's Save button calls save() (PUT /api/me).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clonePreferences, OTHER_PREFIX, samePreferences } from '../lib/catalog'
import type { GroupId, Level, Preferences } from '../types'
import { useProfile } from './ProfileContext'

export type PrefsMode = 'onboarding' | 'edit'

interface DraftState {
  mode: PrefsMode
  draft: Preferences
  dirty: boolean
  toggle(groupId: GroupId, optionId: string, exclusive?: boolean): void
  addOther(groupId: GroupId, text: string): string | null
  setLevel(groupId: GroupId, optionId: string, level: Level | null): void
  setCrossContact(value: boolean): void
  save(): Promise<void>
}

const DraftContext = createContext<DraftState | null>(null)

export function usePreferencesDraft(): DraftState {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('usePreferencesDraft must be used inside <PreferencesDraftProvider>')
  return ctx
}

const storageKey = (mode: PrefsMode) => `rootd.prefsDraft.${mode}`

function initialDraft(mode: PrefsMode, saved: Preferences | undefined): Preferences {
  // First-time onboarding survives a page refresh; edits start from the saved profile each time.
  if (mode === 'onboarding') {
    try {
      const stored = sessionStorage.getItem(storageKey(mode))
      if (stored) return clonePreferences(JSON.parse(stored) as Preferences)
    } catch {
      /* ignore unreadable storage */
    }
  }
  return clonePreferences(saved)
}

export function PreferencesDraftProvider({ mode, children }: { mode: PrefsMode; children: ReactNode }) {
  const { profile, save: saveProfile } = useProfile()
  const [draft, setDraft] = useState<Preferences>(() => initialDraft(mode, profile?.preferences))

  useEffect(() => {
    if (mode !== 'onboarding') return
    try {
      sessionStorage.setItem(storageKey(mode), JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }, [draft, mode])

  const toggle = useCallback((groupId: GroupId, optionId: string, exclusive = false) => {
    setDraft((prev) => {
      const next = clonePreferences(prev)
      const list = next[groupId]
      const key = `${groupId}:${optionId}`
      if (list.includes(optionId)) {
        next[groupId] = list.filter((v) => v !== optionId)
        delete next.levels[key]
      } else if (exclusive) {
        // e.g. "Prefer not to say" clears the other choices in its group.
        for (const v of list) delete next.levels[`${groupId}:${v}`]
        next[groupId] = [optionId]
      } else {
        next[groupId] = [...list.filter((v) => v !== 'prefer_not_to_say'), optionId]
      }
      return next
    })
  }, [])

  const addOther = useCallback(
    (groupId: GroupId, text: string): string | null => {
      const clean = text.trim().replace(/\s+/g, ' ').slice(0, 60)
      if (!clean) return 'Type something to add.'
      const id = `${OTHER_PREFIX}${clean}`
      if (draft[groupId].some((v) => v.toLowerCase() === id.toLowerCase())) return 'You already added that.'
      setDraft((prev) => {
        const next = clonePreferences(prev)
        next[groupId] = [...next[groupId].filter((v) => v !== 'prefer_not_to_say'), id]
        return next
      })
      return null
    },
    [draft],
  )

  const setLevel = useCallback((groupId: GroupId, optionId: string, level: Level | null) => {
    setDraft((prev) => {
      const next = clonePreferences(prev)
      const key = `${groupId}:${optionId}`
      if (level === null || level === 'preference' || level === 'important') delete next.levels[key]
      else next.levels[key] = level
      return next
    })
  }, [])

  const setCrossContact = useCallback((value: boolean) => {
    setDraft((prev) => ({ ...clonePreferences(prev), allergy_cross_contact: value }))
  }, [])

  const save = useCallback(async () => {
    await saveProfile({ preferences: draft, onboarding_completed: true })
    try {
      sessionStorage.removeItem(storageKey(mode))
    } catch {
      /* ignore */
    }
  }, [draft, mode, saveProfile])

  const dirty = useMemo(() => !samePreferences(draft, clonePreferences(profile?.preferences)), [draft, profile])

  const value = useMemo(
    () => ({ mode, draft, dirty, toggle, addOther, setLevel, setCrossContact, save }),
    [mode, draft, dirty, toggle, addOther, setLevel, setCrossContact, save],
  )
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}
