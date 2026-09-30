// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A fake PostgREST query builder: every call is recorded, awaiting it yields the queued result.
type Result = { data: unknown; error: unknown }
type Call = { table: string; method: string; args: unknown[] }

const calls: Call[] = []
let results: Result[] = []
const from = vi.fn((table: string) => {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'is', 'not', 'lt', 'order', 'limit', 'maybeSingle']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ table, method, args })
      return builder
    }
  }
  builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(results.shift() ?? { data: null, error: null }).then(resolve, reject)
  return builder
})

const requireUser = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from }) }))
vi.mock('@/lib/auth/require-user', () => ({ requireUser: () => requireUser() }))
vi.spyOn(console, 'error').mockImplementation(() => undefined)

const q = await import('./queries')
const { loadMoreSessions } = await import('./actions/overview')

const UUID = '3f2b8c1e-4d5a-4b6c-8e7f-1a2b3c4d5e6f'

function reply(...queued: Result[]) {
  results = queued
}

function called(method: string) {
  return calls.filter((c) => c.method === method).map((c) => c.args)
}

const WEATHER_STATE_ROW = {
  weather_status: 'pending',
  weather_requested_at: '2026-09-30T10:00:00+00:00',
  weather_attempted_at: null,
}
const WEATHER_STATE = { status: 'pending', requestedAt: '2026-09-30T10:00:00+00:00', attemptedAt: null }
const NO_WEATHER_VALUES = {
  weather_hour: null, weather_temperature_c: null, weather_pressure_hpa: null, weather_wind_speed_kmh: null,
  weather_wind_direction_deg: null, weather_cloud_cover_pct: null, weather_precipitation_mm: null,
  weather_code: null, weather_fetched_at: null,
}

function sessionRow(i: number) {
  const started = new Date(Date.UTC(2026, 8, 30, 12) - i * 3_600_000).toISOString().replace('.000Z', '+00:00')
  return { id: `id-${i}`, started_at: started, ended_at: null, water_name: null, ...WEATHER_STATE_ROW, catches: [{ count: i }] }
}

beforeEach(() => {
  calls.length = 0
  results = []
  from.mockClear()
  requireUser.mockReset().mockResolvedValue({ id: 'user-1' })
})

