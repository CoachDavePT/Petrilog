import { describe, expect, it } from 'vitest'
import {
  FORECAST_WINDOW_DAYS,
  chooseEndpoint,
  formatHourParam,
  groupCandidates,
  nearestHour,
  parseHourlyResponse,
  roundCoordinate,
  roundPosition,
  utcDay,
  weatherIconName,
  weatherLabel,
  windSector,
  type WeatherCandidate,
} from './core'
import { WEATHER_STATUSES } from './types'

const DAY_MS = 86_400_000
const at = (iso: string) => new Date(iso)

describe('WEATHER_STATUSES', () => {
  it('lists the four status values', () => {
    expect(WEATHER_STATUSES).toEqual(['pending', 'ok', 'failed', 'no_position'])
  })
})

describe('position rounding (AC-20)', () => {
  it('rounds to two decimals', () => {
    expect(roundCoordinate(52.43789)).toBe(52.44)
    expect(roundCoordinate(13.38241)).toBe(13.38)
    expect(roundCoordinate(-3.70379)).toBe(-3.7)
  })

  it('never returns -0', () => {
    expect(Object.is(roundCoordinate(-0.001), 0)).toBe(true)
    expect(Object.is(roundCoordinate(-0), 0)).toBe(true)
  })

  it('rounds both parts of a position', () => {
    expect(roundPosition({ latitude: 54.08512, longitude: 13.38741 })).toEqual({ latitude: 54.09, longitude: 13.39 })
  })
})

describe('nearestHour (AC-4, EC-8)', () => {
  it('rounds down before :30 and up from :30', () => {
    expect(nearestHour(at('2026-09-12T14:29:59Z')).toISOString()).toBe('2026-09-12T14:00:00.000Z')
    expect(nearestHour(at('2026-09-12T14:30:00Z')).toISOString()).toBe('2026-09-12T15:00:00.000Z')
    expect(nearestHour(at('2026-09-12T14:00:00Z')).toISOString()).toBe('2026-09-12T14:00:00.000Z')
  })

  it('moves 23:40 UTC to 00:00 of the next day', () => {
    expect(nearestHour(at('2026-09-12T23:40:00Z')).toISOString()).toBe('2026-09-13T00:00:00.000Z')
  })

  it('gives the same full hour in Berlin time, whatever offset the time arrives with', () => {
    expect(nearestHour(at('2026-09-12T16:31:00+02:00')).toISOString()).toBe('2026-09-12T15:00:00.000Z')
    expect(nearestHour(at('2026-01-12T16:29:00+01:00')).toISOString()).toBe('2026-01-12T15:00:00.000Z')
  })
})

describe('formatHourParam and utcDay', () => {
  it('formats the UTC hour the way Open-Meteo lists it', () => {
    expect(formatHourParam(at('2026-09-12T04:00:00Z'))).toBe('2026-09-12T04:00')
    expect(formatHourParam(at('2026-01-02T00:00:00+01:00'))).toBe('2026-01-01T23:00')
  })

  it('gives the UTC calendar day', () => {
    expect(utcDay(at('2026-03-05T23:59:00Z'))).toBe('2026-03-05')
    expect(utcDay(at('2026-03-06T00:30:00+01:00'))).toBe('2026-03-05')
  })
})

describe('chooseEndpoint (EC-9)', () => {
  const now = at('2026-09-30T12:00:00Z')

  it('uses the forecast API for the last 90 days, the boundary included', () => {
    expect(FORECAST_WINDOW_DAYS).toBe(90)
    expect(chooseEndpoint(at('2026-09-30T11:00:00Z'), now)).toBe('forecast')
    expect(chooseEndpoint(new Date(now.getTime() - 90 * DAY_MS), now)).toBe('forecast')
  })

  it('uses the archive API for anything older', () => {
    expect(chooseEndpoint(new Date(now.getTime() - 90 * DAY_MS - 3_600_000), now)).toBe('archive')
    expect(chooseEndpoint(at('1995-06-01T10:00:00Z'), now)).toBe('archive')
  })

  it('uses the forecast API for the coming hour', () => {
    expect(chooseEndpoint(at('2026-09-30T13:00:00Z'), now)).toBe('forecast')
  })
})

