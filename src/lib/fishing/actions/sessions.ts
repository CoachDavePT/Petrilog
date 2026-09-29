'use server'

// Session actions (PROJ-2 design.md → Session starten / beenden / nachtragen und bearbeiten, Position
// entfernen, Session löschen, Doppeltes Speichern; AC-6, AC-8 – AC-10, AC-12, AC-13, AC-15 – AC-19,
// AC-38, AC-40, EC-1, EC-2, EC-5, EC-6, EC-9, EC-13).
//
// Every action re-checks the login first (requireUser, as in PROJ-1) and writes with the user's own
// Supabase session, so Row Level Security checks each write a second time. The owner always comes from
// the verified login, never from the input; "now" is the server clock. The app checks the rules first
// for a friendly message, the database constraints are the guarantee (their refusals are mapped to the
// same messages). A session only ever moves from running to ended — nothing here sets `ended_at` back
// to null (EC-13).
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/require-user'
import { createClient } from '@/lib/supabase/server'
import { mapDbError } from '../db-errors'
import { formatShortDate, formatShortDateTime, formatTime, formatEndTime, isSameBerlinDay } from '../format'
import { catchOutsideSession, MESSAGES, overlapsRunningSession, overlapsSession } from '../messages'
import {
  backfillSessionSchema,
  editSessionSchema,
  endSessionSchema,
  firstCatchOutside,
  idSchema,
  parseInput,
  sessionTimeErrors,
  startSessionSchema,
  truncateToMinute,
  type BackfillSessionInput,
  type EditSessionInput,
  type EndSessionInput,
  type FieldErrors,
  type Position,
  type StartSessionInput,
} from '../schemas'
import { catchSpeciesName } from '../species'

/** What a session action returns to its form. Redirects are thrown by `redirect`, not returned. */
export type SessionActionResult =
  | { status: 'success'; message?: string }
  | { status: 'error'; message?: string; fieldErrors?: FieldErrors }

export type SessionIdInput = { id: string }

type Outcome = SessionActionResult | { redirectTo: string }

type SessionRow = { id: string; started_at: string; ended_at: string | null }
type CatchRow = { caught_at: string; species: string; species_other: string | null }
type TimedCatch = CatchRow & { caughtAt: Date }

const sessionIdSchema = z.object({ id: idSchema })

const detail = (id: string, notice?: string) => `/sessions/${id}${notice ? `?notice=${notice}` : ''}`
const GONE = '/?notice=session-gone'

// ---------------------------------------------------------------------------------------------------
// Plumbing

/** Server log line for a technical failure — scope and error code only, never the input or row values. */
function logFishingError(scope: string, error: unknown): void {
  const e = error as { name?: string; code?: string; status?: number; message?: string } | null
  console.error(`[fishing] ${scope} failed:`, e?.name ?? 'Error', e?.code ?? '', e?.status ?? '', e?.message ?? '')
}

/**
 * Runs the body; a thrown technical error becomes „Keine Verbindung …" (as in PROJ-1). A redirect is
 * issued only here, outside the try, because `redirect` itself throws.
 */
async function run(scope: string, body: () => Promise<Outcome>): Promise<SessionActionResult> {
  let outcome: Outcome
  try {
    outcome = await body()
  } catch (e) {
    logFishingError(scope, e)
    return { status: 'error', message: MESSAGES.network }
  }
  if ('redirectTo' in outcome) {
    revalidatePath('/', 'layout')
    redirect(outcome.redirectTo)
  }
  return outcome
}

/** A rejected payload: field messages at their fields, a broken request as the general message. */
function invalid(errors: FieldErrors): SessionActionResult {
  const { form, ...fields } = errors
  const result: SessionActionResult = { status: 'error' }
  if (form) result.message = form
  if (Object.keys(fields).length > 0) result.fieldErrors = fields
  if (!form && !result.fieldErrors) result.message = MESSAGES.invalidInput
  return result
}

const failure = (message: string): SessionActionResult => ({ status: 'error', message })

/** The session as this user sees it (RLS + explicit owner filter); `null` = gone or someone else's. */
async function loadOwnSession(supabase: SupabaseClient, userId: string, id: string): Promise<SessionRow | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as SessionRow | null) ?? null
}

async function loadCatches(supabase: SupabaseClient, userId: string, sessionId: string): Promise<TimedCatch[]> {
  const { data, error } = await supabase
    .from('catches')
    .select('caught_at, species, species_other')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('caught_at', { ascending: true })
  if (error) throw error
  return ((data ?? []) as CatchRow[]).map((c) => ({ ...c, caughtAt: new Date(c.caught_at) }))
}

