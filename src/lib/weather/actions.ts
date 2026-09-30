'use server'

// „Fehlendes Wetter holen" — PROJ-3 design.md → „Nachholen: die Server Action …", „Anfrage an Open-Meteo"
// (AC-1 – AC-3, AC-5, AC-8 – AC-10, AC-19, AC-20, AC-23, EC-1 – EC-5, EC-7).
//
// Called by the session detail view and the catch page right after they load (automatic) and by
// „Wetter erneut abrufen" (manual). Saving a session or catch never waits for this (AC-5). For one session
// and all its catches it picks the entries with a position whose weather is pending or failed, bundles
// them per rounded position and day, asks Open-Meteo from the server (AC-23) and writes each result with
// the user's own client, so RLS checks every write a second time (AC-19). A write only lands while the
// entry is unchanged — same reference time, position still there, status still pending/failed — so a
// late answer for an old time (EC-1), a deleted entry or a removed position (EC-2) and a second device
// that was faster (EC-3) are all discarded silently. The answer carries counts only: no values, no
// positions.
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { idSchema } from '@/lib/fishing/schemas'
import { createClient } from '@/lib/supabase/server'
import { groupCandidates, parseHourlyResponse, type WeatherRequestGroup } from './core'
import { AUTO_RETRY_COOLDOWN_MS, MANUAL_RETRY_COOLDOWN_MS } from './format'
import { fetchOpenMeteo } from './open-meteo'
import type { WeatherValues } from './types'

/** At most this many entries per call; the rest is filled on the next open (design.md). */
const MAX_ENTRIES = 50
/** At most this many Open-Meteo requests at the same time. */
const MAX_PARALLEL_REQUESTS = 4

export type FillWeatherInput = { sessionId: string; manual?: boolean }
export type FillWeatherResult = { status: 'ok'; filled: number; failed: boolean } | { status: 'error' }

const inputSchema = z.object({ sessionId: idSchema, manual: z.boolean().optional() })

type Kind = 'session' | 'catch'

type EntryColumns = {
  id: string
  latitude: number | null
  longitude: number | null
  weather_status: string
  weather_attempted_at: string | null
}

type SessionRow = EntryColumns & {
  started_at: string
  catches: (EntryColumns & { caught_at: string })[] | null
}

type Candidate = {
  key: string
  kind: Kind
  id: string
  /** The reference time exactly as the database returned it — the write is conditional on it. */
  referenceTime: string
  latitude: number
  longitude: number
}

const TABLE: Record<Kind, 'sessions' | 'catches'> = { session: 'sessions', catch: 'catches' }
const TIME_COLUMN: Record<Kind, 'started_at' | 'caught_at'> = { session: 'started_at', catch: 'caught_at' }

const ENTRY_COLUMNS = 'id, latitude, longitude, weather_status, weather_attempted_at'

function logWeatherError(scope: string, error: unknown): void {
  // Kind and code only — never positions, times or ids.
  const e = error as { name?: string; code?: string; message?: string } | null
  console.error(`[weather] ${scope} failed:`, e?.name ?? 'Error', e?.code ?? '', e?.message ?? String(error))
}

/** Pending, or failed and past the cooldown (60 s automatic, 10 s on the button — EC-7). */
function isDue(entry: EntryColumns, now: Date, manual: boolean): boolean {
  if (entry.latitude === null || entry.longitude === null) return false
  if (entry.weather_status !== 'pending' && entry.weather_status !== 'failed') return false
  if (entry.weather_attempted_at === null) return true
  const cooldown = manual ? MANUAL_RETRY_COOLDOWN_MS : AUTO_RETRY_COOLDOWN_MS
  return now.getTime() - new Date(entry.weather_attempted_at).getTime() >= cooldown
}

