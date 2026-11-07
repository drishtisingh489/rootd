import { config } from './config'
import { getUserId } from './lib/identity'
import type {
  AnalyzeRequest,
  DailyBranch,
  DemoProduct,
  Identification,
  Insights,
  ProductMatch,
  Profile,
  ProfileUpdate,
  Scan,
} from './types'

/** Backend errors arrive as {"error": {"code", "message"}}; this carries them to the UI. */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

type RequestOptions = RequestInit & { json?: unknown }

function createApi() {
  async function request<T>(path: string, { json, ...init }: RequestOptions = {}): Promise<T> {
    const headers = new Headers(init.headers)
    // Anonymous demo identity (see lib/identity.ts); the backend scopes all data to this ID.
    headers.set('X-User-Id', getUserId())
    let body = init.body
    if (json !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(json)
    }
    let resp: Response
    try {
      resp = await fetch(`${config.apiBase}${path}`, { ...init, headers, body })
    } catch {
      throw new ApiError(0, 'network', "Couldn't reach the root’d server. Check your connection and try again.")
    }
    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      const err = data?.error
      throw new ApiError(resp.status, err?.code ?? 'error', err?.message ?? `Request failed (HTTP ${resp.status}).`)
    }
    return data as T
  }

  return {
    getMe: () => request<Profile>('/api/me'),
    updateMe: (fields: ProfileUpdate) => request<Profile>('/api/me', { method: 'PUT', json: fields }),
    identify: (photo: Blob) => {
      const form = new FormData()
      form.append('file', photo, 'product.jpg')
      return request<{ identification: Identification; matches: ProductMatch[] }>('/api/scans/identify', {
        method: 'POST',
        body: form,
      })
    },
    lookup: (params: { barcode?: string; q?: string }) => {
      const search = new URLSearchParams()
      if (params.barcode) search.set('barcode', params.barcode)
      if (params.q) search.set('q', params.q)
      return request<{ matches: ProductMatch[] }>(`/api/products/lookup?${search}`)
    },
    demoProducts: () => request<{ products: DemoProduct[] }>('/api/demo/products'),
    analyze: (body: AnalyzeRequest) => request<Scan>('/api/scans/analyze', { method: 'POST', json: body }),
    listScans: () => request<{ scans: Scan[] }>('/api/scans'),
    getScan: (id: string) => request<Scan>(`/api/scans/${encodeURIComponent(id)}`),
    clearScans: () => request<{ deleted: number }>('/api/scans', { method: 'DELETE' }),
    dailyBranch: () => request<DailyBranch>('/api/daily-branch'),
    insights: (days: number) => request<Insights>(`/api/insights?days=${days}`),
  }
}

export type Api = ReturnType<typeof createApi>

const api = createApi()

/** One shared, stable client (stable identity keeps effect dependencies from re-firing). */
export function useApi(): Api {
  return api
}
