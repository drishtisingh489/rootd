import { initials } from '../lib/format'

export function Avatar({
  name,
  email,
  src,
  size = 48,
}: {
  name?: string | null
  email?: string | null
  src?: string | null
  size?: number
}) {
  if (src) {
    return <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />
  }
  return (
    <span className="avatar avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name, email)}
    </span>
  )
}
