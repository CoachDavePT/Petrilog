// Weather core (PROJ-3 design.md → „Nachholen: die Server Action …", „Anfrage an Open-Meteo" and „Anzeige
// der Werte"; AC-3, AC-4, AC-14, AC-20, EC-5, EC-6, EC-8, EC-9). Pure functions, no network: round positions
// before they leave the server, pick the full hour and the endpoint, bundle requests per place and day,
// read one hour out of an Open-Meteo response and turn WMO codes and wind degrees into German labels.

import type { WeatherValues } from './types'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

const pad2 = (n: number) => String(n).padStart(2, '0')

// ---------------------------------------------------------------------------------------------------------
// Position (AC-20: only rounded positions ever leave the server)

/** Two decimals (about 1 km); never -0. */
export function roundCoordinate(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return rounded === 0 ? 0 : rounded
}

export function roundPosition(position: { latitude: number; longitude: number }): {
  latitude: number
  longitude: number
} {
  return { latitude: roundCoordinate(position.latitude), longitude: roundCoordinate(position.longitude) }
}

// ---------------------------------------------------------------------------------------------------------
// Hour and endpoint (AC-4, EC-8, EC-9)

/**
 * The nearest full hour, :30 and later rounding up (14:29 → 14:00, 14:30 → 15:00). Computed in UTC;
 * Europe/Berlin is a whole number of hours off UTC, so it is the same hour there (EC-8).
 */
export function nearestHour(time: Date): Date {
  return new Date(Math.round(time.getTime() / HOUR_MS) * HOUR_MS)
}

/** „2026-09-12T14:00" — Open-Meteo's hourly time format with `timezone=GMT`. */
export function formatHourParam(date: Date): string {
  return `${utcDay(date)}T${pad2(date.getUTCHours())}:00`
}

