// Tests for PROJ-3 weather display helpers (design.md → „Anzeige der Werte", „Wann gilt ein Eintrag als
// ‚ohne Wetter‘", „Nachholen: die Server Action …"; AC-9, AC-14, AC-15, AC-17, EC-6).

import { describe, expect, it } from 'vitest'
import {
  AUTO_RETRY_COOLDOWN_MS,
  MANUAL_RETRY_COOLDOWN_MS,
  MISSING_VALUE,
  PENDING_GRACE_MS,
  formatWeatherHourNote,
  isWithoutWeather,
  needsAutoFill,
  weatherTiles,
} from './format'
import { WEATHER_MESSAGES } from './messages'
import type { WeatherState, WeatherValues } from './types'

/** The narrow no-break space before units (docs/design-system.md, like PROJ-2's UNIT_SPACE). */
const U = ' '

const FULL: WeatherValues = {
  temperatureC: 11.4,
  pressureHpa: 1018.4,
  windSpeedKmh: 14.2,
  windDirectionDeg: 225,
  cloudCoverPct: 60,
  precipitationMm: 0,
  weatherCode: 2,
}

const EMPTY: WeatherValues = {
  temperatureC: null,
  pressureHpa: null,
  windSpeedKmh: null,
  windDirectionDeg: null,
  cloudCoverPct: null,
  precipitationMm: null,
  weatherCode: null,
}

const byKey = (values: WeatherValues) => Object.fromEntries(weatherTiles(values).map((t) => [t.key, t]))

describe('weatherTiles (AC-14, EC-6)', () => {
  it('returns six tiles in fixed order with labels and icons', () => {
    const tiles = weatherTiles(FULL)
    expect(tiles.map((t) => t.key)).toEqual([
      'temperature',
      'pressure',
      'wind',
      'cloudCover',
      'precipitation',
      'condition',
    ])
    expect(tiles.map((t) => t.label)).toEqual(['Luft', 'Luftdruck', 'Wind', 'Bewölkung', 'Niederschlag', 'Wetter'])
    expect(tiles.map((t) => t.icon)).toEqual(['thermometer', 'gauge', 'wind', 'cloud', 'cloud-rain', 'cloud-sun'])
  })

  it('formats every value of a full snapshot', () => {
    const t = byKey(FULL)
    expect(t.temperature).toMatchObject({ value: '11,4', unit: '°C', text: `11,4${U}°C` })
    expect(t.pressure).toMatchObject({ value: '1018', unit: 'hPa', text: `1018${U}hPa` })
    expect(t.wind).toMatchObject({ value: '14', unit: 'km/h SW', text: `14${U}km/h SW` })
    expect(t.cloudCover).toMatchObject({ value: '60', unit: '%', text: `60${U}%` })
    expect(t.precipitation).toMatchObject({ value: '0,0', unit: 'mm', text: `0,0${U}mm` })
    expect(t.condition).toMatchObject({ value: 'Leicht bewölkt', unit: '', text: 'Leicht bewölkt' })
  })

  it('shows a negative temperature with one decimal', () => {
    expect(byKey({ ...FULL, temperatureC: -3 }).temperature.text).toBe(`-3,0${U}°C`)
  })

  it('never writes „-0,0"', () => {
    expect(byKey({ ...FULL, temperatureC: -0.01 }).temperature.value).toBe('0,0')
  })

  it('writes pressure as an integer without thousands separator', () => {
    expect(byKey({ ...FULL, pressureHpa: 1018.4 }).pressure.value).toBe('1018')
    expect(byKey({ ...FULL, pressureHpa: 1003 }).pressure.value).toBe('1003')
    expect(byKey({ ...FULL, pressureHpa: 1012.5 }).pressure.value).toBe('1013')
  })

  it('rounds wind speed and precipitation', () => {
    const t = byKey({ ...FULL, windSpeedKmh: 7.6, precipitationMm: 1.25 })
    expect(t.wind.value).toBe('8')
    expect(t.precipitation.value).toBe('1,3')
  })

  it('shows wind without direction as plain km/h', () => {
    expect(byKey({ ...FULL, windDirectionDeg: null }).wind).toMatchObject({
      value: '14',
      unit: 'km/h',
      text: `14${U}km/h`,
    })
  })

  it('uses 360° as N', () => {
    expect(byKey({ ...FULL, windDirectionDeg: 360 }).wind.text).toBe(`14${U}km/h N`)
  })

  it('shows „–" for missing wind speed even when the direction is known', () => {
    expect(byKey({ ...FULL, windSpeedKmh: null, windDirectionDeg: 225 }).wind).toMatchObject({
      value: '–',
      unit: '',
      text: '–',
    })
  })

  it('shows „–" for an unknown weather code, with the fallback cloud icon', () => {
    expect(byKey({ ...FULL, weatherCode: 42 }).condition).toMatchObject({ value: '–', unit: '', text: '–', icon: 'cloud' })
  })

  it('picks the condition icon from the code', () => {
    expect(byKey({ ...FULL, weatherCode: 63 }).condition).toMatchObject({ value: 'Regen', icon: 'cloud-rain' })
    expect(byKey({ ...FULL, weatherCode: 0 }).condition).toMatchObject({ value: 'Klar', icon: 'sun' })
  })

  it('shows six „–" tiles without unit when every value is missing', () => {
    const tiles = weatherTiles(EMPTY)
    expect(tiles).toHaveLength(6)
    for (const t of tiles) {
      expect(t.value).toBe(MISSING_VALUE)
      expect(t.unit).toBe('')
      expect(t.text).toBe('–')
    }
    expect(MISSING_VALUE).toBe('–')
  })

  it('keeps zero values (they are not missing)', () => {
    const t = byKey({ ...EMPTY, temperatureC: 0, cloudCoverPct: 0, windSpeedKmh: 0 })
    expect(t.temperature.text).toBe(`0,0${U}°C`)
    expect(t.cloudCover.text).toBe(`0${U}%`)
    expect(t.wind.text).toBe(`0${U}km/h`)
  })
})

