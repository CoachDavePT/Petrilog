// Shared weather types (PROJ-3 tasks.md → „Feste Namen", design.md → „Datenmodell" and „Anzeige der Werte").
// One snapshot per session (reference time = start) and per catch (reference time = catch time), stored in
// the `weather_*` columns of both tables. Times are ISO strings, as Supabase returns `timestamptz`.

/** The weather state of a session or catch (column `weather_status`). */
export type WeatherStatus = 'pending' | 'ok' | 'failed' | 'no_position'

export const WEATHER_STATUSES: readonly WeatherStatus[] = ['pending', 'ok', 'failed', 'no_position'] as const

/** The hourly values of one snapshot, in storage units and precision; each may be missing (EC-6). */
export type WeatherValues = {
  temperatureC: number | null
  pressureHpa: number | null
  windSpeedKmh: number | null
  windDirectionDeg: number | null
  cloudCoverPct: number | null
  precipitationMm: number | null
  weatherCode: number | null
}

/** A stored snapshot: `values` is set only when `status` is 'ok'; `hour` is the full UTC hour used. */
export type WeatherSnapshot = {
  status: WeatherStatus
  hour: string | null
  values: WeatherValues | null
  fetchedAt: string | null
}

/** What the "without weather" marker and the fill-in logic need to decide (AC-7, AC-8, AC-16, AC-17). */
export type WeatherState = {
  status: WeatherStatus
  requestedAt: string
  attemptedAt: string | null
}
