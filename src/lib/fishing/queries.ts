// Server-side reads of Sessions & Fänge — PROJ-2 design.md → Datenmodell (Zugriff), Session starten
// (Vorschläge), Fang eintragen (was die Seite lädt), Sessions-Übersicht, Rahmen der App, Detailansicht
// (AC-1, AC-4, AC-7, AC-21, AC-23, AC-29, AC-34, EC-12). PROJ-3 adds the weather columns: the overview
// and the catch list read only the weather state (for „ohne Wetter", AC-17), the detail view and the
// catch page the full snapshot (AC-14, AC-15) — PROJ-3 design.md → Session-Übersicht und Fangzeile.
//
// Every read goes through the user-scoped Supabase client: Row Level Security returns only the
// signed-in user's rows, so ownership is never checked here by hand and the service-role key is never
// used. Callers check the login first (requireUser) — without one the database refuses and these
// functions throw. A database error throws (the page shows its error state); "not found" is `null`.
import 'server-only'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { WEATHER_STATUSES, type WeatherSnapshot, type WeatherState, type WeatherStatus } from '@/lib/weather/types'
import { idSchema, type Position } from './schemas'
import { isSpeciesId, type SpeciesId } from './species'

/** Sessions per section of the overview and per "Weitere laden" (EC-12). */
export const SESSIONS_PAGE_SIZE = 20
/** At most this many water-name suggestions reach the browser (AC-7). */
export const WATER_NAME_SUGGESTIONS_MAX = 50
/** Recent species come from the user's last 50 catches, at most 3 of them (AC-21). */
export const RECENT_SPECIES_WINDOW = 50
export const RECENT_SPECIES_MAX = 3
/** Rows read to collect the water-name suggestions — far beyond what a user types by hand. */
const WATER_NAME_ROWS = 1000

// ---------------------------------------------------------------------------------------------------
// Domain types (timestamps stay ISO strings as the database returns them — they cross to the browser)

export type PositionSource = 'gps' | 'session' | 'none'

/** The running session for the shell's ActiveSessionBar (AC-4). */
export type RunningSession = {
  id: string
  waterName: string | null
  startedAt: string
  catchCount: number
}

/** One row of the overview — deliberately without position (design.md → Sessions-Übersicht). */
export type SessionListItem = {
  id: string
  startedAt: string
  endedAt: string | null
  waterName: string | null
  catchCount: number
  /** Weather state only — never values or positions in the overview (PROJ-3 AC-17). */
  weatherState: WeatherState
}

export type SessionPage = {
  items: SessionListItem[]
  /** `startedAt` of the last item when older sessions exist — pass it to `loadMoreSessions`. */
  nextCursor: string | null
}

export type CatchDetail = {
  id: string
  sessionId: string
  caughtAt: string
  species: SpeciesId
  /** The typed name for `other`, otherwise null. */
  speciesOther: string | null
  lengthCm: number
  weightG: number | null
  bait: string | null
  released: boolean
  position: Position | null
  positionSource: PositionSource
  createdAt: string
  updatedAt: string
  /** For the „ohne Wetter" marker and the automatic fill (PROJ-3 AC-9, AC-17). */
  weatherState: WeatherState
}

export type SessionDetail = {
  id: string
  startedAt: string
  endedAt: string | null
  waterName: string | null
  note: string | null
  position: Position | null
  createdAt: string
  updatedAt: string
  /** Weather at the start (PROJ-3 AC-14) and its state for the automatic fill (AC-9). */
  weather: WeatherSnapshot
  weatherState: WeatherState
  /** Ordered by catch time, oldest first (AC-29). */
  catches: CatchDetail[]
}

/** A catch for its edit page, with just enough of its session for the time window. */
export type CatchWithSession = {
  catch: CatchDetail
  /** Weather at the catch time (PROJ-3 AC-15). */
  weather: WeatherSnapshot
  session: {
    id: string
    startedAt: string
    endedAt: string | null
    hasPosition: boolean
  }
}

/** Prefill of "Fang eintragen" from the most recently created catch of the session (AC-23). */
export type CatchPrefill = {
  bait: string | null
  released: boolean
}

