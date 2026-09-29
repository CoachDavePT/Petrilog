// Input rules shared by the browser (react-hook-form) and the server (Server Actions) — PROJ-2
// design.md → Eingaberegeln, Datenmodell, Fangzeit-Garantie (AC-7, AC-12, AC-15, AC-16, AC-18, AC-21,
// AC-22, AC-24, EC-4). The schemas check shape and field rules only; the rules that need the clock or
// the session (future, duration, catch window) are pure helpers below that take `now` as a parameter.
import { z } from 'zod'
import { MESSAGES, sessionTooLong } from './messages'
import { SPECIES_IDS, type SpeciesId } from './species'

export const WATER_NAME_MAX = 80
export const NOTE_MAX = 500
export const BAIT_MAX = 60
export const SPECIES_OTHER_MAX = 40
export const LENGTH_MIN = 1
export const LENGTH_MAX = 250
export const WEIGHT_MIN = 1
export const WEIGHT_MAX = 150_000
export const ACCURACY_MAX = 100_000

const MINUTE_MS = 60_000
/** „In der Zukunft" means more than 2 minutes after the server clock — absorbs phone clock drift. */
export const FUTURE_TOLERANCE_MS = 2 * MINUTE_MS
export const SESSION_MIN_MS = MINUTE_MS
export const SESSION_MAX_MS = 48 * 60 * MINUTE_MS

/** Field errors keyed by field name, `form` for the general message — what the actions return. */
export type FieldErrors = Partial<Record<string, string>>

// ---------------------------------------------------------------------------------------------------
// Building blocks

/** Seconds and milliseconds set to 0 — every stored time is minute-exact. */
export function truncateToMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS)
}

/** Trimmed text; empty after trimming (or missing / null) counts as „not given" → `undefined`. */
function optionalText(max: number, tooLong: string) {
  return z
    .string({ error: MESSAGES.invalidInput })
    .trim()
    .max(max, { error: tooLong })
    .nullish()
    .transform((value) => value || undefined)
}

export const waterNameSchema = optionalText(WATER_NAME_MAX, MESSAGES.waterNameTooLong)
export const noteSchema = optionalText(NOTE_MAX, MESSAGES.noteTooLong)
export const baitSchema = optionalText(BAIT_MAX, MESSAGES.baitTooLong)

/** Ids are generated in the browser when the form opens (EC-2); the server only takes valid UUIDs. */
export const idSchema = z.uuid({ error: MESSAGES.invalidInput })

/** Output type of a builder: required → `T`, optional → `T | undefined`. */
type Maybe<R extends boolean, T> = R extends true ? T : T | undefined

/** A whole number from a number input or a form string („ 42 "); empty → `undefined`. */
function wholeNumber<R extends boolean>(min: number, max: number, message: string, required: R) {
  return z
    .union([z.number(), z.string()], { error: message })
    .nullish()
    .transform((raw, ctx): Maybe<R, number> => {
      const text = typeof raw === 'string' ? raw.trim() : raw
      if (text === undefined || text === null || text === '') {
        if (!required) return undefined as Maybe<R, number>
        ctx.issues.push({ code: 'custom', message, input: raw })
        return z.NEVER
      }
      const value = typeof text === 'number' ? text : /^\d+$/.test(text) ? Number(text) : NaN
      if (!Number.isInteger(value) || value < min || value > max) {
        ctx.issues.push({ code: 'custom', message, input: raw })
        return z.NEVER
      }
      return value
    })
}

export const lengthSchema = wholeNumber(LENGTH_MIN, LENGTH_MAX, MESSAGES.lengthInvalid, true)
export const weightSchema = wholeNumber(WEIGHT_MIN, WEIGHT_MAX, MESSAGES.weightInvalid, false)

const isoWithOffset = z.iso.datetime({ offset: true })

/**
 * A point in time: an ISO string WITH offset or `Z` (the browser converts the form's date + time), or a
 * Date. Output is a Date truncated to the minute. Missing → `requiredMessage` (or `undefined` if
 * optional); a string without offset or otherwise malformed → the general message.
 */
function timestamp<R extends boolean>(requiredMessage: string, required: R) {
  return z
    .union([z.string(), z.date()], { error: MESSAGES.invalidInput })
    .nullish()
    .transform((raw, ctx): Maybe<R, Date> => {
      if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        if (!required) return undefined as Maybe<R, Date>
        ctx.issues.push({ code: 'custom', message: requiredMessage, input: raw })
        return z.NEVER
      }
      const date =
        raw instanceof Date ? raw : isoWithOffset.safeParse(raw.trim()).success ? new Date(raw.trim()) : null
      if (!date || Number.isNaN(date.getTime())) {
        ctx.issues.push({ code: 'custom', message: MESSAGES.invalidInput, input: raw })
        return z.NEVER
      }
      return truncateToMinute(date)
    })
}

export const timeSchema = timestamp(MESSAGES.timeRequired, true)
export const optionalTimeSchema = timestamp(MESSAGES.timeRequired, false)
export const catchTimeSchema = timestamp(MESSAGES.catchTimeRequired, true)

