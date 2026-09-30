// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------------------------------
// Fakes: next/navigation redirect, next/cache, cookies, and a chainable Supabase query builder whose
// answers come from `db.respond` (one call per awaited query, recorded in `db.queries`).

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`)
  }
}

const redirect = vi.fn((url: string) => {
  throw new RedirectSignal(url)
})
const revalidatePath = vi.fn()
const getUser = vi.fn()
const cookieList = vi.fn(() => [] as { name: string }[])

type Filter = [method: string, ...args: unknown[]]
type Query = {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete'
  values?: Record<string, unknown>
  columns?: string
  filters: Filter[]
}
type Reply = { data?: unknown; error?: unknown }

const db = {
  queries: [] as Query[],
  respond: (() => ({ data: null })) as (q: Query) => Reply,
}

function builder(table: string) {
  const q: Query = { table, op: 'select', filters: [] }
  const chain: Record<string, unknown> = {
    select(columns?: string) {
      q.columns = columns
      return chain
    },
    insert(values: Record<string, unknown>) {
      q.op = 'insert'
      q.values = values
      return chain
    },
    update(values: Record<string, unknown>) {
      q.op = 'update'
      q.values = values
      return chain
    },
    delete() {
      q.op = 'delete'
      return chain
    },
    then(resolve: (r: Reply) => unknown, reject: (e: unknown) => unknown) {
      db.queries.push(q)
      try {
        const reply = db.respond(q)
        return Promise.resolve({ data: reply.data ?? null, error: reply.error ?? null }).then(resolve, reject)
      } catch (e) {
        return Promise.reject(e).then(resolve, reject)
      }
    },
  }
  for (const method of ['eq', 'neq', 'is', 'not', 'lt', 'gt', 'or', 'order', 'limit', 'maybeSingle']) {
    chain[method] = (...args: unknown[]) => {
      q.filters.push([method, ...args])
      return chain
    }
  }
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: cookieList }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser }, from: (table: string) => builder(table) }),
}))
vi.spyOn(console, 'error').mockImplementation(() => undefined)

const { startSession, backfillSession, updateSession, endSession, deleteSession, removeSessionPosition } =
  await import('./sessions')

// ---------------------------------------------------------------------------------------------------
// Helpers

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'
// 2026-09-12 18:00:30 Berlin (UTC+2) — the server clock in every test
const NOW = new Date('2026-09-12T16:00:30Z')
const INVALID = 'Bitte prüfe deine Eingaben.'
const NETWORK = 'Keine Verbindung. Bitte versuche es erneut.'

const iso = (s: string) => new Date(s).toISOString()
const hasFilter = (q: Query, ...f: Filter) => q.filters.some((g) => JSON.stringify(g) === JSON.stringify(f))
const ofKind = (op: Query['op'], table = 'sessions') => db.queries.filter((q) => q.op === op && q.table === table)

/** The redirect target of an action call, or fails the test if it returned instead. */
async function redirectOf(promise: Promise<unknown>): Promise<string> {
  try {
    const result = await promise
    throw new Error(`expected a redirect, got ${JSON.stringify(result)}`)
  } catch (e) {
    if (e instanceof RedirectSignal) return e.url
    throw e
  }
}

const pgError = {
  running: { code: '23505', message: 'duplicate key value violates unique constraint "sessions_one_running_per_user"' },
  overlap: { code: '23P01', message: 'conflicting key value violates exclusion constraint "sessions_no_overlap"' },
  catchOutside: { code: 'P0001', message: 'catch_outside_session' },
  duplicate: { code: '23505', message: 'duplicate key value violates unique constraint "sessions_pkey"' },
  other: { code: '08006', message: 'connection failure' },
}

type Row = { id: string; started_at: string; ended_at: string | null }
const running = (started = '2026-09-12T12:05:00Z', id = ID): Row => ({ id, started_at: started, ended_at: null })
const ended = (started: string, end: string, id = ID): Row => ({ id, started_at: started, ended_at: end })
const fish = (at: string, species = 'pike', species_other: string | null = null) => ({
  caught_at: at,
  species,
  species_other,
})

/**
 * A respond function for the common reads: the session by id (`own`), its catches, the overlap
 * query (`overlap`), plus a writer reply per operation.
 */
function scenario(opts: {
  own?: Row | null
  catches?: ReturnType<typeof fish>[]
  overlap?: Row[]
  running?: { id: string } | null
  write?: Reply | ((q: Query) => Reply)
}) {
  db.respond = (q) => {
    if (q.table === 'catches') return { data: opts.catches ?? [] }
    if (q.op !== 'select') return typeof opts.write === 'function' ? opts.write(q) : (opts.write ?? { data: [{ id: ID }] })
    if (q.filters.some(([m]) => m === 'or')) return { data: opts.overlap ?? [] }
    if (hasFilter(q, 'is', 'ended_at', null)) return { data: opts.running ?? null }
    return { data: opts.own ?? null }
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  db.queries = []
  db.respond = () => ({ data: null })
  redirect.mockClear()
  revalidatePath.mockClear()
  getUser.mockReset().mockResolvedValue({ data: { user: { id: USER } }, error: null })
  cookieList.mockReset().mockReturnValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

function unauthenticated(hadSession = true) {
  getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
  cookieList.mockReturnValue(hadSession ? [{ name: 'sb-local-auth-token' }] : [])
}

// ---------------------------------------------------------------------------------------------------

describe('startSession (AC-6, AC-8, AC-9, EC-1, EC-2)', () => {
  const position = { latitude: 54.08512, longitude: 13.38741, accuracy: 12.4 }

  it('creates the session with now (minute) as start, the position, the owner from the login', async () => {
    scenario({ write: { data: null } })
    const url = await redirectOf(startSession({ id: ID, waterName: '  Peenestrom ', note: '', position }))
    expect(url).toBe(`/sessions/${ID}?notice=session-started`)
    const [insert] = ofKind('insert')
    expect(insert.values).toEqual({
      id: ID,
      user_id: USER,
      started_at: '2026-09-12T16:00:00.000Z',
      water_name: 'Peenestrom',
      note: null,
      latitude: 54.08512,
      longitude: 13.38741,
      accuracy_m: 12,
    })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('starts „Ohne Position" when no or a broken position is sent (AC-8)', async () => {
    scenario({ write: { data: null } })
    await redirectOf(startSession({ id: ID, position: { latitude: 'x' } }))
    expect(ofKind('insert')[0].values).toMatchObject({ latitude: null, longitude: null, accuracy_m: null })
  })

  it('ignores an owner sent in the input', async () => {
    scenario({ write: { data: null } })
    await redirectOf(startSession({ id: ID, user_id: OTHER_ID } as never))
    expect(ofKind('insert')[0].values).toMatchObject({ user_id: USER })
  })

  it('rejects a malformed payload with the general message, without touching the database', async () => {
    expect(await startSession(null as never)).toEqual({ status: 'error', message: INVALID })
    expect(await startSession({ id: 'not-a-uuid' })).toEqual({ status: 'error', message: INVALID })
    expect(db.queries).toHaveLength(0)
  })

  it('rejects a field rule with the message at the field', async () => {
    expect(await startSession({ id: ID, waterName: 'x'.repeat(81) })).toEqual({
      status: 'error',
      fieldErrors: { waterName: 'Höchstens 80 Zeichen.' },
    })
  })

  it('sends a caller without a valid login to /login, without touching the database', async () => {
    unauthenticated()
    expect(await redirectOf(startSession({ id: ID }))).toBe('/login?notice=session-ended')
    unauthenticated(false)
    expect(await redirectOf(startSession({ id: ID }))).toBe('/login')
    expect(db.queries).toHaveLength(0)
  })

  it('leads to the running session when one runs already (AC-9, EC-1)', async () => {
    scenario({ write: { error: pgError.running }, running: { id: OTHER_ID } })
    expect(await redirectOf(startSession({ id: ID }))).toBe(`/sessions/${OTHER_ID}?notice=session-running`)
  })

  it('answers a repeat of its own start as success (EC-2)', async () => {
    scenario({ write: { error: pgError.duplicate }, own: running() })
    expect(await redirectOf(startSession({ id: ID }))).toBe(`/sessions/${ID}?notice=session-started`)
    scenario({ write: { error: pgError.running }, running: { id: ID } })
    expect(await redirectOf(startSession({ id: ID }))).toBe(`/sessions/${ID}?notice=session-started`)
  })

  it('rejects an id that belongs to someone else', async () => {
    scenario({ write: { error: pgError.duplicate }, own: null })
    expect(await startSession({ id: ID })).toEqual({ status: 'error', message: INVALID })
    expect(redirect).not.toHaveBeenCalled()
  })

  it('turns any other database failure into „Keine Verbindung"', async () => {
    scenario({ write: { error: pgError.other } })
    expect(await startSession({ id: ID })).toEqual({ status: 'error', message: NETWORK })
  })
})

describe('backfillSession (AC-13, AC-15, AC-16, EC-2)', () => {
  // 12.09. 06:00–09:30 Berlin
  const base = { id: ID, startedAt: '2026-09-12T06:00:00+02:00', endedAt: '2026-09-12T09:30:45+02:00' }

  it('creates an ended session without position, times minute-exact', async () => {
    scenario({ write: { data: null } })
    const position = { latitude: 1, longitude: 2, accuracy: 3 }
    expect(await redirectOf(backfillSession({ ...base, waterName: 'Kummerower See', position }))).toBe(
      `/sessions/${ID}?notice=session-saved`,
    )
    expect(ofKind('insert')[0].values).toEqual({
      id: ID,
      user_id: USER,
      started_at: iso('2026-09-12T04:00:00Z'),
      ended_at: iso('2026-09-12T07:30:00Z'),
      water_name: 'Kummerower See',
      note: null,
      latitude: null,
      longitude: null,
      accuracy_m: null,
    })
  })

  it('keeps the position with „Ich bin noch am Gewässer"', async () => {
    scenario({ write: { data: null } })
    const position = { latitude: 54, longitude: 13, accuracy: 8 }
    await redirectOf(backfillSession({ ...base, useCurrentPosition: true, position }))
    expect(ofKind('insert')[0].values).toMatchObject({ latitude: 54, longitude: 13, accuracy_m: 8 })
  })

  it('checks overlaps against the own sessions except this id, open-ended runs included', async () => {
    scenario({ write: { data: null } })
    await redirectOf(backfillSession(base))
    const [check] = ofKind('select')
    expect(hasFilter(check, 'eq', 'user_id', USER)).toBe(true)
    expect(hasFilter(check, 'neq', 'id', ID)).toBe(true)
    expect(hasFilter(check, 'or', `ended_at.is.null,ended_at.gt."${iso('2026-09-12T04:00:00Z')}"`)).toBe(true)
    expect(hasFilter(check, 'lt', 'started_at', iso('2026-09-12T07:30:00Z'))).toBe(true)
  })

  it('rejects malformed input and broken time rules at their fields', async () => {
    expect(await backfillSession('x' as never)).toEqual({ status: 'error', message: INVALID })
    expect(await backfillSession({ ...base, endedAt: '2026-09-12T05:00:00+02:00' })).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Das Ende muss nach dem Start liegen.' },
    })
    expect(await backfillSession({ ...base, endedAt: '2026-09-14T07:00:00+02:00' })).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Dieser Zeitpunkt liegt in der Zukunft.' },
    })
    expect(
      await backfillSession({ ...base, startedAt: '2026-09-10T06:00:00+02:00', endedAt: '2026-09-12T07:00:00+02:00' }),
    ).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Eine Session dauert höchstens 48 Stunden (bis 12.09., 06:00).' },
    })
    expect(await backfillSession({ ...base, startedAt: '' })).toEqual({
      status: 'error',
      fieldErrors: { startedAt: 'Bitte gib Datum und Uhrzeit ein.' },
    })
    expect(db.queries).toHaveLength(0)
  })

  it('sends a caller without a valid login to /login', async () => {
    unauthenticated()
    expect(await redirectOf(backfillSession(base))).toBe('/login?notice=session-ended')
    expect(db.queries).toHaveLength(0)
  })

  it('names the ended session in the way and saves nothing (AC-16)', async () => {
    scenario({ overlap: [ended('2026-09-12T05:00:00Z', '2026-09-12T08:00:00Z', OTHER_ID)] })
    expect(await backfillSession(base)).toEqual({
      status: 'error',
      message: 'Überschneidet sich mit deiner Session vom 12.09., 07:00–10:00.',
    })
    expect(ofKind('insert')).toHaveLength(0)
  })

  it('names the running session in the way', async () => {
    scenario({ overlap: [running('2026-09-12T07:05:00Z', OTHER_ID)] })
    expect(await backfillSession(base)).toEqual({
      status: 'error',
      message: 'Überschneidet sich mit deiner laufenden Session seit 09:05.',
    })
  })

  it('maps the database overlap guarantee to the same message', async () => {
    let checks = 0
    db.respond = (q) => {
      if (q.op === 'insert') return { error: pgError.overlap }
      // first check (pre-check) finds nothing, the second one after the refusal finds the rival
      return { data: checks++ === 0 ? [] : [ended('2026-09-11T22:00:00Z', '2026-09-12T05:00:00Z', OTHER_ID)] }
    }
    expect(await backfillSession(base)).toEqual({
      status: 'error',
      message: 'Überschneidet sich mit deiner Session vom 12.09., 00:00–07:00.',
    })
  })

  it('answers a repeat of its own save as success, rejects a foreign id (EC-2)', async () => {
    scenario({ write: { error: pgError.duplicate }, own: ended('2026-09-12T04:00:00Z', '2026-09-12T07:30:00Z') })
    expect(await redirectOf(backfillSession(base))).toBe(`/sessions/${ID}?notice=session-saved`)
    scenario({ write: { error: pgError.duplicate }, own: null })
    expect(await backfillSession(base)).toEqual({ status: 'error', message: INVALID })
  })
})

describe('updateSession (AC-15 – AC-18, EC-5, EC-9, EC-13)', () => {
  const endedRow = ended('2026-09-11T14:00:00Z', '2026-09-11T18:00:00Z')
  const editEnded = {
    id: ID,
    waterName: 'Peene',
    note: 'Wind aus West',
    startedAt: '2026-09-11T15:30:00+02:00',
    endedAt: '2026-09-11T21:00:00+02:00',
  }

  it('saves name, note, start and end of an ended session, never the position', async () => {
    scenario({ own: endedRow })
    expect(await redirectOf(updateSession(editEnded))).toBe(`/sessions/${ID}?notice=session-saved`)
    const [update] = ofKind('update')
    expect(update.values).toEqual({
      water_name: 'Peene',
      note: 'Wind aus West',
      started_at: iso('2026-09-11T13:30:00Z'),
      ended_at: iso('2026-09-11T19:00:00Z'),
    })
    expect(hasFilter(update, 'eq', 'user_id', USER)).toBe(true)
    expect(hasFilter(update, 'not', 'ended_at', 'is', null)).toBe(true)
  })

  it('clears an emptied water name and note', async () => {
    scenario({ own: endedRow })
    await redirectOf(updateSession({ ...editEnded, waterName: '  ', note: undefined }))
    expect(ofKind('update')[0].values).toMatchObject({ water_name: null, note: null })
  })

  it('never ends or reopens a running session: the end is ignored, the update stays on running', async () => {
    scenario({ own: running('2026-09-12T12:05:00Z') })
    const url = await redirectOf(
      updateSession({ id: ID, startedAt: '2026-09-12T13:00:00+02:00', endedAt: '2026-09-12T17:00:00+02:00' }),
    )
    expect(url).toBe(`/sessions/${ID}?notice=session-saved`)
    const [update] = ofKind('update')
    expect(update.values).not.toHaveProperty('ended_at')
    expect(hasFilter(update, 'is', 'ended_at', null)).toBe(true)
  })

  it('rejects malformed input and broken time rules', async () => {
    expect(await updateSession({ ...editEnded, id: 'nope' })).toEqual({ status: 'error', message: INVALID })
    expect(db.queries).toHaveLength(0)
    scenario({ own: endedRow })
    expect(await updateSession({ ...editEnded, endedAt: '2026-09-11T15:30:30+02:00' })).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Das Ende muss nach dem Start liegen.' },
    })
    expect(await updateSession({ ...editEnded, endedAt: undefined })).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Bitte gib Datum und Uhrzeit ein.' },
    })
    scenario({ own: running() })
    expect(await updateSession({ id: ID, startedAt: '2026-09-12T18:10:00+02:00' })).toEqual({
      status: 'error',
      fieldErrors: { startedAt: 'Dieser Zeitpunkt liegt in der Zukunft.' },
    })
    expect(ofKind('update')).toHaveLength(0)
  })

  it('refuses a start after the first catch of a running session, naming the catch (AC-18, EC-9)', async () => {
    scenario({ own: running('2026-09-12T12:05:00Z'), catches: [fish('2026-09-12T13:20:00Z'), fish('2026-09-12T15:00:00Z', 'other', 'Quappe')] })
    expect(await updateSession({ id: ID, startedAt: '2026-09-12T15:30:00+02:00' })).toEqual({
      status: 'error',
      message: 'Der Fang um 15:20 (Hecht) läge außerhalb der Session.',
    })
    expect(ofKind('update')).toHaveLength(0)
  })

  it('refuses an overlap with another own session (AC-16, EC-9)', async () => {
    scenario({ own: endedRow, overlap: [ended('2026-09-11T19:00:00Z', '2026-09-11T20:00:00Z', OTHER_ID)] })
    expect(await updateSession(editEnded)).toEqual({
      status: 'error',
      message: 'Überschneidet sich mit deiner Session vom 11.09., 21:00–22:00.',
    })
    expect(ofKind('update')).toHaveLength(0)
  })

  it('maps the database guarantees to the same messages', async () => {
    let catchReads = 0
    db.respond = (q) => {
      if (q.table === 'catches') return { data: catchReads++ === 0 ? [] : [fish('2026-09-11T13:00:00Z', 'zander')] }
      if (q.op === 'update') return { error: pgError.catchOutside }
      if (q.filters.some(([m]) => m === 'or')) return { data: [] }
      return { data: endedRow }
    }
    expect(await updateSession(editEnded)).toEqual({
      status: 'error',
      message: 'Der Fang um 15:00 (Zander) läge außerhalb der Session.',
    })

    let overlapReads = 0
    db.respond = (q) => {
      if (q.table === 'catches') return { data: [] }
      if (q.op === 'update') return { error: pgError.overlap }
      if (q.filters.some(([m]) => m === 'or')) {
        return { data: overlapReads++ === 0 ? [] : [running('2026-09-12T07:00:00Z', OTHER_ID)] }
      }
      return { data: endedRow }
    }
    expect(await updateSession(editEnded)).toEqual({
      status: 'error',
      message: 'Überschneidet sich mit deiner laufenden Session seit 09:00.',
    })
  })

  it('sends a missing or foreign session to the overview with session-gone (EC-5)', async () => {
    scenario({ own: null })
    expect(await redirectOf(updateSession(editEnded))).toBe('/?notice=session-gone')
    expect(ofKind('update')).toHaveLength(0)
  })

  it('saves nothing when the state changed meanwhile (0 rows): gone → overview, else the detail', async () => {
    let reads = 0
    db.respond = (q) => {
      if (q.table === 'catches' || q.filters.some(([m]) => m === 'or')) return { data: [] }
      if (q.op === 'update') return { data: [] }
      return { data: reads++ === 0 ? endedRow : null }
    }
    expect(await redirectOf(updateSession(editEnded))).toBe('/?notice=session-gone')
    scenario({ own: endedRow, write: { data: [] } })
    expect(await redirectOf(updateSession(editEnded))).toBe(`/sessions/${ID}`)
  })

  it('sends a caller without a valid login to /login', async () => {
    unauthenticated()
    expect(await redirectOf(updateSession(editEnded))).toBe('/login?notice=session-ended')
    expect(db.queries).toHaveLength(0)
  })
})

describe('endSession (AC-10, AC-12, EC-5, EC-6, EC-13)', () => {
  const runningRow = running('2026-09-12T12:05:00Z') // since 14:05 Berlin

  it('ends „Jetzt" at the current minute, only while the end is still empty', async () => {
    scenario({ own: runningRow })
    expect(await redirectOf(endSession({ id: ID, mode: 'now' }))).toBe(`/sessions/${ID}?notice=session-ended`)
    const [update] = ofKind('update')
    expect(update.values).toEqual({ ended_at: '2026-09-12T16:00:00.000Z' })
    expect(hasFilter(update, 'is', 'ended_at', null)).toBe(true)
    expect(hasFilter(update, 'eq', 'user_id', USER)).toBe(true)
  })

  it('ends at the last catch', async () => {
    scenario({ own: runningRow, catches: [fish('2026-09-12T13:00:00Z'), fish('2026-09-12T15:10:00Z')] })
    await redirectOf(endSession({ id: ID, mode: 'last-catch' }))
    expect(ofKind('update')[0].values).toEqual({ ended_at: iso('2026-09-12T15:10:00Z') })
  })

  it('ends at a time of one\'s own, ignoring a time sent with another mode', async () => {
    scenario({ own: runningRow })
    await redirectOf(endSession({ id: ID, mode: 'custom', endedAt: '2026-09-12T17:30:00+02:00' }))
    expect(ofKind('update')[0].values).toEqual({ ended_at: iso('2026-09-12T15:30:00Z') })
    db.queries = []
    await redirectOf(endSession({ id: ID, mode: 'now', endedAt: '2026-09-12T17:30:00+02:00' }))
    expect(ofKind('update')[0].values).toEqual({ ended_at: '2026-09-12T16:00:00.000Z' })
  })

  it('rejects malformed input and custom times that break the rules, at the field (AC-12)', async () => {
    expect(await endSession({ id: ID, mode: 'later' } as never)).toEqual({ status: 'error', message: INVALID })
    expect(await endSession({ id: ID, mode: 'custom' })).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Bitte gib Datum und Uhrzeit ein.' },
    })
    scenario({ own: runningRow, catches: [fish('2026-09-12T15:20:00Z')] })
    const custom = (endedAt: string) => endSession({ id: ID, mode: 'custom', endedAt })
    expect(await custom('2026-09-12T14:00:00+02:00')).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Das Ende muss nach dem Start liegen. Möglich ist ein Ende zwischen 12.09., 17:20 und 12.09., 18:00.' },
    })
    expect(await custom('2026-09-12T18:10:00+02:00')).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Dieser Zeitpunkt liegt in der Zukunft. Möglich ist ein Ende zwischen 12.09., 17:20 und 12.09., 18:00.' },
    })
    expect(await custom('2026-09-12T17:00:00+02:00')).toEqual({
      status: 'error',
      fieldErrors: { endedAt: 'Der Fang um 17:20 (Hecht) läge außerhalb der Session. Möglich ist ein Ende zwischen 12.09., 17:20 und 12.09., 18:00.' },
    })
    expect(ofKind('update')).toHaveLength(0)
  })

  it('refuses „Jetzt" after more than 48 hours, naming the latest allowed end (EC-6)', async () => {
    scenario({ own: running('2026-09-10T12:05:00Z') })
    expect(await endSession({ id: ID, mode: 'now' })).toEqual({
      status: 'error',
      message:
        'Eine Session dauert höchstens 48 Stunden (bis 12.09., 14:05). Möglich ist ein Ende zwischen 10.09., 14:06 und 12.09., 14:05.',
    })
    expect(ofKind('update')).toHaveLength(0)
  })

  it('refuses „letzter Fang" without catches', async () => {
    scenario({ own: runningRow, catches: [] })
    expect(await endSession({ id: ID, mode: 'last-catch' })).toEqual({ status: 'error', message: INVALID })
  })

  it('leads an already ended session to its detail without error, writing nothing (EC-13)', async () => {
    scenario({ own: ended('2026-09-12T12:05:00Z', '2026-09-12T14:00:00Z') })
    expect(await redirectOf(endSession({ id: ID, mode: 'now' }))).toBe(`/sessions/${ID}`)
    expect(ofKind('update')).toHaveLength(0)
  })

  it('leads to the detail when another device ended it in between (conditional update, 0 rows)', async () => {
    scenario({ own: runningRow, write: { data: [] } })
    expect(await redirectOf(endSession({ id: ID, mode: 'now' }))).toBe(`/sessions/${ID}`)
  })

  it('maps a catch saved meanwhile after the end (database guarantee)', async () => {
    let catchReads = 0
    db.respond = (q) => {
      if (q.table === 'catches') return { data: catchReads++ === 0 ? [] : [fish('2026-09-12T16:00:00Z', 'perch')] }
      if (q.op === 'update') return { error: pgError.catchOutside }
      return { data: runningRow }
    }
    expect(await endSession({ id: ID, mode: 'custom', endedAt: '2026-09-12T17:30:00+02:00' })).toEqual({
      status: 'error',
      fieldErrors: {
        endedAt: 'Der Fang um 18:00 (Barsch) läge außerhalb der Session. Möglich ist ein Ende zwischen 12.09., 14:06 und 12.09., 18:00.',
      },
    })
  })

  it('sends a missing or foreign session to the overview with session-gone (EC-5)', async () => {
    scenario({ own: null })
    expect(await redirectOf(endSession({ id: ID, mode: 'now' }))).toBe('/?notice=session-gone')
  })

  it('sends a caller without a valid login to /login', async () => {
    unauthenticated(false)
    expect(await redirectOf(endSession({ id: ID, mode: 'now' }))).toBe('/login')
    expect(db.queries).toHaveLength(0)
  })
})

describe('deleteSession (AC-19, AC-40)', () => {
  it('deletes the own session for good and goes to the overview', async () => {
    scenario({ write: { data: [{ id: ID }] } })
    expect(await redirectOf(deleteSession({ id: ID }))).toBe('/?notice=session-deleted')
    const [del] = ofKind('delete')
    expect(hasFilter(del, 'eq', 'id', ID)).toBe(true)
    expect(hasFilter(del, 'eq', 'user_id', USER)).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('sends a missing or foreign session to the overview with session-gone', async () => {
    scenario({ write: { data: [] } })
    expect(await redirectOf(deleteSession({ id: ID }))).toBe('/?notice=session-gone')
  })

  it('rejects a malformed id and an unauthenticated caller without touching the database', async () => {
    expect(await deleteSession({ id: '1' })).toEqual({ status: 'error', message: INVALID })
    unauthenticated()
    expect(await redirectOf(deleteSession({ id: ID }))).toBe('/login?notice=session-ended')
    expect(db.queries).toHaveLength(0)
  })

  it('reports a database failure as „Keine Verbindung"', async () => {
    scenario({ write: { error: pgError.other } })
    expect(await deleteSession({ id: ID })).toEqual({ status: 'error', message: NETWORK })
  })
})

describe('removeSessionPosition (AC-38)', () => {
  it('empties all three position fields of the own session and stays on the page', async () => {
    scenario({ write: { data: [{ id: ID }] } })
    expect(await removeSessionPosition({ id: ID })).toEqual({ status: 'success' })
    const [update] = ofKind('update')
    expect(update.values).toEqual({ latitude: null, longitude: null, accuracy_m: null })
    expect(hasFilter(update, 'eq', 'user_id', USER)).toBe(true)
    expect(ofKind('update', 'catches')).toHaveLength(0) // catches keep their own copies
    expect(revalidatePath).toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('sends a missing or foreign session to the overview with session-gone', async () => {
    scenario({ write: { data: [] } })
    expect(await redirectOf(removeSessionPosition({ id: ID }))).toBe('/?notice=session-gone')
  })

  it('rejects a malformed id and an unauthenticated caller', async () => {
    expect(await removeSessionPosition({} as never)).toEqual({ status: 'error', message: INVALID })
    unauthenticated()
    expect(await redirectOf(removeSessionPosition({ id: ID }))).toBe('/login?notice=session-ended')
    expect(db.queries).toHaveLength(0)
  })
})
