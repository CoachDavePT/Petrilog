// @vitest-environment node
// PROJ-3 T4 — Open-Meteo client (design.md → „Anfrage an Open-Meteo"; AC-3, AC-8, AC-20, AC-23, EC-7, EC-9, EC-10).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeatherRequestGroup } from './core'

vi.mock('server-only', () => ({}))

const {
  buildOpenMeteoUrl,
  fetchOpenMeteo,
  HOURLY_VARIABLES,
  OPEN_METEO_ARCHIVE_URL,
  OPEN_METEO_FORECAST_URL,
  OPEN_METEO_TIMEOUT_MS,
} = await import('./open-meteo')

const forecastGroup = (overrides: Partial<WeatherRequestGroup> = {}): WeatherRequestGroup => ({
  endpoint: 'forecast',
  latitude: 54.09,
  longitude: 13.38,
  day: '2026-09-12',
  startHour: '2026-09-12T06:00',
  endHour: '2026-09-12T14:00',
  members: [{ key: 'session:abc', hour: new Date('2026-09-12T06:00:00Z') }],
  ...overrides,
})

const archiveGroup = (overrides: Partial<WeatherRequestGroup> = {}): WeatherRequestGroup =>
  forecastGroup({ endpoint: 'archive', day: '2025-03-01', startHour: '2025-03-01T08:00', endHour: '2025-03-01T08:00', ...overrides })

const paramsOf = (url: string) => new URL(url).searchParams
const keysOf = (url: string) => [...paramsOf(url).keys()].sort()

describe('buildOpenMeteoUrl', () => {
  it('forecast: host/path, exactly the allowed parameters, period by hour, GMT (AC-3, AC-20)', () => {
    const url = buildOpenMeteoUrl(forecastGroup())
    const parsed = new URL(url)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(OPEN_METEO_FORECAST_URL)
    expect(OPEN_METEO_FORECAST_URL).toBe('https://api.open-meteo.com/v1/forecast')
    expect(keysOf(url)).toEqual(['end_hour', 'hourly', 'latitude', 'longitude', 'start_hour', 'timezone'])
    const p = paramsOf(url)
    expect(p.get('start_hour')).toBe('2026-09-12T06:00')
    expect(p.get('end_hour')).toBe('2026-09-12T14:00')
    expect(p.get('timezone')).toBe('GMT')
    expect(p.get('hourly')).toBe(HOURLY_VARIABLES)
    expect(HOURLY_VARIABLES).toBe(
      'temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation,weather_code',
    )
    expect(p.get('latitude')).toBe('54.09')
    expect(p.get('longitude')).toBe('13.38')
  })

  it('re-rounds coordinates defensively to 2 decimals (AC-20)', () => {
    const url = buildOpenMeteoUrl(forecastGroup({ latitude: 54.08512, longitude: 13.384999 }))
    const p = paramsOf(url)
    expect(p.get('latitude')).toBe('54.09')
    expect(p.get('longitude')).toBe('13.38')
    for (const key of ['latitude', 'longitude']) {
      expect(p.get(key)).toMatch(/^-?\d+(\.\d{1,2})?$/)
    }
    // No coordinate with more than 2 decimals anywhere in the URL.
    expect(decodeURIComponent(url)).not.toMatch(/\d+\.\d{3,}/)
  })

  it('handles negative longitude and 0', () => {
    const neg = paramsOf(buildOpenMeteoUrl(forecastGroup({ latitude: -33.456789, longitude: -70.648271 })))
    expect(neg.get('latitude')).toBe('-33.46')
    expect(neg.get('longitude')).toBe('-70.65')
    const zero = paramsOf(buildOpenMeteoUrl(forecastGroup({ latitude: 0, longitude: -0.001 })))
    expect(zero.get('latitude')).toBe('0')
    expect(zero.get('longitude')).toBe('0')
  })

  it('carries nothing identifying: no member keys, no water name, no user (AC-20)', () => {
    const url = buildOpenMeteoUrl(forecastGroup({ members: [{ key: 'catch:secret-id-123', hour: new Date() }] }))
    expect(url).not.toContain('secret-id-123')
    expect(url).not.toContain('catch')
  })

  it('archive: host/path, start_date/end_date = day, no hours (EC-9)', () => {
    const url = buildOpenMeteoUrl(archiveGroup())
    const parsed = new URL(url)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(OPEN_METEO_ARCHIVE_URL)
    expect(OPEN_METEO_ARCHIVE_URL).toBe('https://archive-api.open-meteo.com/v1/archive')
    expect(keysOf(url)).toEqual(['end_date', 'hourly', 'latitude', 'longitude', 'start_date', 'timezone'])
    const p = paramsOf(url)
    expect(p.get('start_date')).toBe('2025-03-01')
    expect(p.get('end_date')).toBe('2025-03-01')
    expect(p.has('start_hour')).toBe(false)
    expect(p.has('end_hour')).toBe(false)
    expect(p.get('timezone')).toBe('GMT')
  })
})

