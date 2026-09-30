import 'server-only'

// Open-Meteo client (PROJ-3 design.md → „Anfrage an Open-Meteo"; AC-3, AC-8, AC-20, AC-23, EC-7, EC-9, EC-10).
// Server only (AC-23): the user's browser never talks to Open-Meteo. One GET per WeatherRequestGroup, carrying
// nothing but the rounded position, the period, the hourly variables and the time zone (AC-20). No API key,
// no cache, no retry; a failure is returned as a reason, never thrown, and logged without URL or position.

import { roundCoordinate, type WeatherRequestGroup } from './core'

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
export const OPEN_METEO_TIMEOUT_MS = 8000
export const HOURLY_VARIABLES =
  'temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation,weather_code'

/**
 * The request URL for one group. Only these parameters, nothing identifying (AC-20): latitude, longitude
 * (re-rounded to 2 decimals), hourly, timezone=GMT and the period — start_hour/end_hour on the forecast API,
 * start_date/end_date on the archive API (EC-9). Units stay Open-Meteo's defaults (°C, km/h, mm).
 */
export function buildOpenMeteoUrl(group: WeatherRequestGroup): string {
  const isForecast = group.endpoint === 'forecast'
  const url = new URL(isForecast ? OPEN_METEO_FORECAST_URL : OPEN_METEO_ARCHIVE_URL)
  const params = url.searchParams
  params.set('latitude', String(roundCoordinate(group.latitude)))
  params.set('longitude', String(roundCoordinate(group.longitude)))
  params.set('hourly', HOURLY_VARIABLES)
  params.set('timezone', 'GMT')
  if (isForecast) {
    params.set('start_hour', group.startHour)
    params.set('end_hour', group.endHour)
  } else {
    params.set('start_date', group.day)
    params.set('end_date', group.day)
  }
  return url.toString()
}

export type OpenMeteoResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: 'timeout' | 'network' | 'http' | 'invalid'; status?: number }

const isAbort = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')

function fail(reason: 'timeout' | 'network' | 'http' | 'invalid', status?: number): OpenMeteoResult {
  // Only the kind and the HTTP status — never the URL, coordinates, times or ids (positions are private).
  console.warn('[weather] open-meteo request failed:', reason, status ?? '')
  return status === undefined ? { ok: false, reason } : { ok: false, reason, status }
}

/**
 * Asks Open-Meteo for one group. At most OPEN_METEO_TIMEOUT_MS, no Next cache, no retry (AC-8: a retry is
 * the next page load or the button). Any status other than 200 — 429 for an exhausted quota included (EC-7)
 * — is 'http'. Never throws.
 */
export async function fetchOpenMeteo(
  group: WeatherRequestGroup,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenMeteoResult> {
  let response: Response
  try {
    response = await fetchImpl(buildOpenMeteoUrl(group), {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
  } catch (error) {
    return fail(isAbort(error) ? 'timeout' : 'network')
  }

  if (response.status !== 200) {
    try {
      await response.body?.cancel()
    } catch {
      // Releasing the connection is best effort.
    }
    return fail('http', response.status)
  }

  try {
    return { ok: true, json: await response.json() }
  } catch (error) {
    // The timeout also covers reading the body.
    return fail(isAbort(error) ? 'timeout' : 'invalid')
  }
}