export type Position = { latitude: number; longitude: number; accuracy: number }

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Lenient on purpose: an entry is never lost to a broken fix. All three values valid → a position
 * (accuracy rounded to whole meters, capped at 100 000 m); anything missing, partial or implausible → `null`.
 */
export function toPosition(value: unknown): Position | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const latitude = toNumber(raw.latitude)
  const longitude = toNumber(raw.longitude)
  const accuracy = toNumber(raw.accuracy)
  if (latitude === null || longitude === null || accuracy === null) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0) return null
  return { latitude, longitude, accuracy: Math.min(Math.round(accuracy), ACCURACY_MAX) }
}

/** Never fails; see `toPosition`. A missing position is `null` („Ohne Position"). */
export const positionSchema = z.unknown().optional().transform(toPosition)

export const speciesSchema = z.enum(SPECIES_IDS, { error: MESSAGES.speciesRequired })

// ---------------------------------------------------------------------------------------------------
// Schemas per action

/** „Session starten" (AC-6, AC-7): the start time is the server's „now", not an input. */
export const startSessionSchema = z.object({
  id: idSchema,
  waterName: waterNameSchema,
  note: noteSchema,
  position: positionSchema,
})

/**
 * „Session nachtragen" (AC-13–AC-16). Without the switch „Ich bin noch am Gewässer" the session is
 * „Ohne Position", whatever position was sent. Time rules: `sessionTimeErrors`.
 */
export const backfillSessionSchema = z
  .object({
    id: idSchema,
    waterName: waterNameSchema,
    note: noteSchema,
    startedAt: timeSchema,
    endedAt: timeSchema,
    useCurrentPosition: z.boolean({ error: MESSAGES.invalidInput }).optional().default(false),
    position: positionSchema,
  })
  .transform((v) => ({ ...v, position: v.useCurrentPosition ? v.position : null }))

/**
 * „Session bearbeiten" (AC-17, AC-18, EC-9). `endedAt` only counts for an ended session — the action
 * ignores it for a running one. The position is never part of an edit (removal is its own action).
 */
export const editSessionSchema = z.object({
  id: idSchema,
  waterName: waterNameSchema,
  note: noteSchema,
  startedAt: timeSchema,
  endedAt: optionalTimeSchema,
})

/**
 * `when` for a cross-field refine: run it (even while OTHER fields have errors, so all messages show at
 * once) only if the payload is an object and the fields it reads are valid.
 */
function fieldsValid(...fields: string[]) {
  return (payload: z.core.ParsePayload): boolean =>
    typeof payload.value === 'object' &&
    payload.value !== null &&
    !payload.issues.some((i) => !i.path?.length || fields.includes(String(i.path[0])))
}

export const END_MODES = ['now', 'last-catch', 'custom'] as const
export type EndMode = (typeof END_MODES)[number]

/** „Session beenden" (AC-10–AC-12): „Jetzt", „Zeit des letzten Fangs" or „Eigene Uhrzeit" (needs a time). */
export const endSessionSchema = z
  .object({
    id: idSchema,
    mode: z.enum(END_MODES, { error: MESSAGES.invalidInput }),
    endedAt: optionalTimeSchema,
  })
  .refine((v) => v.mode !== 'custom' || v.endedAt !== undefined, {
    path: ['endedAt'],
    error: MESSAGES.timeRequired,
    when: fieldsValid('mode', 'endedAt'),
  })
  .transform((v) => (v.mode === 'custom' ? v : { ...v, endedAt: undefined }))

const catchShape = {
  id: idSchema,
  sessionId: idSchema,
  caughtAt: catchTimeSchema,
  species: speciesSchema,
  /** Checked against the species below: required iff `other`, dropped otherwise. */
  speciesOther: z
    .string({ error: MESSAGES.invalidInput })
    .trim()
    .nullish()
    .transform((value) => value || undefined),
  lengthCm: lengthSchema,
  weightG: weightSchema,
  bait: baitSchema,
  released: z.boolean({ error: MESSAGES.releasedRequired }),
}

type SpeciesPart = { species: SpeciesId; speciesOther?: string | undefined }

/** Required iff `other`, at most 40 characters (AC-21); any name sent with another species is dropped. */
function withSpeciesOther<T extends z.ZodType<SpeciesPart>>(schema: T) {
  return schema
    .refine((v) => v.species !== 'other' || v.speciesOther !== undefined, {
      path: ['speciesOther'],
      error: MESSAGES.speciesOtherRequired,
      when: fieldsValid('species', 'speciesOther'),
    })
    .refine((v) => v.species !== 'other' || (v.speciesOther?.length ?? 0) <= SPECIES_OTHER_MAX, {
      path: ['speciesOther'],
      error: MESSAGES.speciesOtherTooLong,
      when: fieldsValid('species', 'speciesOther'),
    })
    .transform((v): z.output<T> => (v.species === 'other' ? v : { ...v, speciesOther: undefined }))
}