describe('fetchOpenMeteo', () => {
  let warn: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    warn.mockRestore()
  })

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const expectWarnWithoutPrivateData = () => {
    expect(warn).toHaveBeenCalledTimes(1)
    const text = warn.mock.calls[0].map(String).join(' ')
    expect(text).toContain('[weather] open-meteo request failed:')
    for (const secret of ['54.09', '54.08', '13.38', '2026-09-12', 'open-meteo.com', 'session:abc', 'http://', 'https://']) {
      expect(text).not.toContain(secret)
    }
  }

  it('calls fetch with GET, no-store, a timeout signal and accept json (AC-8, AC-23)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ hourly: {} }))
    await fetchOpenMeteo(forecastGroup({ latitude: 54.08512 }), fetchImpl as unknown as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(buildOpenMeteoUrl(forecastGroup({ latitude: 54.08512 })))
    expect(init.method).toBe('GET')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal?.aborted).toBe(false)
    expect(init.headers).toEqual({ accept: 'application/json' })
    expect(OPEN_METEO_TIMEOUT_MS).toBe(8000)
  })

  it('200 with JSON → ok with the parsed body', async () => {
    const body = { hourly: { time: ['2026-09-12T06:00'], temperature_2m: [11.4] } }
    const result = await fetchOpenMeteo(forecastGroup(), (async () => jsonResponse(body)) as typeof fetch)
    expect(result).toEqual({ ok: true, json: body })
    expect(warn).not.toHaveBeenCalled()
  })

  it('429 (quota exhausted) → http 429 (EC-7)', async () => {
    const result = await fetchOpenMeteo(
      forecastGroup(),
      (async () => jsonResponse({ error: true, reason: 'Daily API request limit exceeded' }, 429)) as typeof fetch,
    )
    expect(result).toEqual({ ok: false, reason: 'http', status: 429 })
    expectWarnWithoutPrivateData()
    expect(warn.mock.calls[0]).toEqual(['[weather] open-meteo request failed:', 'http', 429])
  })

  it('500 → http 500', async () => {
    const result = await fetchOpenMeteo(forecastGroup(), (async () => new Response('boom', { status: 500 })) as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'http', status: 500 })
    expectWarnWithoutPrivateData()
  })

  it('fetch throws TypeError → network', async () => {
    const result = await fetchOpenMeteo(forecastGroup(), (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'network' })
    expectWarnWithoutPrivateData()
    expect(warn.mock.calls[0]).toEqual(['[weather] open-meteo request failed:', 'network', ''])
  })

  it.each(['TimeoutError', 'AbortError'])('fetch throws DOMException %s → timeout', async (name) => {
    const result = await fetchOpenMeteo(forecastGroup(), (async () => {
      throw new DOMException('The operation was aborted due to timeout', name)
    }) as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'timeout' })
    expectWarnWithoutPrivateData()
  })

  it('200 with a body that is not JSON → invalid', async () => {
    const result = await fetchOpenMeteo(
      forecastGroup(),
      (async () => new Response('<html>not json</html>', { status: 200 })) as typeof fetch,
    )
    expect(result).toEqual({ ok: false, reason: 'invalid' })
    expectWarnWithoutPrivateData()
  })

  it('never throws, even for an odd rejection value', async () => {
    const result = await fetchOpenMeteo(forecastGroup(), (() => Promise.reject('weird')) as typeof fetch)
    expect(result).toEqual({ ok: false, reason: 'network' })
  })
})
