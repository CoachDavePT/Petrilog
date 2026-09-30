// @vitest-environment node
// Tests for „fehlendes Wetter holen" — PROJ-3 design.md → „Nachholen: die Server Action …"
// (AC-1 – AC-3, AC-8 – AC-10, AC-19, AC-20, EC-1 – EC-5, EC-7).
import { beforeEach, describe, expect, it, vi } from 'vitest'

// A fake PostgREST builder per `from()` call: records its calls; awaiting yields the next queued result.
type Result = { data: unknown; error: unknown }
type Builder = { table: string; calls: { method: string; args: unknown[] }[] }

const builders: Builder[] = []
let readResult: Result = { data: null, error: null }
let writeResult: (b: Builder) => Result = () => ({ data: [{ id: 'x' }], error: null })

const from = vi.fn((table: string) => {
  const record: Builder = { table, calls: [] }
  builders.push(record)
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'update', 'not', 'in']) {
    builder[method] = (...args: unknown[]) => {
      record.calls.push({ method, args })
      return builder
    }
  }
  builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => {
    const isWrite = record.calls.some((c) => c.method === 'update')
    return Promise.resolve(isWrite ? writeResult(record) : readResult).then(resolve, reject)
  }
  return builder
})

const requireUser = vi.fn()
const fetchOpenMeteo = vi.fn()
const revalidatePath = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from }) }))
vi.mock('@/lib/auth/require-user', () => ({ requireUser: () => requireUser() }))
vi.mock('./open-meteo', () => ({ fetchOpenMeteo: (...a: unknown[]) => fetchOpenMeteo(...a) }))
vi.spyOn(console, 'error').mockImplementation(() => undefined)

const { fillMissingWeather } = await import('./actions')

const USER = 'user-1'
const SESSION = '3f2b8c1e-4d5a-4b6c-8e7f-1a2b3c4d5e6f'
const NOW = new Date('2026-09-30T12:00:00Z')

type Entry = {
  id: string
  latitude: number | null
  longitude: number | null
  weather_status: string
  weather_attempted_at: string | null
}

function session(overrides: Partial<Entry> = {}, catches: (Entry & { caught_at: string })[] = []) {
  return {
    id: SESSION,
    started_at: '2026-09-30T08:10:00+00:00',
    latitude: 54.08512,
    longitude: 13.38741,
    weather_status: 'pending',
    weather_attempted_at: null,
    ...overrides,
    catches,
  }
}

function catchRow(i: number, overrides: Partial<Entry & { caught_at: string }> = {}) {
  return {
    id: `c-${i}`,
    caught_at: `2026-09-30T09:${String(10 + i).padStart(2, '0')}:00+00:00`,
    latitude: 54.08512,
    longitude: 13.38741,
    weather_status: 'pending',
    weather_attempted_at: null,
    ...overrides,
  }
}

