// The caller's IP for the per-IP limits (PROJ-1 design.md → „IP-Adresse des Aufrufers"). A header
// only counts when TRUSTED_CLIENT_IP_HEADER names it — the one header the host sets itself. Without
// that setting (default, also locally) no header is trusted and every request counts as "untrusted":
// strict for everyone together, but not something a caller can spoof around (AC-24, AC-26).
type HeaderSource = { get(name: string): string | null }

export const UNTRUSTED_IP = 'untrusted'

export function clientIp(
  headers: HeaderSource,
  trustedHeader: string | undefined = process.env.TRUSTED_CLIENT_IP_HEADER,
): string {
  const name = trustedHeader?.trim().toLowerCase()
  if (!name) return UNTRUSTED_IP

  const value = headers.get(name)
  // x-forwarded-for: the last entry is the one the proxy appended; earlier ones come from the caller.
  const ip = (name === 'x-forwarded-for' ? value?.split(',').at(-1) : value)?.trim()
  return ip ? ip.slice(0, 45) : UNTRUSTED_IP
}