/** „2026-09-12" — the UTC calendar day. */
export function utcDay(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

/** Hours from this many days back on are asked from the forecast API; older ones from the archive API. */
export const FORECAST_WINDOW_DAYS = 90

export type WeatherEndpoint = 'forecast' | 'archive'

/**
 * The forecast API also serves past hours (up to 92 days back, including the latest ones the archive does
 * not have yet); the archive API reaches back to 1940 (EC-9).
 */
export function chooseEndpoint(hour: Date, now: Date): WeatherEndpoint {
  return hour.getTime() >= now.getTime() - FORECAST_WINDOW_DAYS * DAY_MS ? 'forecast' : 'archive'
}

// ---------------------------------------------------------------------------------------------------------
// Bundling (EC-5: one request per rounded position and UTC day)

export type WeatherCandidate = { key: string; latitude: number; longitude: number; referenceTime: Date }

export type WeatherRequestGroup = {
  endpoint: WeatherEndpoint
  /** Rounded to 2 decimals. */
  latitude: number
  longitude: number
  /** The UTC day of every hour in the group. */
  day: string
  /** formatHourParam of the earliest and latest hour in the group. */
  startHour: string
  endHour: string
  members: { key: string; hour: Date }[]
}

/** Groups in order of first appearance, members in input order. */
export function groupCandidates(candidates: WeatherCandidate[], now: Date): WeatherRequestGroup[] {
  const groups = new Map<string, WeatherRequestGroup & { minMs: number; maxMs: number }>()
  for (const candidate of candidates) {
    const hour = nearestHour(candidate.referenceTime)
    const { latitude, longitude } = roundPosition(candidate)
    const endpoint = chooseEndpoint(hour, now)
    const day = utcDay(hour)
    const groupKey = `${endpoint}|${latitude}|${longitude}|${day}`
    const ms = hour.getTime()
    let group = groups.get(groupKey)
    if (!group) {
      group = { endpoint, latitude, longitude, day, startHour: '', endHour: '', members: [], minMs: ms, maxMs: ms }
      groups.set(groupKey, group)
    }
    group.minMs = Math.min(group.minMs, ms)
    group.maxMs = Math.max(group.maxMs, ms)
    group.members.push({ key: candidate.key, hour })
  }
  return [...groups.values()].map(({ minMs, maxMs, ...group }) => ({
    ...group,
    startHour: formatHourParam(new Date(minMs)),
    endHour: formatHourParam(new Date(maxMs)),
  }))
}

// ---------------------------------------------------------------------------------------------------------
// Reading an Open-Meteo response (EC-6)

type Bounds = { min: number; max: number; decimals: number; integerOnly?: boolean }

const FIELDS: { [K in keyof WeatherValues]: { source: string } & Bounds } = {
  temperatureC: { source: 'temperature_2m', min: -70, max: 60, decimals: 1 },
  pressureHpa: { source: 'pressure_msl', min: 850, max: 1100, decimals: 1 },
  windSpeedKmh: { source: 'wind_speed_10m', min: 0, max: 500, decimals: 1 },
  windDirectionDeg: { source: 'wind_direction_10m', min: 0, max: 360, decimals: 0 },
  cloudCoverPct: { source: 'cloud_cover', min: 0, max: 100, decimals: 0 },
  precipitationMm: { source: 'precipitation', min: 0, max: 1000, decimals: 1 },
  weatherCode: { source: 'weather_code', min: 0, max: 99, decimals: 0, integerOnly: true },
}

function cleanValue(raw: unknown, bounds: Bounds): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  if (raw < bounds.min || raw > bounds.max) return null
  if (bounds.integerOnly && !Number.isInteger(raw)) return null
  const factor = 10 ** bounds.decimals
  const rounded = Math.round(raw * factor) / factor
  return rounded === 0 ? 0 : rounded
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The values of exactly this full hour from an Open-Meteo `hourly` response. Null when the hour is missing,
 * the shape is broken or every value is empty (all count as a failed fetch). Never throws.
 */
export function parseHourlyResponse(json: unknown, hour: Date): WeatherValues | null {
  if (!isRecord(json) || !isRecord(json.hourly)) return null
  const hourly = json.hourly
  if (!Array.isArray(hourly.time)) return null
  if (Number.isNaN(hour.getTime())) return null
  const index = hourly.time.indexOf(formatHourParam(hour))
  if (index < 0) return null

  const values = {} as WeatherValues
  let any = false
  for (const name of Object.keys(FIELDS) as (keyof WeatherValues)[]) {
    const field = FIELDS[name]
    const series = hourly[field.source]
    const value = Array.isArray(series) ? cleanValue(series[index], field) : null
    values[name] = value
    if (value !== null) any = true
  }
  return any ? values : null
}

// ---------------------------------------------------------------------------------------------------------
// Labels (AC-14)

const WEATHER_LABELS: Record<number, string> = {
  0: 'Klar',
  1: 'Überwiegend klar',
  2: 'Leicht bewölkt',
  3: 'Bewölkt',
  45: 'Nebel',
  48: 'Nebel',
  51: 'Nieselregen',
  53: 'Nieselregen',
  55: 'Nieselregen',
  56: 'Gefrierender Nieselregen',
  57: 'Gefrierender Nieselregen',
  61: 'Leichter Regen',
  63: 'Regen',
  65: 'Starker Regen',
  66: 'Gefrierender Regen',
  67: 'Gefrierender Regen',
  71: 'Leichter Schneefall',
  73: 'Schneefall',
  75: 'Starker Schneefall',
  77: 'Schneegriesel',
  80: 'Regenschauer',
  81: 'Regenschauer',
  82: 'Starke Regenschauer',
  85: 'Schneeschauer',
  86: 'Schneeschauer',
  95: 'Gewitter',
  96: 'Gewitter mit Hagel',
  99: 'Gewitter mit Hagel',
}

/** German text for a WMO weather code; null for an unknown or missing code (shown as „–"). */
export function weatherLabel(code: number | null): string | null {
  if (code === null || !Object.hasOwn(WEATHER_LABELS, code)) return null
  return WEATHER_LABELS[code]
}

export type WeatherIconName =
  | 'sun'
  | 'cloud-sun'
  | 'cloud'
  | 'cloud-fog'
  | 'cloud-drizzle'
  | 'cloud-rain'
  | 'cloud-snow'
  | 'cloud-lightning'

/** Icon for a WMO weather code; 'cloud' for an unknown or missing code. */
export function weatherIconName(code: number | null): WeatherIconName {
  if (code === null) return 'cloud'
  if (code === 0 || code === 1) return 'sun'
  if (code === 2) return 'cloud-sun'
  if (code === 45 || code === 48) return 'cloud-fog'
  if (code >= 51 && code <= 57) return 'cloud-drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'cloud-rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'cloud-snow'
  if (code >= 95 && code <= 99) return 'cloud-lightning'
  return 'cloud'
}

const WIND_SECTORS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] as const

/** Wind direction in 8 sectors: degrees ÷ 45 rounded, 360° = N. */
export function windSector(deg: number | null): string | null {
  if (deg === null || !Number.isFinite(deg)) return null
  return WIND_SECTORS[(((Math.round(deg / 45) % 8) + 8) % 8)]
}