describe('formatWeatherHourNote (AC-15)', () => {
  it('shows only the Berlin hour on the same day', () => {
    // 12:00Z = 14:00 Berlin (summer time)
    expect(formatWeatherHourNote('2026-09-12T12:00:00Z', '2026-09-12T12:10:00Z')).toBe(
      'Werte für 14:00 Uhr · Open-Meteo',
    )
  })

  it('adds the date when the hour falls on another Berlin day', () => {
    // reference 21:50Z = 23:50 Berlin on 12.09.; hour 22:00Z = 00:00 Berlin on 13.09.
    expect(formatWeatherHourNote('2026-09-12T22:00:00Z', '2026-09-12T21:50:00Z')).toBe(
      'Werte für 13.09., 00:00 Uhr · Open-Meteo',
    )
  })

  it('compares Berlin days, not UTC days', () => {
    // reference 22:40Z = 00:40 Berlin 13.09.; hour 23:00Z = 01:00 Berlin 13.09. — same Berlin day
    expect(formatWeatherHourNote('2026-09-12T23:00:00Z', '2026-09-12T22:40:00Z')).toBe(
      'Werte für 01:00 Uhr · Open-Meteo',
    )
    // reference 23:40Z on 12.09. UTC = 01:40 Berlin 13.09.; hour 00:00Z on 13.09. UTC = 02:00 Berlin 13.09.
    expect(formatWeatherHourNote('2026-09-13T00:00:00Z', '2026-09-12T23:40:00Z')).toBe(
      'Werte für 02:00 Uhr · Open-Meteo',
    )
  })

  it('uses winter time outside DST', () => {
    // 13:00Z in January = 14:00 Berlin
    expect(formatWeatherHourNote('2026-01-15T13:00:00Z', '2026-01-15T13:05:00Z')).toBe(
      'Werte für 14:00 Uhr · Open-Meteo',
    )
  })
})

describe('constants', () => {
  it('has the documented grace and cooldowns', () => {
    expect(PENDING_GRACE_MS).toBe(300_000)
    expect(AUTO_RETRY_COOLDOWN_MS).toBe(60_000)
    expect(MANUAL_RETRY_COOLDOWN_MS).toBe(10_000)
  })
})

