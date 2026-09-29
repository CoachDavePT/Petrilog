// Server-side log line for a technical auth failure — kind and code only, never the input (no email,
// no password). Keeps "Keine Verbindung" traceable without putting personal data into logs.
export function logAuthError(scope: string, error: unknown): void {
  const e = error as { name?: string; code?: string; status?: number; message?: string } | null
  console.error(`[auth] ${scope} failed:`, e?.name ?? 'Error', e?.code ?? '', e?.status ?? '', e?.message ?? String(error))
}
