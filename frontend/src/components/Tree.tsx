/*
 * Animated result tree (E1). Grows while results load (trunk → branches → buds), then settles on a continuous
 * health spectrum derived from the deterministic verdict and preference-fit estimate:
 *   red    → bare, struggling branches with a few dry leaves
 *   yellow → partial canopy of yellow/orange/red leaves, some falling
 *   green  → full lush canopy with blossoms
 *   unknown→ muted grey "dormant" canopy (never a falsely healthy tree)
 * Pure SVG + CSS animation; respects prefers-reduced-motion.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import type { Verdict } from '../types'

interface Leaf {
  x: number
  y: number
  r: number
  shade: number // -1 (dark) … 1 (light)
  rank: number // 0 … 1: leaves with a low rank survive longest
  hue: number // -0.5 … 0.5 per-leaf colour jitter
  delay: number // 0 … 1 bud-in order
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CROWN = { cx: 152, cy: 90, rx: 104, ry: 60 }

const LEAVES: Leaf[] = (() => {
  const rnd = mulberry32(20261107)
  const out: Leaf[] = []
  for (let tries = 0; out.length < 58 && tries < 6000; tries++) {
    const angle = rnd() * Math.PI * 2
    const dist = Math.sqrt(rnd())
    const x = CROWN.cx + Math.cos(angle) * dist * CROWN.rx
    const y = CROWN.cy + Math.sin(angle) * dist * CROWN.ry
    const r = 10 + rnd() * 10
    if (out.some((l) => Math.hypot(l.x - x, l.y - y) < (l.r + r) * 0.55)) continue
    // Buds open from the branch core outward, so the canopy grows out of the tree rather than above it.
    const fromCore = Math.hypot((x - 150) / CROWN.rx, (y - 118) / (CROWN.ry * 1.4))
    out.push({ x, y, r, shade: rnd() * 2 - 1, rank: rnd(), hue: rnd() - 0.5, delay: fromCore * 0.8 + rnd() * 0.2 })
  }
  // Darker leaves first so lighter ones sit on top, giving the canopy depth.
  return out.sort((a, b) => a.shade - b.shade)
})()

const BLOSSOM_SPOTS = LEAVES.filter((l) => l.shade > 0.1)
  .sort((a, b) => a.rank - b.rank)
  .slice(0, 10)
  .map((l, i) => ({ x: l.x + l.r * 0.35, y: l.y - l.r * 0.3, i }))

const BRANCHES: { d: string; w: number; t: number }[] = [
  { d: 'M150 172 C136 158 118 146 96 128', w: 10, t: 0.45 },
  { d: 'M150 164 C164 150 184 138 206 124', w: 10, t: 0.5 },
  { d: 'M150 162 C147 136 153 112 150 82', w: 9, t: 0.55 },
  { d: 'M96 128 C86 118 78 108 70 96', w: 6, t: 0.85 },
  { d: 'M114 143 C110 128 112 112 118 98', w: 5, t: 0.9 },
  { d: 'M96 128 C84 128 72 130 60 126', w: 4.5, t: 0.95 },
  { d: 'M206 124 C218 114 226 104 234 92', w: 6, t: 0.9 },
  { d: 'M186 140 C190 124 188 110 182 96', w: 5, t: 0.85 },
  { d: 'M206 124 C218 126 230 128 242 124', w: 4.5, t: 1.0 },
  { d: 'M150 112 C140 102 130 92 122 76', w: 5, t: 1.0 },
  { d: 'M150 100 C160 90 170 80 178 66', w: 5, t: 1.05 },
  { d: 'M150 82 C149 70 151 58 150 46', w: 4, t: 1.1 },
  { d: 'M70 96 C66 88 64 82 62 74', w: 3, t: 1.25 },
  { d: 'M234 92 C238 84 240 78 240 70', w: 3, t: 1.25 },
  { d: 'M122 76 C118 68 116 60 116 52', w: 3, t: 1.3 },
  { d: 'M178 66 C182 58 186 52 190 46', w: 3, t: 1.3 },
  { d: 'M118 98 C122 90 126 84 132 78', w: 2.6, t: 1.35 },
  { d: 'M182 96 C176 88 172 82 166 76', w: 2.6, t: 1.35 },
  { d: 'M60 126 C54 122 50 118 46 112', w: 2.6, t: 1.35 },
  { d: 'M242 124 C248 120 252 116 256 110', w: 2.6, t: 1.35 },
]

const FALLERS = [
  { x: 112, y: 118, t: 0 },
  { x: 196, y: 108, t: 2.4 },
  { x: 150, y: 128, t: 4.6 },
  { x: 84, y: 98, t: 6.1 },
]

type RGB = [number, number, number]
const STOPS: [number, RGB][] = [
  [0.0, [140, 106, 79]], // dry brown
  [0.2, [181, 101, 58]], // rust
  [0.35, [217, 103, 59]], // red-orange
  [0.48, [232, 145, 58]], // orange
  [0.6, [230, 184, 58]], // yellow
  [0.72, [185, 196, 67]], // yellow-green
  [0.84, [109, 190, 75]], // green
  [1.0, [38, 160, 87]], // lush emerald
]

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function colorAt(h: number): RGB {
  const v = clamp(h)
  for (let i = 1; i < STOPS.length; i++) {
    const [h1, c1] = STOPS[i]
    const [h0, c0] = STOPS[i - 1]
    if (v <= h1) return mix(c0, c1, (v - h0) / (h1 - h0))
  }
  return STOPS[STOPS.length - 1][1]
}

function shadeColor(c: RGB, shade: number): string {
  const out = shade > 0 ? mix(c, [255, 255, 255], shade * 0.2) : mix(c, [0, 0, 0], -shade * 0.16)
  return `rgb(${out.map((n) => Math.round(n)).join(',')})`
}

/** Maps the verdict + preference-fit estimate onto 0 (dead) … 1 (thriving). null = insufficient data. */
export function treeHealth(status: Verdict, score: number | null): number | null {
  const s = score === null ? null : clamp(score / 100)
  if (status === 'green') return 0.76 + 0.24 * (s ?? 0.75)
  if (status === 'yellow') return 0.36 + 0.32 * (s ?? 0.5)
  if (status === 'red') return 0.04 + 0.18 * (s ?? 0.3)
  return null
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia?.(query).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Growth phase timing shared by the tree and the page, so labels appear exactly when the tree settles. */
export function useTreeGrowth(quick: boolean) {
  const reduced = usePrefersReducedMotion()
  const k = quick ? 0.5 : 1 // growth-time multiplier
  const [grown, setGrown] = useState(reduced)
  useEffect(() => {
    if (reduced) {
      setGrown(true)
      return
    }
    const timer = setTimeout(() => setGrown(true), 3000 * k)
    return () => clearTimeout(timer)
  }, [reduced, k])
  return { grown, reduced, k }
}

export function Tree({
  result,
  label,
  growth,
}: {
  result: { status: Verdict; score: number | null } | null
  label: string
  growth: { grown: boolean; reduced: boolean; k: number }
}) {
  const { grown, reduced, k } = growth
  const settled = grown && result !== null
  const health = result ? treeHealth(result.status, result.score) : null
  const dormant = settled && health === null
  const h = health ?? 0.5

  const visibleFraction = dormant ? 0.55 : 0.06 + 0.94 * Math.pow(h, 0.9)
  const spread = h > 0.76 ? 0.08 : h > 0.3 ? 0.24 : 0.12
  const blossoms = settled && !dormant && h > 0.8 ? Math.round(((h - 0.8) / 0.2) * BLOSSOM_SPOTS.length) : 0
  const fallers = !settled || dormant ? 0 : h < 0.3 ? 2 : h < 0.76 ? 4 : 0
  const sway = !settled ? 0.5 : dormant ? 0.5 : h < 0.3 ? 0.6 : h < 0.76 ? 1.6 : 1.1
  const wood = !settled ? '#6E4428' : dormant ? '#7C7068' : h < 0.3 ? '#6A5546' : '#6E4428'

  const aria = settled
    ? `Tree illustration: ${label}. ${dormant ? 'A muted, dormant tree because there is not enough data.' : h < 0.3 ? 'A struggling tree with bare branches.' : h < 0.76 ? 'A partly healthy tree with autumn-coloured leaves.' : 'A full, thriving tree.'}`
    : 'Tree illustration growing while your results load.'

  return (
    <div
      className={`tree${settled ? ' is-settled' : ' is-growing'}${reduced ? ' reduced' : ''}`}
      role="img"
      aria-label={aria}
      style={{ '--sway': `${sway}deg` } as CSSProperties}
    >
      <svg viewBox="0 0 300 260" aria-hidden="true">
        <ellipse cx="150" cy="242" rx="108" ry="9" className="tree-ground" />
        <g className="tree-sway">
          <g className="tree-wood" style={{ stroke: wood, fill: wood }}>
            <path d="M134 242 Q150 230 166 242 Z" className="trunk-flare" style={{ animationDelay: `${0.2 * k}s` }} />
            <path
              d="M150 242 C150 215 148 190 150 158"
              pathLength={1}
              className="branch trunk"
              strokeWidth={17}
              style={{ animationDuration: `${0.9 * k}s` }}
            />
            {BRANCHES.map((b) => (
              <path
                key={b.d}
                d={b.d}
                pathLength={1}
                className="branch"
                strokeWidth={b.w}
                style={{ animationDelay: `${b.t * k}s`, animationDuration: `${0.7 * k}s` }}
              />
            ))}
          </g>
          <g className="tree-leaves">
            {LEAVES.map((leaf, i) => {
              const visible = !settled || leaf.rank < visibleFraction
              let fill: string
              if (!settled) fill = shadeColor([150, 205, 102], leaf.shade)
              else if (dormant) fill = shadeColor([184, 194, 189], leaf.shade * 0.8)
              else fill = shadeColor(colorAt(h + leaf.hue * spread), leaf.shade)
              const style = {
                fill,
                '--bud-delay': `${(0.9 + leaf.delay * 1.4) * k}s`,
                '--drop-delay': `${(leaf.rank - visibleFraction) * 0.9 + 0.05}s`,
                '--rustle-delay': `${-leaf.rank * 3}s`,
              } as CSSProperties
              const cls = ['leaf', visible ? (i % 3 === 0 ? 'rustle' : '') : 'leaf-drop'].join(' ')
              return <circle key={i} cx={leaf.x} cy={leaf.y} r={leaf.r} className={cls} style={style} />
            })}
          </g>
          <g className="tree-blossoms">
            {BLOSSOM_SPOTS.slice(0, blossoms).map((b) => (
              <g key={b.i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
                <g className="blossom" style={{ animationDelay: `${0.3 + b.i * 0.12}s, ${-b.i * 0.7}s` }}>
                  {[0, 72, 144, 216, 288].map((a) => (
                    <ellipse key={a} cx="0" cy="-3.4" rx="2.7" ry="3.6" transform={`rotate(${a})`} fill="#FFD4DF" />
                  ))}
                  <circle r="2.1" fill="#F4C64E" />
                </g>
              </g>
            ))}
          </g>
        </g>
        <g className="tree-fallers">
          {FALLERS.slice(0, fallers).map((f, i) => (
            <g key={i} transform={`translate(${f.x} ${f.y})`}>
              <path
                d="M0 -6 C4 -3 4 3 0 6 C-4 3 -4 -3 0 -6 Z"
                className="faller"
                style={{
                  fill: shadeColor(colorAt(h + (i % 2 ? 0.08 : -0.1)), 0),
                  animationDelay: `${f.t + 1.2}s`,
                }}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