/** „Der Fang um 17:20 (Hecht) läge außerhalb der Session." — with the date when not on the start's day. */
function catchOutsideMessage(entry: TimedCatch, sessionStart: Date): string {
  return catchOutsideSession(formatEndTime(sessionStart, entry.caughtAt), catchSpeciesName(entry))
}

/**
 * The earliest own session (other than `exceptId`) that the span [start, end) would overlap — a
 * running session counts as open-ended, touching ends are fine (same rule as `sessions_no_overlap`).
 */
async function findOverlap(
  supabase: SupabaseClient,
  userId: string,
  span: { start: Date; end: Date | null; exceptId: string },
): Promise<SessionRow | null> {
  let query = supabase
    .from('sessions')
    .select('id, started_at, ended_at')
    .eq('user_id', userId)
    .neq('id', span.exceptId)
    .or(`ended_at.is.null,ended_at.gt."${span.start.toISOString()}"`)
  if (span.end) query = query.lt('started_at', span.end.toISOString())
  const { data, error } = await query.order('started_at', { ascending: true }).limit(1)
  if (error) throw error
  return ((data ?? []) as SessionRow[])[0] ?? null
}

/** „Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00." / „… laufenden Session seit 14:05." */
function overlapMessage(other: SessionRow, now: Date): string {
  const start = new Date(other.started_at)
  if (other.ended_at === null) {
    return overlapsRunningSession(isSameBerlinDay(start, now) ? formatTime(start) : formatShortDateTime(start))
  }
  return overlapsSession(formatShortDate(start), formatTime(start), formatEndTime(start, other.ended_at))
}

/** After the database refused an overlap: name the session in the way, as the pre-check would have. */
async function overlapFailure(
  supabase: SupabaseClient,
  userId: string,
  span: { start: Date; end: Date | null; exceptId: string },
  now: Date,
): Promise<SessionActionResult> {
  const other = await findOverlap(supabase, userId, span)
  return failure(other ? overlapMessage(other, now) : MESSAGES.invalidInput)
}

/** After the database refused a catch outside: name the catch, as the pre-check would have. */
async function catchOutsideFailure(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  times: { startedAt: Date; endedAt: Date | null },
  now: Date,
): Promise<string> {
  const outside = firstCatchOutside(await loadCatches(supabase, userId, sessionId), times, now)
  return outside ? catchOutsideMessage(outside, times.startedAt) : MESSAGES.invalidInput
}

/**
 * „Anlegen, falls es diese Kennung noch nicht gibt" (EC-2): the id already exists. The user's own
 * session → the earlier attempt went through, answer as if just saved. Someone else's → reject.
 */
async function isOwnExisting(supabase: SupabaseClient, userId: string, id: string): Promise<boolean> {
  return (await loadOwnSession(supabase, userId, id)) !== null
}

function positionColumns(position: Position | null) {
  return {
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    accuracy_m: position?.accuracy ?? null,
  }
}

// ---------------------------------------------------------------------------------------------------
// Actions

/**
 * „Session starten" (AC-6, AC-8, AC-9, EC-1, EC-2): start = now (minute), position as sent or none.
 * Success → `/sessions/<id>?notice=session-started`; a session already running →
 * `/sessions/<running>?notice=session-running`.
 */
export async function startSession(input: StartSessionInput): Promise<SessionActionResult> {
  const user = await requireUser()
  const parsed = parseInput(startSessionSchema, input)
  if (!parsed.ok) return invalid(parsed.fieldErrors)
  const data = parsed.data

  return run('start-session', async () => {
    const supabase = await createClient()
    const { error } = await supabase.from('sessions').insert({
      id: data.id,
      user_id: user.id,
      started_at: truncateToMinute(new Date()).toISOString(),
      water_name: data.waterName ?? null,
      note: data.note ?? null,
      ...positionColumns(data.position),
    })
    if (!error) return { redirectTo: detail(data.id, 'session-started') }

    const kind = mapDbError(error).kind
    if (kind === 'duplicate-id') {
      if (await isOwnExisting(supabase, user.id, data.id)) return { redirectTo: detail(data.id, 'session-started') }
      return failure(MESSAGES.invalidInput)
    }
    if (kind === 'running-exists') {
      const { data: running, error: readError } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .maybeSingle()
      if (readError) throw readError
      const runningId = (running as { id: string } | null)?.id
      // The running one is this very id: a repeat of a start that already went through (EC-2).
      if (runningId === data.id) return { redirectTo: detail(data.id, 'session-started') }
      if (runningId) return { redirectTo: detail(runningId, 'session-running') }
      return failure(MESSAGES.invalidInput) // ended in between — the user may simply try again
    }
    throw error
  })
}