/** The session first, then its catches by catch time; at most MAX_ENTRIES. */
function pickCandidates(session: SessionRow, now: Date, manual: boolean): Candidate[] {
  const entries: { kind: Kind; row: EntryColumns; time: string }[] = [
    { kind: 'session', row: session, time: session.started_at },
    ...(session.catches ?? []).map((c) => ({ kind: 'catch' as const, row: c, time: c.caught_at })),
  ]
  return entries
    .filter((e) => isDue(e.row, now, manual))
    .slice(0, MAX_ENTRIES)
    .map((e) => ({
      key: `${e.kind}:${e.row.id}`,
      kind: e.kind,
      id: e.row.id,
      referenceTime: e.time,
      latitude: e.row.latitude!,
      longitude: e.row.longitude!,
    }))
}

/** Runs `task` over `items` with at most `limit` running at once, results in input order. */
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function valueColumns(values: WeatherValues) {
  return {
    weather_temperature_c: values.temperatureC,
    weather_pressure_hpa: values.pressureHpa,
    weather_wind_speed_kmh: values.windSpeedKmh,
    weather_wind_direction_deg: values.windDirectionDeg,
    weather_cloud_cover_pct: values.cloudCoverPct,
    weather_precipitation_mm: values.precipitationMm,
    weather_code: values.weatherCode,
  }
}

/**
 * Writes one result — only while the entry is unchanged (EC-1 – EC-3). Returns whether a row was written;
 * a refused or failed write counts as „not written" and is never shown to the user.
 */
async function writeResult(
  supabase: SupabaseClient,
  userId: string,
  candidate: Candidate,
  hour: Date,
  values: WeatherValues | null,
  now: Date,
): Promise<boolean> {
  const stamp = now.toISOString()
  const changes = values
    ? {
        weather_status: 'ok',
        weather_hour: hour.toISOString(),
        ...valueColumns(values),
        weather_fetched_at: stamp,
        weather_attempted_at: stamp,
      }
    : { weather_status: 'failed', weather_attempted_at: stamp }

  const { data, error } = await supabase
    .from(TABLE[candidate.kind])
    .update(changes)
    .eq('id', candidate.id)
    .eq('user_id', userId)
    .eq(TIME_COLUMN[candidate.kind], candidate.referenceTime)
    .not('latitude', 'is', null)
    .in('weather_status', ['pending', 'failed'])
    .select('id')
  if (error) {
    logWeatherError('write-weather', error)
    return false
  }
  return Array.isArray(data) && data.length > 0
}

export async function fillMissingWeather(input: FillWeatherInput): Promise<FillWeatherResult> {
  const user = await requireUser()
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error' }
  const { sessionId } = parsed.data
  const manual = parsed.data.manual === true

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sessions')
      .select(`${ENTRY_COLUMNS}, started_at, catches(${ENTRY_COLUMNS}, caught_at)`)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .order('caught_at', { ascending: true, referencedTable: 'catches' })
      .maybeSingle()
    if (error) throw error
    // Someone else's or deleted: nothing to do, and no hint whether it exists (AC-19, EC-2).
    if (!data) return { status: 'ok', filled: 0, failed: false }

    const now = new Date()
    const candidates = pickCandidates(data as SessionRow, now, manual)
    if (candidates.length === 0) return { status: 'ok', filled: 0, failed: false }

    const byKey = new Map(candidates.map((c) => [c.key, c]))
    const groups = groupCandidates(
      candidates.map((c) => ({
        key: c.key,
        latitude: c.latitude,
        longitude: c.longitude,
        referenceTime: new Date(c.referenceTime),
      })),
      now,
    )

    const outcomes = await mapLimited(groups, MAX_PARALLEL_REQUESTS, async (group: WeatherRequestGroup) => {
      const response = await fetchOpenMeteo(group)
      return Promise.all(
        group.members.map(async (member) => {
          const values = response.ok ? parseHourlyResponse(response.json, member.hour) : null
          const written = await writeResult(supabase, user.id, byKey.get(member.key)!, member.hour, values, now)
          return { ok: values !== null, written }
        }),
      )
    })

    const all = outcomes.flat()
    const filled = all.filter((o) => o.ok && o.written).length
    const failed = all.some((o) => !o.ok)
    if (all.some((o) => o.written)) revalidatePath('/', 'layout')
    return { status: 'ok', filled, failed }
  } catch (e) {
    logWeatherError('fill-missing-weather', e)
    return { status: 'error' }
  }
}
