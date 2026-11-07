const env = import.meta.env

export const config = {
  // Blank in development (Vite proxies /api to the backend); the API origin for a deployed frontend.
  apiBase: (env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, ''),
}