/**
 * „Session nachtragen" (AC-13, AC-15, AC-16, EC-2): an ended session, position only with
 * „Ich bin noch am Gewässer". Success → `/sessions/<id>?notice=session-saved`.
 */
export async function backfillSession(input: BackfillSessionInput): Promise<SessionActionResult> {
  const user = await requireUser()
  const parsed = parseInput(backfillSessionSchema, input)
  if (!parsed.ok) return invalid(parsed.fieldErrors)
  const data = parsed.data
  const now = new Date()

  const timeErrors = sessionTimeErrors({ startedAt: data.startedAt, endedAt: data.endedAt, now }, formatShortDateTime)
  if (Object.keys(timeErrors).length > 0) return invalid(timeErrors)

  return run('backfill-session', async () => {
    const supabase = await createClient()
    // Its own id is left out: a repeat of this very save must not collide with its first attempt.
    const span = { start: data.startedAt, end: data.endedAt, exceptId: data.id }
    const other = await findOverlap(supabase, user.id, span)
    if (other) return failure(overlapMessage(other, now))

    const { error } = await supabase.from('sessions').insert({
      id: data.id,
      user_id: user.id,
      started_at: data.startedAt.toISOString(),
      ended_at: data.endedAt.toISOString(),
      water_name: data.waterName ?? null,
      note: data.note ?? null,
      ...positionColumns(data.position),
    })
    if (!error) return { redirectTo: detail(data.id, 'session-saved') }

    const kind = mapDbError(error).kind
    if (kind === 'duplicate-id') {
      if (await isOwnExisting(supabase, user.id, data.id)) return { redirectTo: detail(data.id, 'session-saved') }
      return failure(MESSAGES.invalidInput)
    }
    if (kind === 'overlap') return overlapFailure(supabase, user.id, span, now)
    throw error
  })
}

/**
 * „Session bearbeiten" (AC-15 – AC-18, EC-5, EC-9, EC-13): water name, note, start — the end only for
 * an ended session. The position never changes here. Gone or someone else's → `/?notice=session-gone`;
 * success → `/sessions/<id>?notice=session-saved`.
 */
export async function updateSession(input: EditSessionInput): Promise<SessionActionResult> {
  const user = await requireUser()
  const parsed = parseInput(editSessionSchema, input)
  if (!parsed.ok) return invalid(parsed.fieldErrors)
  const data = parsed.data
  const now = new Date()

  return run('update-session', async () => {
    const supabase = await createClient()
    const session = await loadOwnSession(supabase, user.id, data.id)
    if (!session) return { redirectTo: GONE }

    const running = session.ended_at === null
    // A running session keeps running: whatever end was sent is ignored (EC-13 in the other direction).
    const endedAt = running ? null : (data.endedAt ?? null)
    if (!running && !endedAt) return invalid({ endedAt: MESSAGES.timeRequired })
    const times = { startedAt: data.startedAt, endedAt }

    const timeErrors = sessionTimeErrors({ ...times, now }, formatShortDateTime)
    if (Object.keys(timeErrors).length > 0) return invalid(timeErrors)

    const outside = firstCatchOutside(await loadCatches(supabase, user.id, data.id), times, now)
    if (outside) return failure(catchOutsideMessage(outside, data.startedAt))

    const span = { start: data.startedAt, end: endedAt, exceptId: data.id }
    const other = await findOverlap(supabase, user.id, span)
    if (other) return failure(overlapMessage(other, now))

    const changes: Record<string, string | null> = {
      water_name: data.waterName ?? null,
      note: data.note ?? null,
      started_at: data.startedAt.toISOString(),
    }
    if (endedAt) changes.ended_at = endedAt.toISOString()
    // Only in the state it was loaded in: running stays running, ended stays ended.
    let update = supabase.from('sessions').update(changes).eq('id', data.id).eq('user_id', user.id)
    update = running ? update.is('ended_at', null) : update.not('ended_at', 'is', null)
    const { data: rows, error } = await update.select('id')

    if (error) {
      const kind = mapDbError(error).kind
      if (kind === 'catch-outside') return failure(await catchOutsideFailure(supabase, user.id, data.id, times, now))
      if (kind === 'overlap') return overlapFailure(supabase, user.id, span, now)
      throw error
    }
    if (!rows || rows.length === 0) {
      // Deleted or ended on another device in the meantime: nothing saved.
      return { redirectTo: (await isOwnExisting(supabase, user.id, data.id)) ? detail(data.id) : GONE }
    }
    return { redirectTo: detail(data.id, 'session-saved') }
  })
}