/** „Fang eintragen / nachtragen" (AC-20–AC-26). Where the position comes from decides the action. */
export const createCatchSchema = withSpeciesOther(z.object({ ...catchShape, position: positionSchema }))

/** „Fang bearbeiten" (AC-27): same rules, the position is not part of an edit. */
export const editCatchSchema = withSpeciesOther(z.object(catchShape))

export type StartSessionInput = z.input<typeof startSessionSchema>
export type StartSessionData = z.output<typeof startSessionSchema>
export type BackfillSessionInput = z.input<typeof backfillSessionSchema>
export type BackfillSessionData = z.output<typeof backfillSessionSchema>
export type EditSessionInput = z.input<typeof editSessionSchema>
export type EditSessionData = z.output<typeof editSessionSchema>
export type EndSessionInput = z.input<typeof endSessionSchema>
export type EndSessionData = z.output<typeof endSessionSchema>
export type CreateCatchInput = z.input<typeof createCatchSchema>
export type CreateCatchData = z.output<typeof createCatchSchema>
export type EditCatchInput = z.input<typeof editCatchSchema>
export type EditCatchData = z.output<typeof editCatchSchema>

// ---------------------------------------------------------------------------------------------------
// Errors

/**
 * First message per field. A broken request (no object, wrong type, bad id …) carries no field message
 * a user could act on — it becomes the general „Bitte prüfe deine Eingaben." under `form`, never
 * Zod's English default text.
 */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const general = issue.path.length === 0 || issue.message === MESSAGES.invalidInput
    const key = general ? 'form' : String(issue.path[0])
    if (!out[key]) out[key] = general ? MESSAGES.invalidInput : issue.message
  }
  return out
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors }

export function parseInput<S extends z.ZodType>(schema: S, raw: unknown): ParseResult<z.output<S>> {
  const result = schema.safeParse(raw)
  return result.success ? { ok: true, data: result.data } : { ok: false, fieldErrors: fieldErrors(result.error) }
}

// ---------------------------------------------------------------------------------------------------
// Rules that need the clock or the session — pure, `now` is a parameter

/** More than 2 minutes after `now`. */
export function isInFuture(time: Date, now: Date): boolean {
  return time.getTime() > now.getTime() + FUTURE_TOLERANCE_MS
}

/**
 * Session times (AC-12, AC-15, EC-9): nothing in the future, the end after the start, at least 1 minute
 * and at most 48 hours. `endedAt: null` = running (only the start is checked). `formatDateTime` renders
 * the latest allowed end for the 48-hour message („bis 14.09., 06:00") — pass format.ts's helper.
 */
export function sessionTimeErrors(
  times: { startedAt: Date; endedAt: Date | null; now: Date },
  formatDateTime: (date: Date) => string,
): FieldErrors {
  const { startedAt, endedAt, now } = times
  const out: FieldErrors = {}
  if (isInFuture(startedAt, now)) out.startedAt = MESSAGES.timeInFuture
  if (endedAt) {
    const duration = endedAt.getTime() - startedAt.getTime()
    if (isInFuture(endedAt, now)) out.endedAt = MESSAGES.timeInFuture
    else if (duration <= 0) out.endedAt = MESSAGES.endBeforeStart
    else if (duration < SESSION_MIN_MS) out.endedAt = MESSAGES.sessionTooShort
    else if (duration > SESSION_MAX_MS) {
      out.endedAt = sessionTooLong(formatDateTime(new Date(startedAt.getTime() + SESSION_MAX_MS)))
    }
  }
  return out
}

export type CatchWindowCheck =
  | { ok: true }
  /** `to` is the session end, or `now` (minute) for a running session — the tolerance is not shown. */
  | { ok: false; from: Date; to: Date; running: boolean }

/**
 * Catch time (AC-24, EC-4, EC-10): between start and end of the session, both included. A running
 * session ends at „now + 2 minutes". Build the message with `catchTimeRange(format(from), format(to))`.
 */
export function checkCatchTime(
  caughtAt: Date,
  session: { startedAt: Date; endedAt: Date | null },
  now: Date,
): CatchWindowCheck {
  const running = session.endedAt === null
  const upper = running ? now.getTime() + FUTURE_TOLERANCE_MS : session.endedAt!.getTime()
  const t = caughtAt.getTime()
  if (t >= session.startedAt.getTime() && t <= upper) return { ok: true }
  return { ok: false, from: session.startedAt, to: running ? truncateToMinute(now) : session.endedAt!, running }
}

/**
 * The earliest catch that new session times would leave outside (AC-18, AC-12, EC-9), or `null`.
 * Build the message with `catchOutsideSession(format(caughtAt), catchSpeciesName(catch))`.
 */
export function firstCatchOutside<C extends { caughtAt: Date }>(
  catches: readonly C[],
  session: { startedAt: Date; endedAt: Date | null },
  now: Date,
): C | null {
  const sorted = [...catches].sort((a, b) => a.caughtAt.getTime() - b.caughtAt.getTime())
  return sorted.find((c) => !checkCatchTime(c.caughtAt, session, now).ok) ?? null
}