// ---------------------------------------------------------------------------------------------------
// Rows as the database returns them (the client is untyped, so the shapes are stated here)

type CountEmbed = { count: number }[] | null

type PositionColumns = {
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
}

type WeatherStateColumns = {
  weather_status: string
  weather_requested_at: string
  weather_attempted_at: string | null
}

/** numeric columns may arrive as JSON numbers or as strings — both are accepted. */
type NumericColumn = number | string | null

type WeatherColumns = WeatherStateColumns & {
  weather_hour: string | null
  weather_temperature_c: NumericColumn
  weather_pressure_hpa: NumericColumn
  weather_wind_speed_kmh: NumericColumn
  weather_wind_direction_deg: NumericColumn
  weather_cloud_cover_pct: NumericColumn
  weather_precipitation_mm: NumericColumn
  weather_code: NumericColumn
  weather_fetched_at: string | null
}

type SessionListRow = WeatherStateColumns & {
  id: string
  started_at: string
  ended_at: string | null
  water_name: string | null
  catches: CountEmbed
}

type CatchRow = PositionColumns & WeatherStateColumns & {
  id: string
  session_id: string
  caught_at: string
  species: string
  species_other: string | null
  length_cm: number
  weight_g: number | null
  bait: string | null
  released: boolean
  position_source: string
  created_at: string
  updated_at: string
}

type SessionDetailRow = PositionColumns & WeatherColumns & {
  id: string
  started_at: string
  ended_at: string | null
  water_name: string | null
  note: string | null
  created_at: string
  updated_at: string
  catches: CatchRow[] | null
}

type CatchSessionEmbed = PositionColumns & { id: string; started_at: string; ended_at: string | null }

type CatchWithSessionRow = CatchRow & WeatherColumns & {
  // many-to-one embeds come back as an object; tolerate the array shape the untyped client assumes
  sessions: CatchSessionEmbed | CatchSessionEmbed[] | null
}

const WEATHER_STATE_COLUMNS = 'weather_status, weather_requested_at, weather_attempted_at'
const WEATHER_VALUE_COLUMNS =
  'weather_hour, weather_temperature_c, weather_pressure_hpa, weather_wind_speed_kmh, weather_wind_direction_deg, weather_cloud_cover_pct, weather_precipitation_mm, weather_code, weather_fetched_at'

const SESSION_LIST_COLUMNS = `id, started_at, ended_at, water_name, ${WEATHER_STATE_COLUMNS}, catches(count)`
const CATCH_COLUMNS = `id, session_id, caught_at, species, species_other, length_cm, weight_g, bait, released, latitude, longitude, accuracy_m, position_source, created_at, updated_at, ${WEATHER_STATE_COLUMNS}`
const SESSION_DETAIL_COLUMNS = `id, started_at, ended_at, water_name, note, latitude, longitude, accuracy_m, created_at, updated_at, ${WEATHER_STATE_COLUMNS}, ${WEATHER_VALUE_COLUMNS}, catches(${CATCH_COLUMNS})`

// ---------------------------------------------------------------------------------------------------
// Helpers

type QueryErrorLike = { code?: string; message?: string }

/** A failed read: thrown so the page shows its error state. Carries the database code, not the data. */
function queryFailed(name: string, error: QueryErrorLike): never {
  throw new Error(`[fishing] ${name} failed: ${error.code ?? ''} ${error.message ?? ''}`.trim(), { cause: error })
}

function isUuid(value: unknown): value is string {
  return idSchema.safeParse(value).success
}

const isoWithOffset = z.iso.datetime({ offset: true })

/**
 * The overview cursor: an ISO timestamp with offset or `Z` (what `nextCursor` carries). Returns it
 * normalised to UTC (`…Z`), or `null` for anything else.
 */
