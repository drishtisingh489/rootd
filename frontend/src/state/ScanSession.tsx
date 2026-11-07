/*
 * Hands a confirmed product from the Camera screen to the Results screen.
 * The analysis request starts on Confirm; Results shows the growing tree while the promise is pending.
 * The captured photo stays in memory for this session only. It is never uploaded for storage.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApi } from '../api'
import type { AnalyzeRequest, Scan } from '../types'

export interface ProductHint {
  name: string
  brand: string
  package_size?: string | null
  image_url?: string | null
  is_demo?: boolean
}

export interface PendingAnalysis {
  key: number
  promise: Promise<Scan>
  hint: ProductHint
  preview: string | null
}

interface ScanSessionState {
  pending: PendingAnalysis | null
  startAnalysis(request: AnalyzeRequest, hint: ProductHint, preview: string | null): void
  remember(scan: Scan): void
  cached(scanId: string): Scan | undefined
  previewFor(scanId: string): string | undefined
  invalidate(): void
  historyVersion: number
}

const ScanSessionContext = createContext<ScanSessionState | null>(null)

export function useScanSession(): ScanSessionState {
  const ctx = useContext(ScanSessionContext)
  if (!ctx) throw new Error('useScanSession must be used inside <ScanSessionProvider>')
  return ctx
}

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const api = useApi()
  const [pending, setPending] = useState<PendingAnalysis | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const cache = useRef(new Map<string, Scan>())
  const previews = useRef(new Map<string, string>())
  const counter = useRef(0)

  const remember = useCallback((scan: Scan) => {
    cache.current.set(scan.scan_id, scan)
  }, [])

  const startAnalysis = useCallback(
    (request: AnalyzeRequest, hint: ProductHint, preview: string | null) => {
      const promise = api.analyze(request).then((scan) => {
        cache.current.set(scan.scan_id, scan)
        if (preview) previews.current.set(scan.scan_id, preview)
        setHistoryVersion((v) => v + 1)
        return scan
      })
      promise.catch(() => undefined) // handled by the Results screen
      counter.current += 1
      setPending({ key: counter.current, promise, hint, preview })
    },
    [api],
  )

  const invalidate = useCallback(() => {
    cache.current.clear()
    previews.current.clear()
    setHistoryVersion((v) => v + 1)
  }, [])

  const value = useMemo(
    () => ({
      pending,
      startAnalysis,
      remember,
      cached: (id: string) => cache.current.get(id),
      previewFor: (id: string) => previews.current.get(id),
      invalidate,
      historyVersion,
    }),
    [pending, startAnalysis, remember, invalidate, historyVersion],
  )
  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>
}
