// The caller's IP for the per-IP limits (PROJ-1 design.md): first entry of x-forwarded-for, then
// x-real-ip, else "unknown". Behind a host that sets these headers this is the client; locally every
// request shares one value, so the per-IP limit acts for everyone together there.
type HeaderSource = { get(name: string): string | null }

export function clientIp(headers: HeaderSource): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
  return ip.slice(0, 45)
}