export function parseSessionCursor(value: unknown): string | null {
  if (typeof value !== 'string' || !isoWithOffset.safeParse(value).success) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toPosition(row: PositionColumns): Position | null {
  if (row.latitude === null || row.longitude === null || row.accuracy_m === null) return null
  return { latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy_m }
}

function toWeatherStatus(value: string): WeatherStatus {
  return (WEATHER_STATUSES as readonly string[]).includes(value) ? (value as WeatherStatus) : 'pending'
}

function toWeatherState(row: WeatherStateColumns): WeatherState {
  return {
    status: toWeatherStatus(row.weather_status),
    requestedAt: row.weather_requested_at,
    attemptedAt: row.weather_attempted_at,
  }
}

function toNumber(value: NumericColumn): number | null {
  if (value === null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** The snapshot as the pages show it: values only when the database says `ok`. */
function toWeatherSnapshot(row: WeatherColumns): WeatherSnapshot {
  const status = toWeatherStatus(row.weather_status)
  if (status !== 'ok') return { status, hour: null, values: null, fetchedAt: null }
  return {
    status,
    hour: row.weather_hour,
    fetchedAt: row.weather_fetched_at,
    values: {
      temperatureC: toNumber(row.weather_temperature_c),
      pressureHpa: toNumber(row.weather_pressure_hpa),
      windSpeedKmh: toNumber(row.weather_wind_speed_kmh),
      windDirectionDeg: toNumber(row.weather_wind_direction_deg),
      cloudCoverPct: toNumber(row.weather_cloud_cover_pct),
      precipitationMm: toNumber(row.weather_precipitation_mm),
      weatherCode: toNumber(row.weather_code),
    },
  }
}

function toCount(embed: CountEmbed): number {
  return embed?.[0]?.count ?? 0
}

function toPositionSource(value: string): PositionSource {
  return value === 'gps' || value === 'session' ? value : 'none'
}

function toCatch(row: CatchRow): CatchDetail {
  return {
    id: row.id,
    sessionId: row.session_id,
    caughtAt: row.caught_at,
    // the database only allows the 17 ids (catches_species_check)
    species: (isSpeciesId(row.species) ? row.species : 'other') as SpeciesId,
    speciesOther: row.species_other,
    lengthCm: row.length_cm,
    weightG: row.weight_g,
    bait: row.bait,
    released: row.released,
    position: toPosition(row),
    positionSource: toPositionSource(row.position_source),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    weatherState: toWeatherState(row),
  }
}

function toListItem(row: SessionListRow): SessionListItem {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    waterName: row.water_name,
    catchCount: toCount(row.catches),
    weatherState: toWeatherState(row),
  }
}

/**
 * Distinct water names in the given order (most recent first), at most `max`. Names that differ only
 * in case or surrounding spaces count once, in the spelling used most recently.
 */
export function distinctWaterNames(names: readonly (string | null)[], max = WATER_NAME_SUGGESTIONS_MAX): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of names) {
    const name = raw?.trim()
    if (!name) continue
    const key = name.toLocaleLowerCase('de-DE')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
    if (result.length >= max) break
  }
  return result
}

/** Distinct valid species ids in the given order (most recent first), at most `max`. */
export function distinctSpecies(species: readonly string[], max = RECENT_SPECIES_MAX): SpeciesId[] {
  const result: SpeciesId[] = []
  for (const id of species) {
    if (!isSpeciesId(id) || result.includes(id)) continue
    result.push(id)
    if (result.length >= max) break
  }
  return result
}

// ---------------------------------------------------------------------------------------------------
// Reads

/** The user's running session (at most one exists, AC-9) for the shell layout, or `null` (AC-4). */
export async function getRunningSession(): Promise<RunningSession | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('id, started_at, water_name, catches(count)')
    .is('ended_at', null)
    .maybeSingle()
  if (error) queryFailed('getRunningSession', error)
  if (!data) return null
  const row = data as Omit<SessionListRow, 'ended_at'>
  return { id: row.id, waterName: row.water_name, startedAt: row.started_at, catchCount: toCount(row.catches) }
}

/**
 * One section of the overview: newest first by start, 20 per section, catch counts from the
 * database, no positions (AC-1, EC-12). `before` is the previous section's `nextCursor`; start times
 * are unique per user (sessions cannot overlap), so they work as the cursor. An invalid `before`
 * yields an empty section.
 */
