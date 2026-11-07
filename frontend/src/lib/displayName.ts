/*
 * The name the user chose on the landing page ("What should we call you?").
 * Saved to localStorage immediately, then sent to the backend (PUT /api/me) by ProfileProvider once the
 * profile exists. The saved copy is kept in sync with the server so the landing field is prefilled.
 */

const NAME_KEY = 'rootd.displayName'
const PENDING_KEY = 'rootd.displayNamePending'
export const NAME_MAX = 30

/** Returns an error message, or null when the (trimmed) name is valid. */
export function validateName(raw: string): string | null {
  const name = raw.trim()
  if (!name) return 'Please enter a name.'
  if (name.length > NAME_MAX) return `Keep it to ${NAME_MAX} characters or fewer.`
  return null
}

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Remember the name locally. `syncToProfile` asks ProfileProvider to save it as display_name. */
export function rememberName(name: string, syncToProfile = false): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim())
    if (syncToProfile) localStorage.setItem(PENDING_KEY, '1')
  } catch {
    /* storage unavailable: the name still reaches the profile in this session only if already synced */
  }
}

/** The name waiting to be saved to the profile, if any. */
export function pendingName(): string | null {
  try {
    if (localStorage.getItem(PENDING_KEY) !== '1') return null
    const name = (localStorage.getItem(NAME_KEY) ?? '').trim()
    return validateName(name) === null ? name : null
  } catch {
    return null
  }
}

export function clearPendingName(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}