describe('groupCandidates (EC-5)', () => {
  const now = at('2026-09-30T12:00:00Z')
  const candidate = (key: string, time: string, latitude = 54.08512, longitude = 13.38741): WeatherCandidate => ({
    key,
    latitude,
    longitude,
    referenceTime: at(time),
  })

  it('bundles the same rounded place on the same UTC day into one request', () => {
    const groups = groupCandidates(
      [
        candidate('session', '2026-09-12T14:05:00Z'),
        candidate('catch-1', '2026-09-12T16:40:00Z', 54.0851, 13.3901),
        candidate('catch-2', '2026-09-12T15:10:00Z'),
      ],
      now,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      endpoint: 'forecast',
      latitude: 54.09,
      longitude: 13.39,
      day: '2026-09-12',
      startHour: '2026-09-12T14:00',
      endHour: '2026-09-12T17:00',
    })
    expect(groups[0].members.map((m) => [m.key, m.hour.toISOString()])).toEqual([
      ['session', '2026-09-12T14:00:00.000Z'],
      ['catch-1', '2026-09-12T17:00:00.000Z'],
      ['catch-2', '2026-09-12T15:00:00.000Z'],
    ])
  })

  it('splits by UTC day, and a time rounding up past midnight belongs to the next day', () => {
    const groups = groupCandidates(
      [candidate('a', '2026-09-12T22:10:00Z'), candidate('b', '2026-09-12T23:40:00Z'), candidate('c', '2026-09-13T01:00:00Z')],
      now,
    )
    expect(groups.map((g) => [g.day, g.members.map((m) => m.key)])).toEqual([
      ['2026-09-12', ['a']],
      ['2026-09-13', ['b', 'c']],
    ])
    expect(groups[1].startHour).toBe('2026-09-13T00:00')
    expect(groups[1].endHour).toBe('2026-09-13T01:00')
  })

  it('splits by rounded place', () => {
    const groups = groupCandidates(
      [candidate('a', '2026-09-12T10:00:00Z', 54.08, 13.38), candidate('b', '2026-09-12T10:00:00Z', 54.2, 13.38)],
      now,
    )
    expect(groups.map((g) => g.latitude)).toEqual([54.08, 54.2])
  })

  it('separates archive and forecast requests and keeps the order of first appearance', () => {
    const groups = groupCandidates(
      [candidate('old', '2025-05-01T10:00:00Z'), candidate('new', '2026-09-12T10:00:00Z'), candidate('old-2', '2025-05-01T11:00:00Z')],
      now,
    )
    expect(groups.map((g) => [g.endpoint, g.members.map((m) => m.key)])).toEqual([
      ['archive', ['old', 'old-2']],
      ['forecast', ['new']],
    ])
  })

  it('returns nothing for no candidates', () => {
    expect(groupCandidates([], now)).toEqual([])
  })
})

describe('parseHourlyResponse (EC-6)', () => {
  const hour = at('2026-09-12T15:00:00Z')
  const response = (overrides: Record<string, unknown[]> = {}) => ({
    latitude: 54.08,
    longitude: 13.38,
    hourly: {
      time: ['2026-09-12T14:00', '2026-09-12T15:00', '2026-09-12T16:00'],
      temperature_2m: [11.1, 11.44, 12.0],
      pressure_msl: [1017.9, 1018.26, 1018.5],
      wind_speed_10m: [10.0, 14.36, 15.0],
      wind_direction_10m: [200, 224.6, 230],
      cloud_cover: [50, 60.4, 70],
      precipitation: [0, 0.04, 0.2],
      weather_code: [1, 2, 3],
      ...overrides,
    },
  })

  it('reads exactly the requested hour, rounded to storage precision', () => {
    expect(parseHourlyResponse(response(), hour)).toEqual({
      temperatureC: 11.4,
      pressureHpa: 1018.3,
      windSpeedKmh: 14.4,
      windDirectionDeg: 225,
      cloudCoverPct: 60,
      precipitationMm: 0,
      weatherCode: 2,
    })
  })

  it('returns null when the hour is not in the response', () => {
    expect(parseHourlyResponse(response(), at('2026-09-12T18:00:00Z'))).toBeNull()
  })

  it('drops a single out-of-bounds or broken value and keeps the rest', () => {
    const values = parseHourlyResponse(
      response({
        temperature_2m: [0, 75, 0],
        pressure_msl: [0, Number.NaN, 0],
        wind_speed_10m: [0, -1, 0],
        wind_direction_10m: [0, 361, 0],
        cloud_cover: [0, null, 0],
        precipitation: [0, '0.2', 0],
      }),
      hour,
    )
    expect(values).toEqual({
      temperatureC: null,
      pressureHpa: null,
      windSpeedKmh: null,
      windDirectionDeg: null,
      cloudCoverPct: null,
      precipitationMm: null,
      weatherCode: 2,
    })
  })

  it('keeps values right on the bounds', () => {
    const values = parseHourlyResponse(
      response({ temperature_2m: [0, -70, 0], wind_direction_10m: [0, 360, 0], cloud_cover: [0, 100, 0] }),
      hour,
    )
    expect(values).toMatchObject({ temperatureC: -70, windDirectionDeg: 360, cloudCoverPct: 100 })
  })

  it('drops a series that is missing entirely', () => {
    const json = response()
    delete (json.hourly as Record<string, unknown>).pressure_msl
    expect(parseHourlyResponse(json, hour)).toMatchObject({ pressureHpa: null, temperatureC: 11.4 })
  })

  it('rejects a non-integer or out-of-range weather code', () => {
    expect(parseHourlyResponse(response({ weather_code: [0, 2.5, 0] }), hour)?.weatherCode).toBeNull()
    expect(parseHourlyResponse(response({ weather_code: [0, 100, 0] }), hour)?.weatherCode).toBeNull()
  })

  it('returns null when every value is empty', () => {
    const empty = [null, null, null]
    expect(
      parseHourlyResponse(
        response({
          temperature_2m: empty,
          pressure_msl: empty,
          wind_speed_10m: empty,
          wind_direction_10m: empty,
          cloud_cover: empty,
          precipitation: empty,
          weather_code: empty,
        }),
        hour,
      ),
    ).toBeNull()
  })

  it('returns null for garbage without throwing', () => {
    for (const garbage of [null, undefined, 42, 'text', [], {}, { hourly: null }, { hourly: [] }, { hourly: { time: 'x' } }]) {
      expect(parseHourlyResponse(garbage, hour)).toBeNull()
    }
    expect(parseHourlyResponse(response(), new Date(Number.NaN))).toBeNull()
  })
})