const NOW = new Date('2026-09-12T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const state = (status: WeatherState['status'], requestedMsAgo: number, attemptedMsAgo: number | null): WeatherState => ({
  status,
  requestedAt: ago(requestedMsAgo),
  attemptedAt: attemptedMsAgo === null ? null : ago(attemptedMsAgo),
})

describe('isWithoutWeather (AC-17)', () => {
  it('is false for ok', () => {
    expect(isWithoutWeather(state('ok', 3_600_000, 3_600_000), NOW)).toBe(false)
  })

  it('is true for failed and no_position, however recent', () => {
    expect(isWithoutWeather(state('failed', 0, 0), NOW)).toBe(true)
    expect(isWithoutWeather(state('no_position', 0, null), NOW)).toBe(true)
  })

  it('shows no marker for a pending fetch younger than 5 minutes', () => {
    expect(isWithoutWeather(state('pending', 0, null), NOW)).toBe(false)
    expect(isWithoutWeather(state('pending', 4 * 60_000 + 59_000, null), NOW)).toBe(false)
    expect(isWithoutWeather(state('pending', PENDING_GRACE_MS, null), NOW)).toBe(false)
  })

  it('marks a pending fetch older than 5 minutes', () => {
    expect(isWithoutWeather(state('pending', 5 * 60_000 + 1_000, null), NOW)).toBe(true)
    expect(isWithoutWeather(state('pending', 30 * 24 * 3_600_000, null), NOW)).toBe(true)
  })

  it('accepts ISO strings with offset', () => {
    // 13:55 +02:00 = 11:55Z, 5 min before NOW → still within grace
    expect(isWithoutWeather({ status: 'pending', requestedAt: '2026-09-12T13:55:00+02:00', attemptedAt: null }, NOW)).toBe(false)
    expect(isWithoutWeather({ status: 'pending', requestedAt: '2026-09-12T13:54:00+02:00', attemptedAt: null }, NOW)).toBe(true)
  })
})

describe('needsAutoFill (AC-9, EC-7)', () => {
  it('is true for pending, regardless of attempts', () => {
    expect(needsAutoFill(state('pending', 0, null), NOW)).toBe(true)
    expect(needsAutoFill(state('pending', 0, 0), NOW)).toBe(true)
  })

  it('is true for failed without any attempt', () => {
    expect(needsAutoFill(state('failed', 0, null), NOW)).toBe(true)
  })

  it('waits 60 seconds after a failed attempt', () => {
    expect(needsAutoFill(state('failed', 0, 59_000), NOW)).toBe(false)
    expect(needsAutoFill(state('failed', 0, 59_999), NOW)).toBe(false)
    expect(needsAutoFill(state('failed', 0, 60_000), NOW)).toBe(true)
    expect(needsAutoFill(state('failed', 0, 3_600_000), NOW)).toBe(true)
  })

  it('is false for ok and no_position', () => {
    expect(needsAutoFill(state('ok', 3_600_000, 3_600_000), NOW)).toBe(false)
    expect(needsAutoFill(state('no_position', 3_600_000, null), NOW)).toBe(false)
  })
})

describe('WEATHER_MESSAGES', () => {
  it('has the exact texts from the design', () => {
    expect(WEATHER_MESSAGES).toEqual({
      sessionHeading: 'Wetter beim Start',
      catchHeading: 'Wetter beim Fang',
      pending: 'Wetter wird abgerufen …',
      noWeather: 'Ohne Wetterdaten',
      failedReason: 'Wetter konnte nicht abgerufen werden.',
      noPositionReason: 'Ohne Position wird kein Wetter abgerufen.',
      retry: 'Wetter erneut abrufen',
      retrying: 'Wird abgerufen …',
      retryFailed: 'Wetter gerade nicht verfügbar. Versuche es später erneut.',
      marker: 'ohne Wetter',
      backfillTitle: 'Wetter von damals',
      backfillText: 'Wir rufen die stündlichen Wetterdaten für diesen Zeitraum ab, soweit verfügbar.',
    })
  })

  it('uses the typographic ellipsis, never three dots', () => {
    for (const text of Object.values(WEATHER_MESSAGES)) expect(text).not.toContain('...')
  })
})
