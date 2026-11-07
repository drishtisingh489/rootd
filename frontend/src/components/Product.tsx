import { Package } from 'lucide-react'
import { useState } from 'react'
import type { Verdict } from '../types'

const PANEL: Record<Verdict | 'neutral', string> = {
  green: 'panel-green',
  yellow: 'panel-yellow',
  red: 'panel-red',
  unknown: 'panel-gray',
  neutral: 'panel-gray',
}

/** Product image on a soft pastel panel; falls back to an icon when no legitimate image exists. */
export function ProductThumb({
  src,
  tone = 'neutral',
  size = 64,
  alt = '',
}: {
  src?: string | null
  tone?: Verdict | 'neutral'
  size?: number | '100%'
  alt?: string
}) {
  const [broken, setBroken] = useState(false)
  const style = size === '100%' ? undefined : { width: size, height: size }
  return (
    <span className={`product-thumb ${PANEL[tone]}`} style={style}>
      {src && !broken ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <Package size={typeof size === 'number' ? size * 0.42 : 40} strokeWidth={1.6} aria-hidden="true" />
      )}
    </span>
  )
}

export function DemoTag() {
  return <span className="demo-tag">DEMO DATA</span>
}

/** Top product widget used on both result screens. */
export function ProductWidget({
  name,
  brand,
  size,
  variant,
  image,
  isDemo,
}: {
  name: string
  brand: string
  size?: string | null
  variant?: string | null
  image?: string | null
  isDemo?: boolean
}) {
  const meta = [variant, size].filter(Boolean).join(' · ')
  return (
    <section className="product-widget" aria-label="Scanned product">
      <ProductThumb src={image} size={72} alt={name} />
      <div className="product-widget-text">
        {brand && <p className="product-brand">{brand}</p>}
        <p className="product-name">{name || 'Unnamed product'}</p>
        {meta && <p className="product-meta">{meta}</p>}
        {isDemo && <DemoTag />}
      </div>
    </section>
  )
}
