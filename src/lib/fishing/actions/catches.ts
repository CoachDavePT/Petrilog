'use server'

// Server Actions for catches — PROJ-2 design.md → „Fang eintragen, nachtragen, bearbeiten",
// „Position entfernen", „Doppeltes Speichern", „Fangzeit-Garantie", „Zugriff" (AC-20, AC-22, AC-24–AC-28,
// AC-32, AC-38, AC-40, EC-2, EC-4, EC-5, EC-10). Every action re-checks the login first (requireUser), takes
// the user from that verified session, writes with the user's own Supabase client (RLS checks every write
// a second time) and uses the server clock as „now". Redirects are thrown, so they stay outside `try`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { mapDbError } from '../db-errors'
import { formatEndTime, formatShortDateTime, formatTime, isSameBerlinDay } from '../format'
import { catchTimeRange, MESSAGES, sessionEndedMeanwhile } from '../messages'
import {
  checkCatchTime,
  createCatchSchema,
  editCatchSchema,
  idSchema,
  parseInput,
  truncateToMinute,
  type CreateCatchData,
  type CreateCatchInput,
  type EditCatchData,
  type EditCatchInput,
  type FieldErrors,
} from '../schemas'

/** What a catch action returns to its form. Redirects (success, session gone, login) are thrown. */
export type CatchActionResult =
  | { status: 'success'; message?: string }
  | { status: 'error'; message?: string; fieldErrors?: FieldErrors }

/**
 * „Fang eintragen / nachtragen". `sessionWasRunning`: the form was opened for a running session — if the
 * session has been ended meanwhile (other device) and the time lies after that end, the field shows
 * „Die Session wurde inzwischen beendet (Ende …)." instead of the range (EC-4).
 */
export type CreateCatchActionInput = CreateCatchInput & { sessionWasRunning?: boolean }
export type EditCatchActionInput = EditCatchInput
export type CatchIdInput = { id: string }
/** `sessionId`: the session the form belongs to — a repeated delete then leads back there (BUG-5). */
export type DeleteCatchInput = CatchIdInput & { sessionId?: string }

const idOnlySchema = z.object({ id: idSchema })
const deleteCatchSchema = z.object({ id: idSchema, sessionId: idSchema.optional() })

const SESSION_GONE = '/?notice=session-gone'

type SessionRow = {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
}

type Session = {
  id: string
  userId: string
  startedAt: Date
  endedAt: Date | null
  position: { latitude: number; longitude: number; accuracy: number } | null
}

type PositionColumns = {
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  position_source: 'gps' | 'session' | 'none'
}

/** A redirect is decided inside `try` and performed outside it (`redirect` throws). */
type Outcome = { redirect: string } | { result: CatchActionResult }

// ---------------------------------------------------------------------------------------------------
// Helpers

function logFishingError(scope: string, error: unknown): void {
  // Kind and code only — never the input (no positions, no names).
  const e = error as { name?: string; code?: string; message?: string } | null
  console.error(`[fishing] ${scope} failed:`, e?.name ?? 'Error', e?.code ?? '', e?.message ?? String(error))
}

function network(): Outcome {
  return { result: { status: 'error', message: MESSAGES.network } }
}

/** A broken request → the general message; otherwise the messages at the fields (AC-22). */
function inputError(errors: FieldErrors): CatchActionResult {
  const { form, ...fields } = errors
  if (!form) return { status: 'error', fieldErrors: errors }
  return Object.keys(fields).length > 0
    ? { status: 'error', message: MESSAGES.invalidInput, fieldErrors: fields }
    : { status: 'error', message: MESSAGES.invalidInput }
}

function caughtAtError(message: string): Outcome {
  return { result: { status: 'error', fieldErrors: { caughtAt: message } } }
}

/** The own session, or `null` when it is gone or not the user's (RLS hides foreign rows). */
async function loadSession(supabase: SupabaseClient, sessionId: string, userId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, user_id, started_at, ended_at, latitude, longitude, accuracy_m')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as SessionRow
  const hasPosition = row.latitude !== null && row.longitude !== null && row.accuracy_m !== null
  return {
    id: row.id,
    userId: row.user_id,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at === null ? null : new Date(row.ended_at),
    position: hasPosition ? { latitude: row.latitude!, longitude: row.longitude!, accuracy: row.accuracy_m! } : null,
  }
}

/** „zwischen 14:05 und 18:40" — with the date when the session spans more than one Berlin day. */
function rangeMessage(from: Date, to: Date): string {
  const fmt = isSameBerlinDay(from, to) ? formatTime : formatShortDateTime
  return catchTimeRange(fmt(from), fmt(to))
}

/**
 * The field message for a catch time outside `session` (AC-24, EC-4, EC-10), always with the session's
 * current times. `endedMeanwhile`: the form was filled while the session was running.
 */