describe('weatherLabel (AC-14)', () => {
  it('gives the German text for known WMO codes', () => {
    expect(weatherLabel(0)).toBe('Klar')
    expect(weatherLabel(1)).toBe('Überwiegend klar')
    expect(weatherLabel(2)).toBe('Leicht bewölkt')
    expect(weatherLabel(3)).toBe('Bewölkt')
    expect(weatherLabel(45)).toBe('Nebel')
    expect(weatherLabel(48)).toBe('Nebel')
    expect(weatherLabel(53)).toBe('Nieselregen')
    expect(weatherLabel(57)).toBe('Gefrierender Nieselregen')
    expect(weatherLabel(61)).toBe('Leichter Regen')
    expect(weatherLabel(63)).toBe('Regen')
    expect(weatherLabel(65)).toBe('Starker Regen')
    expect(weatherLabel(66)).toBe('Gefrierender Regen')
    expect(weatherLabel(71)).toBe('Leichter Schneefall')
    expect(weatherLabel(73)).toBe('Schneefall')
    expect(weatherLabel(75)).toBe('Starker Schneefall')
    expect(weatherLabel(77)).toBe('Schneegriesel')
    expect(weatherLabel(80)).toBe('Regenschauer')
    expect(weatherLabel(82)).toBe('Starke Regenschauer')
    expect(weatherLabel(86)).toBe('Schneeschauer')
    expect(weatherLabel(95)).toBe('Gewitter')
    expect(weatherLabel(96)).toBe('Gewitter mit Hagel')
    expect(weatherLabel(99)).toBe('Gewitter mit Hagel')
  })

  it('gives null for unknown or missing codes', () => {
    expect(weatherLabel(4)).toBeNull()
    expect(weatherLabel(98)).toBeNull()
    expect(weatherLabel(null)).toBeNull()
  })
})

describe('weatherIconName', () => {
  it('maps WMO codes to icon names', () => {
    expect([0, 1].map(weatherIconName)).toEqual(['sun', 'sun'])
    expect(weatherIconName(2)).toBe('cloud-sun')
    expect(weatherIconName(3)).toBe('cloud')
    expect([45, 48].map(weatherIconName)).toEqual(['cloud-fog', 'cloud-fog'])
    expect([51, 57].map(weatherIconName)).toEqual(['cloud-drizzle', 'cloud-drizzle'])
    expect([61, 67, 80, 82].map(weatherIconName)).toEqual(['cloud-rain', 'cloud-rain', 'cloud-rain', 'cloud-rain'])
    expect([71, 77, 85, 86].map(weatherIconName)).toEqual(['cloud-snow', 'cloud-snow', 'cloud-snow', 'cloud-snow'])
    expect([95, 96, 99].map(weatherIconName)).toEqual(['cloud-lightning', 'cloud-lightning', 'cloud-lightning'])
  })

  it('falls back to a plain cloud for unknown or missing codes', () => {
    expect(weatherIconName(42)).toBe('cloud')
    expect(weatherIconName(null)).toBe('cloud')
  })
})

describe('windSector', () => {
  it('maps degrees to 8 German sectors', () => {
    expect(windSector(0)).toBe('N')
    expect(windSector(22)).toBe('N')
    expect(windSector(23)).toBe('NO')
    expect(windSector(90)).toBe('O')
    expect(windSector(180)).toBe('S')
    expect(windSector(225)).toBe('SW')
    expect(windSector(337)).toBe('NW')
    expect(windSector(338)).toBe('N')
    expect(windSector(360)).toBe('N')
  })

  it('gives null without a direction', () => {
    expect(windSector(null)).toBeNull()
  })
})