describe('UUID guard — not found is null, never a database call', () => {
  it('returns null for ids that are not UUIDs', async () => {
    expect(await q.getSessionDetail('abc')).toBeNull()
    expect(await q.getCatch("1' or 1=1")).toBeNull()
    expect(await q.getCatchPrefill('')).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('returns null when RLS hides the row (no data)', async () => {
    reply({ data: null, error: null }, { data: null, error: null }, { data: null, error: null })
    expect(await q.getSessionDetail(UUID)).toBeNull()
    expect(await q.getCatch(UUID)).toBeNull()
    expect(await q.getCatchPrefill(UUID)).toBeNull()
  })

  it('throws on a database error instead of returning null', async () => {
    reply({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(q.getSessionDetail(UUID)).rejects.toThrow(/getSessionDetail failed: 42501/)
  })
})

describe('getSessionDetail (AC-29)', () => {
  it('maps the session with position and orders catches by catch time', async () => {
    reply({
      data: {
        id: UUID,
        started_at: '2026-09-30T10:00:00+00:00',
        ended_at: null,
        water_name: 'Müritz',
        note: null,
        latitude: 54.1,
        longitude: 13.4,
        accuracy_m: 12,
        created_at: 'c',
        updated_at: 'u',
        weather_status: 'ok',
        weather_requested_at: '2026-09-30T10:00:00+00:00',
        weather_attempted_at: '2026-09-30T10:00:05+00:00',
        weather_hour: '2026-09-30T10:00:00+00:00',
        weather_temperature_c: 11.4,
        weather_pressure_hpa: '1018.2',
        weather_wind_speed_kmh: 14,
        weather_wind_direction_deg: 225,
        weather_cloud_cover_pct: 60,
        weather_precipitation_mm: 0,
        weather_code: null,
        weather_fetched_at: '2026-09-30T10:00:05+00:00',
        catches: [
          {
            id: 'c1', session_id: UUID, caught_at: '2026-09-30T10:05:00+00:00', species: 'pike', species_other: null,
            length_cm: 60, weight_g: null, bait: 'Gummi', released: true,
            latitude: null, longitude: null, accuracy_m: null, position_source: 'none', created_at: 'c', updated_at: 'u',
            weather_status: 'no_position', weather_requested_at: '2026-09-30T10:05:00+00:00', weather_attempted_at: null,
          },
        ],
      },
      error: null,
    })
    const detail = await q.getSessionDetail(UUID)
    expect(detail?.position).toEqual({ latitude: 54.1, longitude: 13.4, accuracy: 12 })
    expect(detail?.catches[0]).toMatchObject({ species: 'pike', lengthCm: 60, position: null, positionSource: 'none' })
    // PROJ-3: full snapshot for the session (numeric strings accepted), state only for the catches
    expect(detail?.weather).toEqual({
      status: 'ok',
      hour: '2026-09-30T10:00:00+00:00',
      fetchedAt: '2026-09-30T10:00:05+00:00',
      values: {
        temperatureC: 11.4, pressureHpa: 1018.2, windSpeedKmh: 14, windDirectionDeg: 225,
        cloudCoverPct: 60, precipitationMm: 0, weatherCode: null,
      },
    })
    expect(detail?.weatherState).toEqual({
      status: 'ok', requestedAt: '2026-09-30T10:00:00+00:00', attemptedAt: '2026-09-30T10:00:05+00:00',
    })
    expect(detail?.catches[0].weatherState).toEqual({
      status: 'no_position', requestedAt: '2026-09-30T10:05:00+00:00', attemptedAt: null,
    })
    const [columns] = called('select')[0] as [string]
    expect(columns).toContain('weather_temperature_c')
    expect(columns).toMatch(/catches\([^)]*weather_status[^)]*\)/)
    expect(columns).not.toMatch(/catches\([^)]*weather_temperature_c/)
    expect(called('order')).toEqual([
      ['caught_at', { ascending: true, referencedTable: 'catches' }],
      ['created_at', { ascending: true, referencedTable: 'catches' }],
    ])
  })
})

describe('listSessions and the cursor (AC-1, EC-12)', () => {
  it('returns 20 items and a cursor when an older section exists', async () => {
    reply({ data: Array.from({ length: 21 }, (_, i) => sessionRow(i)), error: null })
    const page = await q.listSessions()
    expect(page.items).toHaveLength(20)
    expect(page.items[3]).toEqual({
      id: 'id-3', startedAt: sessionRow(3).started_at, endedAt: null, waterName: null, catchCount: 3,
      weatherState: WEATHER_STATE,
    })
    expect(page.nextCursor).toBe(sessionRow(19).started_at)
    expect(called('limit')).toEqual([[21]])
    expect(called('order')).toEqual([['started_at', { ascending: false }]])
    expect(called('lt')).toEqual([])
  })

  it('selects no position columns and no weather values, only the weather state (PROJ-3 AC-17)', async () => {
    reply({ data: [], error: null })
    await q.listSessions()
    const [columns] = called('select')[0] as [string]
    expect(columns).not.toMatch(/latitude|longitude|accuracy/)
    expect(columns).toContain('catches(count)')
    expect(columns).toContain('weather_status')
    expect(columns).toContain('weather_requested_at')
    expect(columns).not.toMatch(/weather_(temperature|pressure|wind|cloud|precipitation|code|hour)/)
  })

  it('has no cursor on the last section and filters by the normalised cursor', async () => {
    reply({ data: [sessionRow(1)], error: null })
    const page = await q.listSessions({ before: '2026-09-30T14:00:00+02:00' })
    expect(page.nextCursor).toBeNull()
    expect(called('lt')).toEqual([['started_at', '2026-09-30T12:00:00.000Z']])
  })

  it('parses only ISO timestamps with offset', () => {
    expect(q.parseSessionCursor('2026-09-30T12:00:00Z')).toBe('2026-09-30T12:00:00.000Z')
    expect(q.parseSessionCursor('2026-09-30T12:00:00+00:00')).toBe('2026-09-30T12:00:00.000Z')
    expect(q.parseSessionCursor('2026-09-30T12:00:00')).toBeNull()
    expect(q.parseSessionCursor('2026-09-30')).toBeNull()
    expect(q.parseSessionCursor('x); drop table sessions')).toBeNull()
    expect(q.parseSessionCursor(42)).toBeNull()
  })
})

describe('loadMoreSessions', () => {
  it('checks the login before anything else', async () => {
    requireUser.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(loadMoreSessions('2026-09-30T12:00:00Z')).rejects.toThrow('NEXT_REDIRECT')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects an invalid cursor without a database call', async () => {
    expect(await loadMoreSessions('yesterday')).toEqual({ status: 'error', message: 'Bitte prüfe deine Eingaben.' })
    expect(from).not.toHaveBeenCalled()
  })

  it('returns the next section, or the network message on a database error', async () => {
    reply({ data: [sessionRow(1)], error: null })
    const ok = await loadMoreSessions('2026-09-30T12:00:00Z')
    expect(ok).toMatchObject({ status: 'ok', page: { nextCursor: null } })

    reply({ data: null, error: { code: '08006', message: 'down' } })
    expect(await loadMoreSessions('2026-09-30T12:00:00Z')).toEqual({
      status: 'error',
      message: 'Keine Verbindung. Bitte versuche es erneut.',
    })
  })
})

describe('getWaterNameSuggestions (AC-7, AC-34)', () => {
  it('dedupes case-insensitively, keeps the most recent spelling and order, at most 50', async () => {
    reply({ data: [{ water_name: 'Müritz' }, { water_name: 'Bodden' }, { water_name: ' müritz ' }, { water_name: 'Elbe' }], error: null })
    expect(await q.getWaterNameSuggestions()).toEqual(['Müritz', 'Bodden', 'Elbe'])
    expect(called('order')).toEqual([['started_at', { ascending: false }]])

    const many = Array.from({ length: 80 }, (_, i) => `See ${i}`)
    expect(q.distinctWaterNames(many)).toHaveLength(50)
    expect(q.distinctWaterNames(['', null, '  '])).toEqual([])
  })
})

describe('getRecentSpecies (AC-21)', () => {
  it('returns up to 3 distinct ids from the last 50 catches, newest first; "other" counts once', async () => {
    reply({ data: ['other', 'pike', 'other', 'perch', 'pike', 'zander'].map((species) => ({ species })), error: null })
    expect(await q.getRecentSpecies()).toEqual(['other', 'pike', 'perch'])
    expect(called('order')).toEqual([['created_at', { ascending: false }]])
    expect(called('limit')).toEqual([[50]])
    expect(q.distinctSpecies(['shark', 'eel'])).toEqual(['eel'])
  })
})

describe('getCatchPrefill (AC-23) and getCatch', () => {
  it('reads bait and released from the most recently created catch of the session', async () => {
    reply({ data: { bait: 'Wurm', released: false }, error: null })
    expect(await q.getCatchPrefill(UUID)).toEqual({ bait: 'Wurm', released: false })
    expect(called('eq')).toEqual([['session_id', UUID]])
    expect(called('order')).toEqual([['created_at', { ascending: false }]])
  })

  it('returns the catch with whether its session has a position', async () => {
    reply({
      data: {
        id: UUID, session_id: 's1', caught_at: 't', species: 'other', species_other: 'Rapfen', length_cm: 40,
        weight_g: 800, bait: null, released: false, latitude: 1, longitude: 2, accuracy_m: 3, position_source: 'session',
        created_at: 'c', updated_at: 'u',
        ...WEATHER_STATE_ROW,
        weather_status: 'failed',
        ...NO_WEATHER_VALUES,
        sessions: { id: 's1', started_at: 'a', ended_at: 'b', latitude: null, longitude: null, accuracy_m: null },
      },
      error: null,
    })
    const result = await q.getCatch(UUID)
    expect(result?.catch).toMatchObject({ speciesOther: 'Rapfen', positionSource: 'session', position: { latitude: 1, longitude: 2, accuracy: 3 } })
    expect(result?.session).toEqual({ id: 's1', startedAt: 'a', endedAt: 'b', hasPosition: false })
    // PROJ-3 AC-15: the catch page reads the full snapshot; values only when the status is ok
    expect(result?.weather).toEqual({ status: 'failed', hour: null, values: null, fetchedAt: null })
    expect(result?.catch.weatherState.status).toBe('failed')
    const [columns] = called('select')[0] as [string]
    expect(columns).toContain('weather_temperature_c')
  })

  it('never shows values for a status other than ok, and maps an unknown status to pending', async () => {
    reply({
      data: {
        id: UUID, session_id: 's1', caught_at: 't', species: 'pike', species_other: null, length_cm: 40,
        weight_g: null, bait: null, released: true, latitude: 1, longitude: 2, accuracy_m: 3, position_source: 'gps',
        created_at: 'c', updated_at: 'u',
        ...WEATHER_STATE_ROW,
        weather_status: 'weird',
        ...NO_WEATHER_VALUES,
        weather_temperature_c: 12,
        sessions: { id: 's1', started_at: 'a', ended_at: 'b', latitude: 1, longitude: 2, accuracy_m: 3 },
      },
      error: null,
    })
    const result = await q.getCatch(UUID)
    expect(result?.weather).toEqual({ status: 'pending', hour: null, values: null, fetchedAt: null })
  })
})