function catchTimeMessage(caughtAt: Date, session: Session, now: Date, endedMeanwhile: boolean): string {
  if (endedMeanwhile && session.endedAt && caughtAt.getTime() > session.endedAt.getTime()) {
    return sessionEndedMeanwhile(formatEndTime(session.startedAt, session.endedAt))
  }
  const check = checkCatchTime(caughtAt, session, now)
  if (!check.ok) return rangeMessage(check.from, check.to)
  // The database refused a time the app accepts (the „now + 2 min" edge moved): name the window anyway.
  return rangeMessage(session.startedAt, session.endedAt ?? truncateToMinute(now))
}

/**
 * Where the catch position comes from (AC-20, AC-25, AC-26): a form opened for a running session takes the
 * fix the browser sent (`gps`) — also when the session was ended meanwhile on another device (design.md EC-4:
 * „Die Position bleibt die ermittelte"); otherwise a copy of the session's position (`session`), else none.
 * „Fang nachtragen" in an ended session never uses a client position. The catch keeps its own copy (AC-38).
 */
function catchPosition(
  session: Session,
  clientPosition: CreateCatchData['position'],
  sessionWasRunning: boolean,
): PositionColumns {
  if ((session.endedAt === null || sessionWasRunning) && clientPosition) {
    return {
      latitude: clientPosition.latitude,
      longitude: clientPosition.longitude,
      accuracy_m: clientPosition.accuracy,
      position_source: 'gps',
    }
  }
  if (session.position) {
    return {
      latitude: session.position.latitude,
      longitude: session.position.longitude,
      accuracy_m: session.position.accuracy,
      position_source: 'session',
    }
  }
  return { latitude: null, longitude: null, accuracy_m: null, position_source: 'none' }
}

function catchFields(data: {
  caughtAt: Date
  species: string
  speciesOther?: string | undefined
  lengthCm: number
  weightG?: number | undefined
  bait?: string | undefined
  released: boolean
}) {
  return {
    caught_at: data.caughtAt.toISOString(),
    species: data.species,
    species_other: data.speciesOther ?? null,
    length_cm: data.lengthCm,
    weight_g: data.weightG ?? null,
    bait: data.bait ?? null,
    released: data.released,
  }
}

/** Catch counts show in the overview, the active-session bar and the detail view. */
function revalidateFishingPages(): void {
  revalidatePath('/', 'layout')
}

function finish(outcome: Outcome): CatchActionResult {
  if ('redirect' in outcome) redirect(outcome.redirect)
  return outcome.result
}

// ---------------------------------------------------------------------------------------------------
// Actions

/**
 * „Fang speichern" in a running session (AC-20) or „Fang nachtragen" in an ended one (AC-26). Create only
 * if this id is new (EC-2). Success → `/sessions/<id>?notice=catch-saved`; session gone → `/?notice=session-gone`.
 */
export async function createCatch(input: CreateCatchActionInput): Promise<CatchActionResult> {
  const user = await requireUser()
  const parsed = parseInput(createCatchSchema, input)
  if (!parsed.ok) return inputError(parsed.fieldErrors)
  const data = parsed.data
  const sessionWasRunning =
    typeof input === 'object' && input !== null && (input as { sessionWasRunning?: unknown }).sessionWasRunning === true

  let outcome: Outcome
  try {
    outcome = await createCatchOutcome(await createClient(), user.id, data, sessionWasRunning)
  } catch (e) {
    logFishingError('create-catch', e)
    outcome = network()
  }
  return finish(outcome)
}

async function createCatchOutcome(
  supabase: SupabaseClient,
  userId: string,
  data: CreateCatchData,
  sessionWasRunning: boolean,
): Promise<Outcome> {
  const now = new Date()
  const session = await loadSession(supabase, data.sessionId, userId)
  if (!session) return { redirect: SESSION_GONE }

  if (!checkCatchTime(data.caughtAt, session, now).ok) {
    return caughtAtError(catchTimeMessage(data.caughtAt, session, now, sessionWasRunning))
  }

  const { error } = await supabase.from('catches').insert({
    id: data.id,
    session_id: session.id,
    user_id: session.userId,
    ...catchFields(data),
    ...catchPosition(session, data.position, sessionWasRunning),
  })

  if (error) {
    const mapped = mapDbError(error)
    if (mapped.kind === 'duplicate-id') {
      // A repeat of this very save (double tap, retry after a lost connection) → as if just saved.
      const { data: existing, error: readError } = await supabase
        .from('catches')
        .select('id, session_id')
        .eq('id', data.id)
        .eq('user_id', userId)
        .maybeSingle()
      if (readError) throw readError
      const own = existing as { id: string; session_id: string } | null
      if (!own || own.session_id !== session.id) {
        // The id belongs to someone else (RLS hides it) or to another catch: nothing is saved.
        return { result: { status: 'error', message: MESSAGES.invalidInput } }
      }
    } else if (mapped.kind === 'catch-outside') {
      // Lost the race against an end or a time change on another device (EC-4): show the current window.
      const current = await loadSession(supabase, data.sessionId, userId)
      if (!current) return { redirect: SESSION_GONE }
      const endedMeanwhile = sessionWasRunning || (session.endedAt === null && current.endedAt !== null)
      return caughtAtError(catchTimeMessage(data.caughtAt, current, new Date(), endedMeanwhile))
    } else if (mapped.kind === 'session-gone') {
      return { redirect: SESSION_GONE }
    } else {
      throw error
    }
  }

  revalidateFishingPages()
  return { redirect: `/sessions/${session.id}?notice=catch-saved` }
}