/**
 * „Session beenden" (AC-10, AC-12, EC-5, EC-6, EC-13): end = now, the last catch's time, or a time of
 * one's own. Written only while the end is still empty; ended already (here or on another device) →
 * `/sessions/<id>` without error. Success → `/sessions/<id>?notice=session-ended`.
 * Problems with a custom time come back at `endedAt`, for „Jetzt" / „letzter Fang" as the message.
 */
export async function endSession(input: EndSessionInput): Promise<SessionActionResult> {
  const user = await requireUser()
  const parsed = parseInput(endSessionSchema, input)
  if (!parsed.ok) return invalid(parsed.fieldErrors)
  const data = parsed.data
  const now = new Date()
  const problem = (message: string) =>
    data.mode === 'custom' ? invalid({ endedAt: message }) : failure(message)

  return run('end-session', async () => {
    const supabase = await createClient()
    const session = await loadOwnSession(supabase, user.id, data.id)
    if (!session) return { redirectTo: GONE }
    if (session.ended_at !== null) return { redirectTo: detail(data.id) }

    const startedAt = new Date(session.started_at)
    const catches = await loadCatches(supabase, user.id, data.id)
    let endedAt: Date
    if (data.mode === 'now') endedAt = truncateToMinute(now)
    else if (data.mode === 'last-catch') {
      const last = catches.at(-1)
      if (!last) return failure(MESSAGES.invalidInput)
      endedAt = last.caughtAt
    } else endedAt = data.endedAt!

    // „Jetzt" after more than 48 h (EC-6) fails here too, with the latest allowed end in the message.
    const timeErrors = sessionTimeErrors({ startedAt, endedAt, now }, formatShortDateTime)
    if (timeErrors.endedAt) return problem(timeErrors.endedAt)
    const times = { startedAt, endedAt }
    const outside = firstCatchOutside(catches, times, now)
    if (outside) return problem(catchOutsideMessage(outside, startedAt))

    const { data: rows, error } = await supabase
      .from('sessions')
      .update({ ended_at: endedAt.toISOString() })
      .eq('id', data.id)
      .eq('user_id', user.id)
      .is('ended_at', null)
      .select('id')
    if (error) {
      // A catch saved on another device after this end (the guarantee locks the session row).
      if (mapDbError(error).kind === 'catch-outside') {
        return problem(await catchOutsideFailure(supabase, user.id, data.id, times, now))
      }
      throw error
    }
    // 0 rows: ended (or deleted) meanwhile — the detail view shows the current state.
    if (!rows || rows.length === 0) return { redirectTo: detail(data.id) }
    return { redirectTo: detail(data.id, 'session-ended') }
  })
}

/**
 * „Session löschen" (AC-19, AC-40): final, the catches go with it (database cascade); a running
 * session too. Gone → `/?notice=session-gone`; success → `/?notice=session-deleted`.
 */
export async function deleteSession(input: SessionIdInput): Promise<SessionActionResult> {
  const user = await requireUser()
  const parsed = parseInput(sessionIdSchema, input)
  if (!parsed.ok) return invalid(parsed.fieldErrors)
  const { id } = parsed.data

  return run('delete-session', async () => {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
    if (error) throw error
    if (!rows || rows.length === 0) return { redirectTo: GONE }
    return { redirectTo: '/?notice=session-deleted' }
  })
}

/**
 * „Position entfernen" at a session (AC-38): latitude, longitude and accuracy become empty for good;
 * the catches keep their own copies. Gone → `/?notice=session-gone`; success → `{ status: 'success' }`
 * (the pages are revalidated, the form stays where it is).
 */
export async function removeSessionPosition(input: SessionIdInput): Promise<SessionActionResult> {
  const user = await requireUser()
  const parsed = parseInput(sessionIdSchema, input)
  if (!parsed.ok) return invalid(parsed.fieldErrors)
  const { id } = parsed.data

  return run('remove-session-position', async () => {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from('sessions')
      .update(positionColumns(null))
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
    if (error) throw error
    if (!rows || rows.length === 0) return { redirectTo: GONE }
    revalidatePath('/', 'layout')
    return { status: 'success' }
  })
}
