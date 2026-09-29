// Display helpers for sessions and catches (PROJ-2 design.md → „Sessions-Übersicht", „Detailansicht und
// Kennzahl", „Session beenden" and the decisions „Alle Zeitpunkte mit Zeitzone …" / „Kennzahl … mindestens
// 1 Minute"). Pure functions: every time is shown in Europe/Berlin, durations are real elapsed time (right
// across midnight and DST, EC-8), and "now" is always passed in so server, bar and detail view share one clock.
// Numbers follow docs/design-system.md → Typografie: German format, a narrow no-break space before units.

/** A point in time: a Date or an ISO string with offset, as Supabase returns `timestamptz`. */
export type Instant = Date | string

/** U+202F NARROW NO-BREAK SPACE — the "schmaler Abstand" before every unit ("31 cm", "1:42 h"). */
export const UNIT_SPACE = ' '

export const TIME_ZONE = 'Europe/Berlin'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
/** AC-11: a running session gets the "Vergessen zu beenden?" hint from this age on. */
export const LONG_RUNNING_MS = 12 * HOUR_MS

function toMs(instant: Instant): number {
  const ms = instant instanceof Date ? instant.getTime() : new Date(instant).getTime()
  if (Number.isNaN(ms)) throw new RangeError(`Invalid instant: ${String(instant)}`)
  return ms
}

// ---------------------------------------------------------------------------------------------------------
// Europe/Berlin wall clock

const berlinFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function berlinWallClock(ms: number): WallClock {
  const parts: Record<string, number> = {}
  for (const p of berlinFormatter.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** Berlin's UTC offset in ms at this instant (+1 h in winter, +2 h in summer). */
function berlinOffsetMs(ms: number): number {
  const w = berlinWallClock(ms)
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return wallAsUtc - Math.floor(ms / 1000) * 1000
}

const pad2 = (n: number) => String(n).padStart(2, '0')

// ---------------------------------------------------------------------------------------------------------
// Dates and times

/** „12.09.2026" — the Berlin calendar date (EC-8: a session is listed under its start date). */
export function formatDate(instant: Instant): string {
  const w = berlinWallClock(toMs(instant))
  return `${pad2(w.day)}.${pad2(w.month)}.${w.year}`
}

/** „12.09." — the Berlin date without year. */
export function formatShortDate(instant: Instant): string {
  const w = berlinWallClock(toMs(instant))
  return `${pad2(w.day)}.${pad2(w.month)}.`
}

/** „14:05" — the Berlin time, 24-hour clock. */
export function formatTime(instant: Instant): string {
  const w = berlinWallClock(toMs(instant))
  return `${pad2(w.hour)}:${pad2(w.minute)}`
}

/** „12.09.2026, 14:05". */
export function formatDateTime(instant: Instant): string {
  return `${formatDate(instant)}, ${formatTime(instant)}`
}

/** „12.09., 14:05" — for messages that name a nearby point in time. */
export function formatShortDateTime(instant: Instant): string {
  return `${formatShortDate(instant)}, ${formatTime(instant)}`
}

/** True when both instants fall on the same calendar day in Berlin. */
export function isSameBerlinDay(a: Instant, b: Instant): boolean {
  return formatDate(a) === formatDate(b)
}

/** The end of a session: „20:00" on the start's Berlin day, otherwise with the date („13.09., 02:10"). */
export function formatEndTime(start: Instant, end: Instant): string {
  return isSameBerlinDay(start, end) ? formatTime(end) : formatShortDateTime(end)
}

/** „bis 20:00" / „bis 13.09., 02:10" (design.md → Detailansicht, Zeiten). */
export function formatEndLabel(start: Instant, end: Instant): string {
  return `bis ${formatEndTime(start, end)}`
}

// ---------------------------------------------------------------------------------------------------------
// Durations and the catch rate

/** Elapsed whole minutes from start to end; 0 when end is not after start. */
export function elapsedMinutes(start: Instant, end: Instant): number {
  return Math.max(0, Math.floor((toMs(end) - toMs(start)) / MINUTE_MS))
}

/** „1:42 h", „0:05 h", „26:05 h" — real elapsed time, so midnight and DST changes count correctly. */
export function formatDuration(start: Instant, end: Instant): string {
  const minutes = elapsedMinutes(start, end)
  return `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}${UNIT_SPACE}h`
}

/**
 * Catches per hour (AC-30): count ÷ duration in hours. A running session (end = null) is measured to `now`;
 * the duration counts as at least 1 minute so a catch right after the start gives no absurd value.
 */
export function catchesPerHour(catchCount: number, start: Instant, end: Instant | null, now: Date): number {
  const durationMs = Math.max(MINUTE_MS, toMs(end ?? now) - toMs(start))
  return catchCount / (durationMs / HOUR_MS)
}

/** „1,7", „0,0" (AC-30, AC-31) — one decimal, German format. */
export function formatCatchesPerHour(catchCount: number, start: Instant, end: Instant | null, now: Date): string {
  return formatNumber(catchesPerHour(catchCount, start, end, now), 1)
}

/** AC-11: the session is still running and started at least 12 hours before `now`. */
export function isLongRunning(start: Instant, end: Instant | null, now: Date): boolean {
  return end === null && toMs(now) - toMs(start) >= LONG_RUNNING_MS
}

// ---------------------------------------------------------------------------------------------------------
// Numbers and measurements

const numberFormatters = new Map<number, Intl.NumberFormat>()

/** German number format with exactly `fractionDigits` decimals: „1.250", „1,7". */
export function formatNumber(value: number, fractionDigits = 0): string {
  let f = numberFormatters.get(fractionDigits)
  if (!f) {
    f = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    numberFormatters.set(fractionDigits, f)
  }
  // Avoid „-0,0" when a tiny negative value rounds to zero.
  const text = f.format(value)
  return /^-[0,]+$/.test(text) ? text.slice(1) : text
}

/** „31 cm". */
export function formatLength(cm: number): string {
  return `${formatNumber(cm)}${UNIT_SPACE}cm`
}

/** „1.250 g". */
export function formatWeight(grams: number): string {
  return `${formatNumber(grams)}${UNIT_SPACE}g`
}

/** GPS accuracy (EC-7): under 1.000 m „± 12 m", from 1.000 m on „± 1,2 km". */
export function formatAccuracy(meters: number): string {
  const rounded = Math.round(meters)
  if (rounded < 1000) return `±${UNIT_SPACE}${formatNumber(rounded)}${UNIT_SPACE}m`
  return `±${UNIT_SPACE}${formatNumber(meters / 1000, 1)}${UNIT_SPACE}km`
}

function formatCoordinate(value: number, positive: string, negative: string): string {
  const text = formatNumber(Math.abs(value), 5)
  // A value that rounds to 0 gets the positive hemisphere, never „0,00000° S".
  const hemisphere = value < 0 && /[1-9]/.test(text) ? negative : positive
  return `${text}°${UNIT_SPACE}${hemisphere}`
}

/** „54,08512° N · 13,38741° O" — 5 decimals (about 1 m), S / W for negative values. */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${formatCoordinate(latitude, 'N', 'S')} · ${formatCoordinate(longitude, 'O', 'W')}`
}

// ---------------------------------------------------------------------------------------------------------
// Form values ⇄ instants

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})$/

/**
 * A Berlin date and time from a form („2026-09-12", „14:05") → ISO instant with offset
 * („2026-09-12T14:05:00+02:00"). Returns null for malformed or impossible input (e.g. 30.02.).
 * Around DST: a time that occurs twice (last Sunday of October, 02:00–02:59) is the first one (summer
 * time); a time that does not exist (last Sunday of March, 02:00–02:59) moves forward by the hour
 * skipped, as the clock itself does (02:30 → 03:30 +02:00).
 */
export function berlinLocalToIso(date: string, time: string): string | null {
  const d = DATE_RE.exec(date)
  const t = TIME_RE.exec(time)
  if (!d || !t) return null
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number)
  if (hour > 23 || minute > 59) return null
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  const check = new Date(wallAsUtc)
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null
  }

  // Berlin's offset a day before and a day after bounds every possible offset for this wall time.
  const offsetBefore = berlinOffsetMs(wallAsUtc - DAY_MS)
  const offsetAfter = berlinOffsetMs(wallAsUtc + DAY_MS)
  const candidates = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => wallAsUtc - offset)
    .filter((ms) => berlinOffsetMs(ms) === wallAsUtc - ms)
    .sort((a, b) => a - b)
  const ms = candidates.length > 0 ? candidates[0] : wallAsUtc - offsetBefore
  return toBerlinIso(ms)
}

/** An instant as ISO string with Berlin's offset: „2026-09-12T14:05:00+02:00" (seconds kept). */
export function toBerlinIso(instant: Instant | number): string {
  const ms = typeof instant === 'number' ? instant : toMs(instant)
  const w = berlinWallClock(ms)
  const offsetMinutes = berlinOffsetMs(ms) / MINUTE_MS
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  return (
    `${w.year}-${pad2(w.month)}-${pad2(w.day)}T${pad2(w.hour)}:${pad2(w.minute)}:${pad2(w.second)}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  )
}

/** An instant → the Berlin values for `<input type="date">` / `<input type="time">` („2026-09-12", „14:05"). */
export function isoToBerlinLocal(instant: Instant): { date: string; time: string } {
  const w = berlinWallClock(toMs(instant))
  return { date: `${w.year}-${pad2(w.month)}-${pad2(w.day)}`, time: `${pad2(w.hour)}:${pad2(w.minute)}` }
}