/**
 * „Fang bearbeiten" (AC-27): same field rules and catch-time check against the session's CURRENT times
 * (EC-10). The position and the session never change here. Success → `/sessions/<id>?notice=catch-saved`.
 */
export async function updateCatch(input: EditCatchActionInput): Promise<CatchActionResult> {
  const user = await requireUser()
  const parsed = parseInput(editCatchSchema, input)
  if (!parsed.ok) return inputError(parsed.fieldErrors)
  const data = parsed.data

  let outcome: Outcome
  try {
    outcome = await updateCatchOutcome(await createClient(), user.id, data)
  } catch (e) {
    logFishingError('update-catch', e)
    outcome = network()
  }
  return finish(outcome)
}

async function updateCatchOutcome(
  supabase: SupabaseClient,
  userId: string,
  data: EditCatchData,
): Promise<Outcome> {
  const now = new Date()
  const { data: existing, error: readError } = await supabase
    .from('catches')
    .select('id, session_id')
    .eq('id', data.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (!existing) return { redirect: SESSION_GONE }
  // The catch's own session counts, whatever the form sent: a catch never moves.
  const sessionId = (existing as { session_id: string }).session_id

  const session = await loadSession(supabase, sessionId, userId)
  if (!session) return { redirect: SESSION_GONE }
  if (!checkCatchTime(data.caughtAt, session, now).ok) {
    return caughtAtError(catchTimeMessage(data.caughtAt, session, now, false))
  }

  const { data: updated, error } = await supabase
    .from('catches')
    .update(catchFields(data))
    .eq('id', data.id)
    .eq('user_id', userId)
    .select('id')
  if (error) {
    const mapped = mapDbError(error)
    if (mapped.kind === 'catch-outside') {
      const current = await loadSession(supabase, sessionId, userId)
      if (!current) return { redirect: SESSION_GONE }
      return caughtAtError(catchTimeMessage(data.caughtAt, current, new Date(), false))
    }
    if (mapped.kind === 'session-gone') return { redirect: SESSION_GONE }
    throw error
  }
  // Deleted in the meantime (other device, EC-5): nothing was changed.
  if (!Array.isArray(updated) || updated.length === 0) return { redirect: SESSION_GONE }

  revalidateFishingPages()
  return { redirect: `/sessions/${sessionId}?notice=catch-saved` }
}

/** „Fang löschen" after the dialog (AC-28): final, nothing is kept (AC-40). → `/sessions/<id>?notice=catch-deleted`. */
export async function deleteCatch(input: DeleteCatchInput): Promise<CatchActionResult> {
  const user = await requireUser()
  const parsed = parseInput(deleteCatchSchema, input)
  if (!parsed.ok) return inputError(parsed.fieldErrors)

  let outcome: Outcome
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('catches')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)
      .select('session_id')
    if (error) throw error
    const row = Array.isArray(data) ? (data[0] as { session_id: string } | undefined) : undefined
    if (!row) {
      // Already deleted (a second tap, another device): if its session is still there, the result the
      // user wanted holds — back to the session, not „Diese Session gibt es nicht mehr." (BUG-5).
      const sessionId = parsed.data.sessionId
      const session = sessionId ? await loadSession(supabase, sessionId, user.id) : null
      outcome = { redirect: session ? `/sessions/${session.id}?notice=catch-deleted` : SESSION_GONE }
    } else {
      revalidateFishingPages()
      outcome = { redirect: `/sessions/${row.session_id}?notice=catch-deleted` }
    }
  } catch (e) {
    logFishingError('delete-catch', e)
    outcome = network()
  }
  return finish(outcome)
}

/**
 * „Position entfernen" in „Fang bearbeiten" after the dialog (AC-38): latitude, longitude and accuracy
 * become empty, the source `none`. Stays on the page → `{ status: 'success' }`.
 */
export async function removeCatchPosition(input: CatchIdInput): Promise<CatchActionResult> {
  const user = await requireUser()
  const parsed = parseInput(idOnlySchema, input)
  if (!parsed.ok) return inputError(parsed.fieldErrors)
  const id = parsed.data.id

  let outcome: Outcome
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('catches')
      .update({ latitude: null, longitude: null, accuracy_m: null, position_source: 'none' })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('session_id')
    if (error) throw error
    const row = Array.isArray(data) ? (data[0] as { session_id: string } | undefined) : undefined
    if (!row) {
      outcome = { redirect: SESSION_GONE }
    } else {
      revalidatePath(`/sessions/${row.session_id}`)
      revalidatePath(`/sessions/${row.session_id}/catches/${id}`)
      outcome = { result: { status: 'success' } }
    }
  } catch (e) {
    logFishingError('remove-catch-position', e)
    outcome = network()
  }
  return finish(outcome)
}
