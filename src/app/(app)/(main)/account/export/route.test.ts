// @vitest-environment node
// Export route — PROJ-2: AC-35 (version 2: sessions and catches), PROJ-3: AC-21 (version 3: weather per entry).
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: unknown }

const calls: { table: string; method: string; args: unknown[] }[] = []
let results: Record<string, Result> = {}

// A chainable stand-in for the query builder: records every call, resolves to the table's result.
function builder(table: string) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'overrideTypes']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args })
      return chain
    }
  }
  chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(results[table]).then(resolve, reject)
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (table: string) => builder(table) }),
}))
vi.mock('@/lib/auth/require-user', () => ({
  requireUser: async () => ({
    id: 'user-1',
    email: 'angler@example.com',
    created_at: '2026-09-01T08:00:00Z',
    email_confirmed_at: '2026-09-01T08:05:00Z',
    last_sign_in_at: '2026-09-30T06:00:00Z',
  }),
}))

const { GET } = await import('./route')

// The weather columns as the select returns them (weather_requested_at / weather_attempted_at are never asked for).
const okWeather = {
  weather_status: 'ok',
  weather_hour: '2026-09-29T17:00:00+00:00',
  weather_temperature_c: 14.5,
  weather_pressure_hpa: 1013.2,
  weather_wind_speed_kmh: 18.4,
  weather_wind_direction_deg: 270,
  weather_cloud_cover_pct: 75,
  weather_precipitation_mm: 0,
  weather_code: 3,
  weather_fetched_at: '2026-09-29T17:11:04.5+00:00',
}

const noWeather = (status: string) => ({
  weather_status: status,
  weather_hour: null,
  weather_temperature_c: null,
  weather_pressure_hpa: null,
  weather_wind_speed_kmh: null,
  weather_wind_direction_deg: null,
  weather_cloud_cover_pct: null,
  weather_precipitation_mm: null,
  weather_code: null,
  weather_fetched_at: null,
})

// A row without its flat weather_* columns — what the export keeps next to the nested `weather` object.
const withoutWeather = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('weather_')))

const catchRow = (over: Record<string, unknown>) => ({
  id: 'c-1',
  caught_at: '2026-09-29T17:10:00+00:00',
  species: 'pike',
  species_other: null,
  length_cm: 64,
  weight_g: 1800,
  bait: 'Gummifisch',
  released: true,
  latitude: 54.1,
  longitude: 13.4,
  accuracy_m: 12,
  position_source: 'gps',
  created_at: '2026-09-29T17:11:02.123+00:00',
  updated_at: '2026-09-29T17:11:02.123+00:00',
  ...okWeather,
  ...over,
})

const sessionRows = [
  {
    id: 's-2',
    started_at: '2026-09-29T16:00:00+00:00',
    ended_at: '2026-09-29T19:30:00+00:00',
    water_name: 'Peenestrom',
    note: 'Wind aus West',
    latitude: 54.1,
    longitude: 13.4,
    accuracy_m: 12,
    created_at: '2026-09-29T16:00:05+00:00',
    updated_at: '2026-09-29T19:30:01+00:00',
    ...okWeather,
    weather_hour: '2026-09-29T16:00:00+00:00',
    weather_fetched_at: '2026-09-29T16:00:06+00:00',
    catches: [
      catchRow({}),
      catchRow({
        id: 'c-2',
        caught_at: '2026-09-29T18:00:00+00:00',
        species: 'other',
        species_other: 'Rapfen',
        weight_g: null,
        bait: null,
        latitude: null,
        longitude: null,
        accuracy_m: null,
        position_source: 'none',
        ...noWeather('no_position'),
      }),
    ],
  },
  {
    id: 's-1',
    started_at: '2026-09-20T05:00:00+00:00',
    ended_at: null,
    water_name: null,
    note: null,
    latitude: null,
    longitude: null,
    accuracy_m: null,
    created_at: '2026-09-20T05:00:03+00:00',
    updated_at: '2026-09-20T05:00:03+00:00',
    ...noWeather('failed'),
    catches: [],
  },
]

beforeEach(() => {
  calls.length = 0
  results = {
    profiles: { data: { id: 'user-1', created_at: '2026-09-01T08:00:00+00:00' }, error: null },
    sessions: { data: sessionRows, error: null },
  }
})