export async function listSessions(options: { before?: string } = {}): Promise<SessionPage> {
  let before: string | null = null
  if (options.before !== undefined) {
    before = parseSessionCursor(options.before)
    if (!before) return { items: [], nextCursor: null }
  }

  const supabase = await createClient()
  let query = supabase.from('sessions').select(SESSION_LIST_COLUMNS)
  if (before) query = query.lt('started_at', before)
  // one extra row tells whether an older section exists
  const { data, error } = await query.order('started_at', { ascending: false }).limit(SESSIONS_PAGE_SIZE + 1)
  if (error) queryFailed('listSessions', error)

  const rows = (data ?? []) as SessionListRow[]
  const items = rows.slice(0, SESSIONS_PAGE_SIZE).map(toListItem)
  const nextCursor = rows.length > SESSIONS_PAGE_SIZE ? items[items.length - 1].startedAt : null
  return { items, nextCursor }
}

/**
 * A session with all its fields and its catches by catch time (AC-29). `null` when the id is not a
 * UUID, the session does not exist, or it belongs to someone else (RLS hides it).
 */
export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select(SESSION_DETAIL_COLUMNS)
    .eq('id', id)
    .order('caught_at', { ascending: true, referencedTable: 'catches' })
    .order('created_at', { ascending: true, referencedTable: 'catches' })
    .maybeSingle()
  if (error) queryFailed('getSessionDetail', error)
  if (!data) return null

  const row = data as SessionDetailRow
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    waterName: row.water_name,
    note: row.note,
    position: toPosition(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    weather: toWeatherSnapshot(row),
    weatherState: toWeatherState(row),
    catches: (row.catches ?? []).map(toCatch),
  }
}

/** A catch with the minimal facts of its session, or `null` (not a UUID, gone, or not the user's). */
export async function getCatch(catchId: string): Promise<CatchWithSession | null> {
  if (!isUuid(catchId)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catches')
    .select(`${CATCH_COLUMNS}, ${WEATHER_VALUE_COLUMNS}, sessions(id, started_at, ended_at, latitude, longitude, accuracy_m)`)
    .eq('id', catchId)
    .maybeSingle()
  if (error) queryFailed('getCatch', error)
  if (!data) return null

  const row = data as unknown as CatchWithSessionRow
  const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions
  if (!session) return null
  return {
    catch: toCatch(row),
    weather: toWeatherSnapshot(row),
    session: {
      id: session.id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      hasPosition: toPosition(session) !== null,
    },
  }
}

/**
 * The user's own water names for the suggestions (AC-7, AC-34): distinct, most recently used (by
 * session start) first, at most 50. The browser filters them by word start.
 */
export async function getWaterNameSuggestions(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('water_name')
    .not('water_name', 'is', null)
    .order('started_at', { ascending: false })
    .limit(WATER_NAME_ROWS)
  if (error) queryFailed('getWaterNameSuggestions', error)
  return distinctWaterNames(((data ?? []) as { water_name: string | null }[]).map((r) => r.water_name))
}

/** Up to 3 distinct species ids from the user's last 50 catches by creation, newest first (AC-21). */
export async function getRecentSpecies(): Promise<SpeciesId[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catches')
    .select('species')
    .order('created_at', { ascending: false })
    .limit(RECENT_SPECIES_WINDOW)
  if (error) queryFailed('getRecentSpecies', error)
  return distinctSpecies(((data ?? []) as { species: string }[]).map((r) => r.species))
}

/**
 * Bait and released/taken of the most recently created catch of the session (AC-23); `null` when the
 * session has no catch yet (or is not the user's, or the id is not a UUID).
 */
export async function getCatchPrefill(sessionId: string): Promise<CatchPrefill | null> {
  if (!isUuid(sessionId)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catches')
    .select('bait, released')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) queryFailed('getCatchPrefill', error)
  if (!data) return null
  const row = data as { bait: string | null; released: boolean }
  return { bait: row.bait, released: row.released }
}
