// Weather display helpers (PROJ-3 design.md → „Anzeige der Werte", „Wann gilt ein Eintrag als ‚ohne Wetter‘"
// and „Nachholen: die Server Action …"; AC-9, AC-14, AC-15, AC-17, EC-6, EC-7). Pure functions: the six
// tiles of a snapshot, the „Werte für 14:00 Uhr" note in Europe/Berlin, and the one shared rule for the
// „ohne Wetter" marker and for automatic fill-in. "now" is always passed in.

import { formatNumber, formatShortDateTime, formatTime, isSameBerlinDay, UNIT_SPACE } from '@/lib/fishing/format'
import { weatherIconName, weatherLabel, windSector, type WeatherIconName } from './core'
import type { WeatherState, WeatherValues } from './types'

/** U+2013 EN DASH — shown for a missing value, without a unit (EC-6). */
export const MISSING_VALUE = '–'

// ---------------------------------------------------------------------------------------------------------
// Tiles (AC-14, EC-6)

export type WeatherTileKey = 'temperature' | 'pressure' | 'wind' | 'cloudCover' | 'precipitation' | 'condition'

export type WeatherTileIcon = 'thermometer' | 'gauge' | 'wind' | 'cloud' | 'cloud-rain' | WeatherIconName

export type WeatherTile = {
  key: WeatherTileKey
  label: string
  /** The number or text, „–" when missing. */
  value: string
  /** „°C", „km/h SW" …; empty when the value is missing or has no unit. */
  unit: string
  /** The full reading for screen readers and tests: „11,4 °C", „14 km/h SW", „Leicht bewölkt" or „–". */
  text: string
  icon: WeatherTileIcon
}

function tile(key: WeatherTileKey, label: string, icon: WeatherTileIcon, value: string | null, unit: string): WeatherTile {
  if (value === null) return { key, label, value: MISSING_VALUE, unit: '', text: MISSING_VALUE, icon }
  return { key, label, value, unit, text: unit ? `${value}${UNIT_SPACE}${unit}` : value, icon }
}

const fmt = (value: number | null, decimals: number) => (value === null ? null : formatNumber(value, decimals))

/** The six tiles in fixed order: Luft, Luftdruck, Wind, Bewölkung, Niederschlag, Wetter. */
export function weatherTiles(values: WeatherValues): WeatherTile[] {
  const sector = windSector(values.windDirectionDeg)
  const code = values.weatherCode
  return [
    tile('temperature', 'Luft', 'thermometer', fmt(values.temperatureC, 1), '°C'),
    // Without thousands separator, as in the weather report and the prototype („1018 hPa").
    tile('pressure', 'Luftdruck', 'gauge', values.pressureHpa === null ? null : String(Math.round(values.pressureHpa)), 'hPa'),
    tile('wind', 'Wind', 'wind', fmt(values.windSpeedKmh, 0), sector ? `km/h ${sector}` : 'km/h'),
    tile('cloudCover', 'Bewölkung', 'cloud', fmt(values.cloudCoverPct, 0), '%'),
    tile('precipitation', 'Niederschlag', 'cloud-rain', fmt(values.precipitationMm, 1), 'mm'),
    tile('condition', 'Wetter', weatherIconName(code), weatherLabel(code), ''),
  ]
}

// ---------------------------------------------------------------------------------------------------------
// Hour note (AC-15)

/**
 * „Werte für 14:00 Uhr · Open-Meteo" — the full hour in Europe/Berlin; with the date („13.09., 00:00 Uhr")
 * when the hour falls on another Berlin day than the reference time.
 */
export function formatWeatherHourNote(hourIso: string, referenceIso: string): string {
  const when = isSameBerlinDay(hourIso, referenceIso) ? formatTime(hourIso) : formatShortDateTime(hourIso)
  return `Werte für ${when} Uhr · Open-Meteo`
}

// ---------------------------------------------------------------------------------------------------------
// Marker and fill-in rules (AC-9, AC-17, EC-7)

/** A pending fetch younger than this shows no „ohne Wetter" marker. */
export const PENDING_GRACE_MS = 5 * 60 * 1000
/** Automatic fill-in skips entries whose last attempt is younger than this. */
export const AUTO_RETRY_COOLDOWN_MS = 60 * 1000
/** „Wetter erneut abrufen" skips entries whose last attempt is younger than this. */
export const MANUAL_RETRY_COOLDOWN_MS = 10 * 1000

const ms = (iso: string) => new Date(iso).getTime()

/** AC-17: the one shared rule whether overview, catch row and detail show an entry as „ohne Wetter". */
export function isWithoutWeather(state: WeatherState, now: Date): boolean {
  switch (state.status) {
    case 'ok':
      return false
    case 'failed':
    case 'no_position':
      return true
    case 'pending':
      return now.getTime() - ms(state.requestedAt) > PENDING_GRACE_MS
  }
}

/** AC-9: whether the page should call the fill-in action for this entry on load. */
export function needsAutoFill(state: WeatherState, now: Date): boolean {
  switch (state.status) {
    case 'pending':
      return true
    case 'failed':
      return state.attemptedAt === null || now.getTime() - ms(state.attemptedAt) >= AUTO_RETRY_COOLDOWN_MS
    case 'ok':
    case 'no_position':
      return false
  }
}