describe('GET /account/export — version 3 (PROJ-2 AC-35, PROJ-3 AC-21)', () => {
  it('keeps account and profile from version 1 and adds all sessions with their catches', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.format).toBe('petrilog-export')
    expect(body.version).toBe(3)
    expect(body.account).toEqual({
      email: 'angler@example.com',
      created_at: '2026-09-01T08:00:00Z',
      email_confirmed_at: '2026-09-01T08:05:00Z',
      last_sign_in_at: '2026-09-30T06:00:00Z',
    })
    expect(body.profile).toEqual({ id: 'user-1', created_at: '2026-09-01T08:00:00+00:00' })

    expect(body.sessions.map((s: { id: string }) => s.id)).toEqual(['s-2', 's-1'])
    const { catches, weather, ...session } = body.sessions[0]
    const { catches: sourceCatches, ...sourceSession } = sessionRows[0]
    expect(session).toEqual(withoutWeather(sourceSession))
    expect(weather.status).toBe('ok')
    expect(sourceCatches).toHaveLength(2)
    expect(catches).toHaveLength(2)
    const { weather: catchWeather, ...firstCatch } = catches[0]
    expect(firstCatch).toEqual({ ...withoutWeather(catchRow({})), species_label: 'Hecht' })
    expect(catchWeather.status).toBe('ok')
    expect(catches[1]).toMatchObject({ species: 'other', species_label: 'Sonstige', species_other: 'Rapfen' })
    expect(catches[1].position_source).toBe('none')
    expect(body.sessions[1].catches).toEqual([])
    expect(body.sessions[1].ended_at).toBeNull()
  })

  it('nests the full weather snapshot with its German label when the status is ok (AC-21)', async () => {
    const body = await (await GET()).json()
    expect(body.sessions[0].weather).toEqual({
      status: 'ok',
      hour: '2026-09-29T16:00:00+00:00',
      temperature_c: 14.5,
      pressure_hpa: 1013.2,
      wind_speed_kmh: 18.4,
      wind_direction_deg: 270,
      cloud_cover_pct: 75,
      precipitation_mm: 0,
      weather_code: 3,
      weather_label: 'Bewölkt',
      fetched_at: '2026-09-29T16:00:06+00:00',
    })
    expect(body.sessions[0].catches[0].weather).toMatchObject({
      status: 'ok',
      hour: '2026-09-29T17:00:00+00:00',
      weather_label: 'Bewölkt',
      fetched_at: '2026-09-29T17:11:04.5+00:00',
    })
  })

  it('writes only the status when there is no weather (failed, no_position, pending)', async () => {
    let body = await (await GET()).json()
    expect(body.sessions[0].catches[1].weather).toEqual({ status: 'no_position' })
    expect(body.sessions[1].weather).toEqual({ status: 'failed' })

    results.sessions = { data: [{ ...sessionRows[1], ...noWeather('pending') }], error: null }
    body = await (await GET()).json()
    expect(body.sessions[0].weather).toEqual({ status: 'pending' })
  })

  it('never writes the flat weather_* columns or the internal fill-in state', async () => {
    const text = await (await GET()).text()
    expect(text).not.toContain('weather_requested_at')
    expect(text).not.toContain('weather_attempted_at')
    expect(text).not.toContain('requested_at')
    expect(text).not.toContain('attempted_at')
    expect(text).not.toContain('"weather_status"')
    expect(text).not.toContain('"weather_temperature_c"')
    expect(text).not.toContain('"weather_hour"')
    expect(text).not.toContain('"weather_fetched_at"')

    const select = calls.find((c) => c.table === 'sessions' && c.method === 'select')
    const columns = String(select!.args[0])
    expect(columns).not.toMatch(/weather_requested_at|weather_attempted_at/)
    const [sessionPart, catchPart] = columns.split('catches (')
    for (const part of [sessionPart, catchPart]) {
      for (const column of [
        'weather_status',
        'weather_hour',
        'weather_temperature_c',
        'weather_pressure_hpa',
        'weather_wind_speed_kmh',
        'weather_wind_direction_deg',
        'weather_cloud_cover_pct',
        'weather_precipitation_mm',
        'weather_code',
        'weather_fetched_at',
      ]) {
        expect(part).toContain(column)
      }
    }
  })

  it('turns numeric strings from the database into numbers and an unknown code into a null label', async () => {
    results.sessions = {
      data: [
        {
          ...sessionRows[1],
          ...okWeather,
          weather_temperature_c: '-3.5',
          weather_pressure_hpa: '1002.0',
          weather_wind_speed_kmh: '7.2',
          weather_precipitation_mm: '1.4',
          weather_code: 42,
          catches: [catchRow({ weather_temperature_c: '0.0', weather_code: '61' })],
        },
      ],
      error: null,
    }
    const body = await (await GET()).json()
    expect(body.sessions[0].weather).toMatchObject({
      temperature_c: -3.5,
      pressure_hpa: 1002,
      wind_speed_kmh: 7.2,
      precipitation_mm: 1.4,
      weather_code: 42,
      weather_label: null,
    })
    expect(body.sessions[0].catches[0].weather).toMatchObject({
      temperature_c: 0,
      weather_code: 61,
      weather_label: 'Leichter Regen',
    })
  })

  it('keeps missing single values of an ok snapshot as null', async () => {
    results.sessions = {
      data: [{ ...sessionRows[1], ...okWeather, weather_pressure_hpa: null, weather_code: null }],
      error: null,
    }
    const body = await (await GET()).json()
    expect(body.sessions[0].weather).toMatchObject({
      status: 'ok',
      pressure_hpa: null,
      weather_code: null,
      weather_label: null,
    })
  })

  it('keeps timestamps exactly as the database returns them (ISO with time zone)', async () => {
    const body = await (await GET()).json()
    expect(body.sessions[0].started_at).toBe('2026-09-29T16:00:00+00:00')
    expect(body.sessions[0].catches[0].caught_at).toBe('2026-09-29T17:10:00+00:00')
    expect(body.sessions[0].catches[0].created_at).toBe('2026-09-29T17:11:02.123+00:00')
    expect(body.sessions[0].weather.hour).toBe('2026-09-29T16:00:00+00:00')
    expect(body.sessions[0].catches[0].weather.fetched_at).toBe('2026-09-29T17:11:04.5+00:00')
  })

  it('never asks for or writes out user_id or session_id', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).not.toContain('user_id')
    expect(text).not.toContain('session_id')

    const select = calls.find((c) => c.table === 'sessions' && c.method === 'select')
    expect(select).toBeDefined()
    const columns = String(select!.args[0])
    expect(columns).not.toMatch(/user_id|session_id/)
    expect(columns).toMatch(/catches \(.*position_source.*\)/)
    for (const column of ['started_at', 'ended_at', 'water_name', 'note', 'accuracy_m', 'updated_at']) {
      expect(columns).toContain(column)
    }
  })

  it('loads sessions and catches in one query: sessions newest first, catches by catch time', async () => {
    await GET()
    const sessionCalls = calls.filter((c) => c.table === 'sessions')
    expect(sessionCalls.filter((c) => c.method === 'select')).toHaveLength(1)
    expect(calls.filter((c) => c.table === 'catches')).toHaveLength(0)
    expect(sessionCalls).toContainEqual({ table: 'sessions', method: 'eq', args: ['user_id', 'user-1'] })
    const orders = sessionCalls.filter((c) => c.method === 'order').map((c) => c.args)
    expect(orders[0]).toEqual(['started_at', { ascending: false }])
    expect(orders[1]).toEqual(['caught_at', { ascending: true, referencedTable: 'catches' }])
  })

  it('exports an empty session list for a user without sessions', async () => {
    results.sessions = { data: [], error: null }
    const body = await (await GET()).json()
    expect(body.sessions).toEqual([])
  })

  it('answers with the German error text when a query fails', async () => {
    results.sessions = { data: null, error: { message: 'boom' } }
    let response = await GET()
    expect(response.status).toBe(500)
    expect(await response.text()).toBe('Export fehlgeschlagen. Bitte versuche es erneut.')

    results.sessions = { data: sessionRows, error: null }
    results.profiles = { data: null, error: { message: 'boom' } }
    response = await GET()
    expect(response.status).toBe(500)
  })

  it('sends the file as a dated, never cached download', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="petrilog-export-\d{4}-\d{2}-\d{2}\.json"$/
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
