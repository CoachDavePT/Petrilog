// "Meine Daten exportieren" (PROJ-1: AC-29, PROJ-2: AC-35 — Art. 15, 20 GDPR; Art. 25, 28 DSG).
// Every later feature adds its own data to this file (docs/data-model.md).
// Version 2 (PROJ-2): all own sessions, newest first, each with its catches in catch order.
import { requireUser } from '@/lib/auth/require-user'
import { speciesLabel } from '@/lib/fishing/species'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const FAILED = 'Export fehlgeschlagen. Bitte versuche es erneut.'

// Every column except the owner (user_id) and, for catches, the parent (session_id) — the nesting
// already says which session a catch belongs to.
const SESSION_COLUMNS =
  'id, started_at, ended_at, water_name, note, latitude, longitude, accuracy_m, created_at, updated_at'
const CATCH_COLUMNS =
  'id, caught_at, species, species_other, length_cm, weight_g, bait, released, latitude, longitude, accuracy_m, position_source, created_at, updated_at'

type ExportCatchRow = {
  id: string
  caught_at: string
  species: string
  species_other: string | null
  length_cm: number
  weight_g: number | null
  bait: string | null
  released: boolean
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  position_source: string
  created_at: string
  updated_at: string
}

type ExportSessionRow = {
  id: string
  started_at: string
  ended_at: string | null
  water_name: string | null
  note: string | null
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  created_at: string
  updated_at: string
  catches: ExportCatchRow[] | null
}

function exportCatch(row: ExportCatchRow) {
  const { id, caught_at, species, ...details } = row
  // species_label: the German name of the id ("Sonstige" for other); species_other stays as stored.
  return { id, caught_at, species, species_label: speciesLabel(species), ...details }
}

export async function GET() {
  const user = await requireUser()
  const supabase = await createClient()

  // RLS limits both queries to the user's own rows; the explicit filters keep the intent visible.
  const [profileResult, sessionsResult] = await Promise.all([
    supabase.from('profiles').select('id, created_at').eq('id', user.id).maybeSingle(),
    supabase
      .from('sessions')
      .select(`${SESSION_COLUMNS}, catches (${CATCH_COLUMNS})`)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .order('caught_at', { ascending: true, referencedTable: 'catches' })
      .order('created_at', { ascending: true, referencedTable: 'catches' })
      .overrideTypes<ExportSessionRow[], { merge: false }>(),
  ])
  if (profileResult.error || sessionsResult.error) return new Response(FAILED, { status: 500 })

  const sessions = (sessionsResult.data ?? []).map(({ catches, ...session }) => ({
    ...session,
    catches: (catches ?? []).map(exportCatch),
  }))

  const now = new Date()
  const body = {
    format: 'petrilog-export',
    version: 2,
    exported_at: now.toISOString(),
    account: {
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
    profile: profileResult.data,
    sessions,
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
