/*
 * Demo-grade anonymous identity. NOT authentication.
 * A random UUID is created on first visit, kept in localStorage and sent to the API as X-User-Id.
 * Clearing site data starts a fresh, empty profile. Do not use this to protect real personal data.
 */

const STORAGE_KEY = 'rootd.userId'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function randomUuid(): string {
  // crypto.randomUUID only exists in secure contexts (https / localhost); getRandomValues works everywhere,
  // e.g. when testing on a phone over the local network.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let memoryId: string | null = null

export function getUserId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && UUID_RE.test(stored)) return stored
    const id = randomUuid()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // Storage blocked (e.g. some private modes): keep one ID for this page session.
    memoryId ??= randomUuid()
    return memoryId
  }
}
