// "Meine Daten exportieren" (PROJ-1: AC-29, PROJ-2: AC-35, PROJ-3: AC-21 — Art. 15, 20 GDPR; Art. 25, 28 DSG).
// Every later feature adds its own data to this file (docs/data-model.md).
// Version 2 (PROJ-2): all own sessions, newest first, each with its catches in catch order.
// Version 3 (PROJ-3): every session and catch carries a `weather` object — always its status, the values only
// when the status is 'ok'. The internal fill-in state (weather_requested_at, weather_attempted_at) stays out.
import { requireUser } from '@/lib/auth/require-user'
import { speciesLabel } from '@/lib/fishing/species'
import { createClient } from '@/lib/supabase/server'
import { weatherLabel } from '@/lib/weather/core'
import type { WeatherStatus } from '@/lib/weather/types'

export const dynamic = 'force-dynamic'

const FAILED = 'Export fehlgeschlagen. Bitte versuche es erneut.'

// The weather snapshot without the internal fill-in state (AC-21).
const WEATHER_COLUMNS =
  'weather_status, weather_hour, weather_temperature_c, weather_pressure_hpa, weather_wind_speed_kmh, weather_wind_direction_deg, weather_cloud_cover_pct, weather_precipitation_mm, weather_code, weather_fetched_at'

// Every column except the owner (user_id) and, for catches, the parent (session_id) — the nesting
// already says which session a catch belongs to.
const SESSION_COLUMNS = `id, started_at, ended_at, water_name, note, latitude, longitude, accuracy_m, created_at, updated_at, ${WEATHER_COLUMNS}`
const CATCH_COLUMNS = `id, caught_at, species, species_other, length_cm, weight_g, bait, released, latitude, longitude, accuracy_m, position_source, created_at, updated_at, ${WEATHER_COLUMNS}`

// PostgREST may hand out `numeric` as a string; the export always writes numbers.
type NumericValue = number | string | null

type WeatherColumns = {
  weather_status: WeatherStatus
  weather_hour: string | null
  weather_temperature_c: NumericValue
  weather_pressure_hpa: NumericValue
  weather_wind_speed_kmh: NumericValue
  weather_wind_direction_deg: NumericValue
  weather_cloud_cover_pct: NumericValue
  weather_precipitation_mm: NumericValue
  weather_code: NumericValue
  weather_fetched_at: string | null
}

type ExportCatchRow = WeatherColumns & {
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

type ExportSessionRow = WeatherColumns & {
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

function toNumber(value: NumericValue | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// Takes the flat weather_* columns off a row and nests them as one `weather` object (AC-21).
function splitWeather<T extends WeatherColumns>(row: T) {
  const {
    weather_status: status,
    weather_hour,
    weather_temperature_c,
    weather_pressure_hpa,
    weather_wind_speed_kmh,
    weather_wind_direction_deg,
    weather_cloud_cover_pct,
    weather_precipitation_mm,
    weather_code,
    weather_fetched_at,
    ...rest
  } = row
  if (status !== 'ok') return { rest, weather: { status } }
  const code = toNumber(weather_code)
  return {
    rest,
    weather: {
      status,
      hour: weather_hour,
      temperature_c: toNumber(weather_temperature_c),
      pressure_hpa: toNumber(weather_pressure_hpa),
      wind_speed_kmh: toNumber(weather_wind_speed_kmh),
      wind_direction_deg: toNumber(weather_wind_direction_deg),
      cloud_cover_pct: toNumber(weather_cloud_cover_pct),
      precipitation_mm: toNumber(weather_precipitation_mm),
      weather_code: code,
      weather_label: weatherLabel(code),
      fetched_at: weather_fetched_at,
    },
  }
}

function exportCatch(row: ExportCatchRow) {
  const { rest, weather } = splitWeather(row)
  const { id, caught_at, species, ...details } = rest
  // species_label: the German name of the id ("Sonstige" for other); species_other stays as stored.
  return { id, caught_at, species, species_label: speciesLabel(species), ...details, weather }
}

function exportSession({ catches, ...row }: ExportSessionRow) {
  const { rest, weather } = splitWeather(row)
  return { ...rest, weather, catches: (catches ?? []).map(exportCatch) }
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

  const sessions = (sessionsResult.data ?? []).map(exportSession)

  const now = new Date()
  const body = {
    format: 'petrilog-export',
    version: 3,
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