/** Open-Meteo answer with every hour of the day and plausible values. */
function openMeteoDay(day = '2026-09-30') {
  const time = Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00`)
  const series = (v: number) => time.map(() => v)
  return {
    ok: true,
    json: {
      hourly: {
        time,
        temperature_2m: series(11.4),
        pressure_msl: series(1018.2),
        wind_speed_10m: series(14),
        wind_direction_10m: series(225),
        cloud_cover: series(60),
        precipitation: series(0),
        weather_code: series(2),
      },
    },
  }
}

const writes = () => builders.filter((b) => b.calls.some((c) => c.method === 'update'))
const updateOf = (b: Builder) => b.calls.find((c) => c.method === 'update')!.args[0] as Record<string, unknown>
const callsOf = (b: Builder, method: string) => b.calls.filter((c) => c.method === method).map((c) => c.args)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  builders.length = 0
  from.mockClear()
  fetchOpenMeteo.mockReset().mockResolvedValue(openMeteoDay())
  revalidatePath.mockReset()
  requireUser.mockReset().mockResolvedValue({ id: USER })
  readResult = { data: session(), error: null }
  writeResult = () => ({ data: [{ id: 'x' }], error: null })
})

describe('guards', () => {
  it('checks the login before anything else', async () => {
    requireUser.mockRejectedValue(new Error('NEXT_REDIRECT'))
    await expect(fillMissingWeather({ sessionId: SESSION })).rejects.toThrow('NEXT_REDIRECT')
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a malformed session id without a database call', async () => {
    expect(await fillMissingWeather({ sessionId: 'abc' })).toEqual({ status: 'error' })
    expect(await fillMissingWeather(null as never)).toEqual({ status: 'error' })
    expect(from).not.toHaveBeenCalled()
  })

  it('reads the session as „id + owner" and does nothing for a foreign or deleted one (AC-19, EC-2)', async () => {
    readResult = { data: null, error: null }
    expect(await fillMissingWeather({ sessionId: SESSION })).toEqual({ status: 'ok', filled: 0, failed: false })
    expect(callsOf(builders[0], 'eq')).toEqual([['id', SESSION], ['user_id', USER]])
    expect(fetchOpenMeteo).not.toHaveBeenCalled()
  })

  it('answers with an error on a database error, never throws it', async () => {
    readResult = { data: null, error: { code: '08006', message: 'down' } }
    expect(await fillMissingWeather({ sessionId: SESSION })).toEqual({ status: 'error' })
  })
})

describe('fetching and writing (AC-1 – AC-3, AC-20, EC-5)', () => {
  it('bundles the session and its catches at the same place and day into one request', async () => {
    readResult = { data: session({}, [catchRow(1), catchRow(2)]), error: null }
    const result = await fillMissingWeather({ sessionId: SESSION })

    expect(result).toEqual({ status: 'ok', filled: 3, failed: false })
    expect(fetchOpenMeteo).toHaveBeenCalledTimes(1)
    const group = fetchOpenMeteo.mock.calls[0][0]
    // only the rounded position leaves the server (AC-20)
    expect(group).toMatchObject({ latitude: 54.09, longitude: 13.39, endpoint: 'forecast' })
    expect(JSON.stringify(group)).not.toContain('54.085')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('writes the values of the nearest full hour, only while the entry is unchanged (EC-1 – EC-3)', async () => {
    readResult = { data: session({}, [catchRow(25)]), error: null } // catch at 09:35 → 10:00
    await fillMissingWeather({ sessionId: SESSION })

    const [sessionWrite, catchWrite] = writes()
    expect(sessionWrite.table).toBe('sessions')
    expect(updateOf(sessionWrite)).toEqual({
      weather_status: 'ok',
      weather_hour: '2026-09-30T08:00:00.000Z',
      weather_temperature_c: 11.4,
      weather_pressure_hpa: 1018.2,
      weather_wind_speed_kmh: 14,
      weather_wind_direction_deg: 225,
      weather_cloud_cover_pct: 60,
      weather_precipitation_mm: 0,
      weather_code: 2,
      weather_fetched_at: NOW.toISOString(),
      weather_attempted_at: NOW.toISOString(),
    })
    expect(callsOf(sessionWrite, 'eq')).toEqual([
      ['id', SESSION],
      ['user_id', USER],
      ['started_at', '2026-09-30T08:10:00+00:00'],
    ])
    expect(callsOf(sessionWrite, 'not')).toEqual([['latitude', 'is', null]])
    expect(callsOf(sessionWrite, 'in')).toEqual([['weather_status', ['pending', 'failed']]])

    expect(catchWrite.table).toBe('catches')
    expect(updateOf(catchWrite).weather_hour).toBe('2026-09-30T10:00:00.000Z')
    expect(callsOf(catchWrite, 'eq')).toContainEqual(['caught_at', '2026-09-30T09:35:00+00:00'])
  })

  it('does not count an entry that changed meanwhile, and shows no error (EC-1, EC-2, EC-3)', async () => {
    writeResult = () => ({ data: [], error: null })
    expect(await fillMissingWeather({ sessionId: SESSION })).toEqual({ status: 'ok', filled: 0, failed: false })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('skips entries without a position, with weather, or without a need (AC-7)', async () => {
    readResult = {
      data: session({ weather_status: 'ok' }, [
        catchRow(1, { latitude: null, longitude: null, weather_status: 'no_position' }),
        catchRow(2, { weather_status: 'ok' }),
      ]),
      error: null,
    }
    expect(await fillMissingWeather({ sessionId: SESSION })).toEqual({ status: 'ok', filled: 0, failed: false })
    expect(fetchOpenMeteo).not.toHaveBeenCalled()
    expect(writes()).toHaveLength(0)
  })

  it('takes at most 50 entries per call, the session first (EC-5)', async () => {
    readResult = { data: session({}, Array.from({ length: 60 }, (_, i) => catchRow(i % 40))), error: null }
    await fillMissingWeather({ sessionId: SESSION })
    expect(writes()).toHaveLength(50)
    expect(writes()[0].table).toBe('sessions')
  })

  it('asks the archive for old entries and splits requests per day (EC-9)', async () => {
    readResult = {
      data: session({ started_at: '2019-06-01T18:00:00+00:00' } as never, [
        catchRow(1, { caught_at: '2019-06-01T19:00:00+00:00' }),
        catchRow(2, { caught_at: '2019-06-02T01:00:00+00:00' }),
      ]),
      error: null,
    }
    fetchOpenMeteo.mockResolvedValue({ ok: false, reason: 'http', status: 500 })
    await fillMissingWeather({ sessionId: SESSION })
    const groups = fetchOpenMeteo.mock.calls.map((c) => c[0])
    expect(groups.map((g) => [g.endpoint, g.day])).toEqual([
      ['archive', '2019-06-01'],
      ['archive', '2019-06-02'],
    ])
  })
})

describe('failures (AC-8, AC-10, EC-7)', () => {
  it('marks the entries as failed when Open-Meteo does not answer', async () => {
    fetchOpenMeteo.mockResolvedValue({ ok: false, reason: 'http', status: 429 })
    const result = await fillMissingWeather({ sessionId: SESSION })
    expect(result).toEqual({ status: 'ok', filled: 0, failed: true })
    expect(updateOf(writes()[0])).toEqual({ weather_status: 'failed', weather_attempted_at: NOW.toISOString() })
    expect(callsOf(writes()[0], 'in')).toEqual([['weather_status', ['pending', 'failed']]])
  })

  it('treats a response without the hour or without any value as failed', async () => {
    fetchOpenMeteo.mockResolvedValue({ ok: true, json: { hourly: { time: [] } } })
    expect(await fillMissingWeather({ sessionId: SESSION })).toMatchObject({ failed: true, filled: 0 })
    expect(updateOf(writes()[0]).weather_status).toBe('failed')
  })

  it('waits 60 s after a failed attempt before the automatic retry', async () => {
    readResult = {
      data: session({ weather_status: 'failed', weather_attempted_at: '2026-09-30T11:59:30Z' }, [
        catchRow(1, { weather_status: 'failed', weather_attempted_at: '2026-09-30T11:58:59Z' }),
      ]),
      error: null,
    }
    await fillMissingWeather({ sessionId: SESSION })
    expect(writes().map((b) => b.table)).toEqual(['catches'])
  })

  it('lets the button retry after 10 s, not sooner', async () => {
    readResult = {
      data: session({ weather_status: 'failed', weather_attempted_at: '2026-09-30T11:59:30Z' }, [
        catchRow(1, { weather_status: 'failed', weather_attempted_at: '2026-09-30T11:59:55Z' }),
      ]),
      error: null,
    }
    await fillMissingWeather({ sessionId: SESSION, manual: true })
    expect(writes().map((b) => b.table)).toEqual(['sessions'])
  })

  it('sends at most 4 requests to Open-Meteo at the same time (design.md, EC-5)', async () => {
    // six catches at six different places → six groups
    readResult = {
      data: session({ latitude: null, longitude: null, weather_status: 'no_position' }, Array.from({ length: 6 }, (_, i) =>
        catchRow(i, { latitude: 50 + i, longitude: 10 + i }),
      )),
      error: null,
    }
    let running = 0
    let peak = 0
    fetchOpenMeteo.mockImplementation(async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return openMeteoDay()
    })
    vi.useRealTimers()
    const result = await fillMissingWeather({ sessionId: SESSION })
    expect(fetchOpenMeteo).toHaveBeenCalledTimes(6)
    expect(peak).toBe(4)
    expect(result).toMatchObject({ status: 'ok', failed: false })
  })

  it('never returns values or positions to the browser', async () => {
    const result = await fillMissingWeather({ sessionId: SESSION })
    expect(Object.keys(result).sort()).toEqual(['failed', 'filled', 'status'])
  })
})
