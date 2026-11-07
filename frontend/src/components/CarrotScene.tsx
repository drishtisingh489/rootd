/* Minimal flat carrot-in-soil illustration anchored to the bottom of the welcome screen. */

type Pt = [number, number]

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): { p: Pt; angle: number } {
  const u = 1 - t
  const p: Pt = [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
  const d: Pt = [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ]
  return { p, angle: (Math.atan2(d[1], d[0]) * 180) / Math.PI }
}

const BASE: Pt = [200, 112]
const FRONDS: [Pt, Pt, Pt][] = [
  [[198, 84], [188, 62], [172, 40]],
  [[201, 80], [204, 56], [214, 30]],
  [[205, 88], [218, 70], [236, 56]],
  [[196, 90], [182, 78], [162, 68]],
  [[200, 86], [196, 64], [194, 44]],
]

const SPECKS: [number, number, number][] = (() => {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const out: [number, number, number][] = []
  while (out.length < 46) {
    const x = rnd() * 400
    const y = 128 + rnd() * 88
    if (Math.abs(x - 200) < 24 && y < 214) continue
    out.push([x, y, 0.9 + rnd() * 1.6])
  }
  return out
})()

const SOIL_EDGE = (() => {
  // Small irregular soil clumps along the ground line (not decorative waves).
  let d = 'M0 220 L0 116'
  const bumps = [3, 5, 2, 4, 6, 3, 2, 5, 4, 3, 6, 2, 4, 5, 3, 2, 4, 6, 3, 5]
  const step = 400 / bumps.length
  bumps.forEach((b, i) => {
    const x0 = i * step
    d += ` Q${(x0 + step / 2).toFixed(1)} ${116 - b} ${(x0 + step).toFixed(1)} 116`
  })
  return `${d} L400 220 Z`
})()

export function CarrotScene() {
  return (
    <svg className="carrot-scene" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g className="carrot-fronds">
        {FRONDS.map(([c1, c2, end], i) => {
          // Pinnate leaflets: pairs that grow forward out of the stem, getting smaller toward the tip.
          const leaflets = [0.42, 0.56, 0.7, 0.84].flatMap((t, j) => {
            const { p, angle } = cubic(BASE, c1, c2, end, t)
            const len = 9 - j * 1.2
            return [-1, 1].map((side) => (
              <ellipse
                key={`${j}${side}`}
                cx="0"
                cy="0"
                rx={len}
                ry={2.6}
                transform={`translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${(angle + side * 42).toFixed(1)}) translate(${len - 1} 0)`}
                fill={side > 0 ? '#6CAA44' : '#5E9A3A'}
              />
            ))
          })
          const tip = cubic(BASE, c1, c2, end, 1)
          leaflets.push(
            <ellipse
              key="tip"
              cx="0"
              cy="0"
              rx={6.5}
              ry={2.6}
              transform={`translate(${tip.p[0]} ${tip.p[1]}) rotate(${tip.angle.toFixed(1)}) translate(4 0)`}
              fill="#6CAA44"
            />,
          )
          return (
            <g key={i}>
              <path
                d={`M${BASE[0]} ${BASE[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`}
                stroke="#5A9238"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
              {leaflets}
            </g>
          )
        })}
      </g>
      <path d={SOIL_EDGE} fill="#332C1A" />
      {SPECKS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? '#5C4A2E' : '#7A6341'} />
      ))}
      <path d="M185 108 C185 102 215 102 215 108 C215 140 207 178 200 216 C193 178 185 140 185 108 Z" fill="#E8894A" />
      <path d="M200 105 C208 105 213 106 214 109" stroke="#F3A66B" strokeWidth="3" strokeLinecap="round" fill="none" />
      {[
        [190, 124, 199],
        [202, 136, 211],
        [190, 150, 197],
        [201, 164, 208],
        [193, 180, 199],
      ].map(([x1, y, x2], i) => (
        <path key={i} d={`M${x1} ${y} L${x2} ${y + 1}`} stroke="#C46A34" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  )
}
