// The id a create form makes when it opens and sends with every attempt (PROJ-2 design.md → Doppeltes
// Speichern, EC-2). A v4 UUID; falls back to getRandomValues where randomUUID is missing — it exists only
// in secure contexts, so plain http on a LAN address (a phone at the water) would otherwise break the form.
export function newEntryId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
