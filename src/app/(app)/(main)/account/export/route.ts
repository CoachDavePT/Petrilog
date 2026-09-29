// "Meine Daten exportieren" (PROJ-1: AC-29 — Art. 15, 20 GDPR; Art. 25, 28 DSG).
// Every later feature adds its own data to this file (docs/data-model.md).
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, created_at')
    .eq('id', user.id)
    .maybeSingle()
  if (error) return new Response('Export fehlgeschlagen. Bitte versuche es erneut.', { status: 500 })

  const now = new Date()
  const body = {
    format: 'petrilog-export',
    version: 1,
    exported_at: now.toISOString(),
    account: {
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile,
  }
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now) // YYYY-MM-DD

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="petrilog-export-${day}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
