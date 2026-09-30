// @vitest-environment node
// Catch actions (PROJ-2 T9) against a small in-memory stand-in for Supabase: owner-only visibility (RLS),
// the primary key, catches_session_owner_fkey and the catch-time trigger behave like the migration.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateCatchActionInput, EditCatchActionInput } from './catches'

// ---------------------------------------------------------------------------------------------------
// Fake database

type Row = Record<string, unknown>
type DbError = { code: string; message: string; details?: string | null }

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const S_RUN = '11111111-1111-4111-8111-111111111111' // A, running since 14:05, with position
const S_END = '22222222-2222-4222-8222-222222222222' // A, 11.09. 16:00–20:00, with position
const S_END_NOPOS = '33333333-3333-4333-8333-333333333333' // A, 10.09. 10:00–12:00, no position
const S_NIGHT = '44444444-4444-4444-8444-444444444444' // A, 08.09. 20:00 – 09.09. 04:00
const S_FOREIGN = '55555555-5555-4555-8555-555555555555' // B, running
const S_MISSING = '66666666-6666-4666-8666-666666666666'
const C_OWN = '77777777-7777-4777-8777-777777777777' // A, in S_END at 19:00, gps position
const C_FOREIGN = '88888888-8888-4888-8888-888888888888' // B, in S_FOREIGN
const C_NEW = '99999999-9999-4999-8999-999999999999'

const NOW = new Date('2026-09-12T16:40:30Z') // 18:40:30 in Berlin

const db: { sessions: Row[]; catches: Row[] } = { sessions: [], catches: [] }
let authUserId: string | null = USER_A
let authCookies: { name: string }[] = []
let failures: { table: string; op: string; error: DbError }[] = []
/** Runs right before a write to `catches` — another device acting between the action's read and write. */
let beforeCatchWrite: (() => void) | null = null

function session(row: Row): Row {
  return { latitude: null, longitude: null, accuracy_m: null, ended_at: null, user_id: USER_A, ...row }
}

function seed() {
  db.sessions = [
    session({ id: S_RUN, started_at: '2026-09-12T12:05:00Z', latitude: 54.1, longitude: 13.4, accuracy_m: 25 }),
    session({ id: S_END, started_at: '2026-09-11T14:00:00Z', ended_at: '2026-09-11T18:00:00Z', latitude: 53.5, longitude: 10, accuracy_m: 30 }),
    session({ id: S_END_NOPOS, started_at: '2026-09-10T08:00:00Z', ended_at: '2026-09-10T10:00:00Z' }),
    session({ id: S_NIGHT, started_at: '2026-09-08T18:00:00Z', ended_at: '2026-09-09T02:00:00Z' }),
    session({ id: S_FOREIGN, user_id: USER_B, started_at: '2026-09-12T10:00:00Z', latitude: 50, longitude: 8, accuracy_m: 5 }),
  ]
  db.catches = [
    {
      id: C_OWN, session_id: S_END, user_id: USER_A, caught_at: '2026-09-11T17:00:00.000Z', species: 'pike',
      species_other: null, length_cm: 70, weight_g: 2400, bait: 'Blinker', released: false,
      latitude: 53.51, longitude: 10.01, accuracy_m: 8, position_source: 'gps',
    },
    {
      id: C_FOREIGN, session_id: S_FOREIGN, user_id: USER_B, caught_at: '2026-09-12T11:00:00.000Z', species: 'perch',
      species_other: null, length_cm: 25, weight_g: null, bait: null, released: true,
      latitude: 50, longitude: 8, accuracy_m: 5, position_source: 'session',
    },
  ]
}

const byId = (table: 'sessions' | 'catches', id: string) => db[table].find((r) => r.id === id)

function catchOutside(row: Row): DbError | null {
  const s = db.sessions.find((x) => x.id === row.session_id && x.user_id === row.user_id)
  if (!s) return null
  const t = Date.parse(row.caught_at as string)
  const upper = s.ended_at ? Date.parse(s.ended_at as string) : Date.now() + 2 * 60_000
  return t < Date.parse(s.started_at as string) || t > upper ? { code: 'P0001', message: 'catch_outside_session' } : null
}

class Query implements PromiseLike<{ data: unknown; error: DbError | null }> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private values: Row = {}
  private filters: [string, unknown][] = []
  private columns: string[] | null = null
  private single = false

  constructor(private table: 'sessions' | 'catches') {}

  select(columns = '*') {
    this.columns = columns === '*' ? null : columns.split(',').map((c) => c.trim())
    return this
  }
  insert(values: Row) {
    this.op = 'insert'
    this.values = values
    return this
  }
  update(values: Row) {
    this.op = 'update'
    this.values = values
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value])
    return this
  }
  maybeSingle() {
    this.single = true
    return this
  }

  then<A = { data: unknown; error: DbError | null }, B = never>(
    onFulfilled?: ((value: { data: unknown; error: DbError | null }) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onFulfilled, onRejected)
  }

  private pick(row: Row): Row {
    return this.columns ? Object.fromEntries(this.columns.map((c) => [c, row[c]])) : { ...row }
  }

  private matching(): Row[] {
    return db[this.table].filter(
      (row) => row.user_id === authUserId && this.filters.every(([c, v]) => row[c] === v),
    )
  }

  private run(): { data: unknown; error: DbError | null } {
    const failure = failures.findIndex((f) => f.table === this.table && f.op === this.op)
    if (failure >= 0) return { data: null, error: failures.splice(failure, 1)[0].error }
    if (this.table === 'catches' && this.op !== 'select' && beforeCatchWrite) {
      const hook = beforeCatchWrite
      beforeCatchWrite = null
      hook()
    }

    if (this.op === 'select') {
      const rows = this.matching().map((r) => this.pick(r))
      return { data: this.single ? (rows[0] ?? null) : rows, error: null }
    }
    if (this.op === 'insert') {
      const row = { ...this.values }
      if (row.user_id !== authUserId) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
      if (db[this.table].some((r) => r.id === row.id)) {
        return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint "${this.table}_pkey"` } }
      }
      if (!db.sessions.some((s) => s.id === row.session_id && s.user_id === row.user_id)) {
        return { data: null, error: { code: '23503', message: 'insert or update on table "catches" violates foreign key constraint "catches_session_owner_fkey"' } }
      }
      const outside = catchOutside(row)
      if (outside) return { data: null, error: outside }
      db[this.table].push(row)
      return { data: null, error: null }
    }
    const rows = this.matching()
    if (this.op === 'update') {
      for (const row of rows) {
        const outside = 'caught_at' in this.values ? catchOutside({ ...row, ...this.values }) : null
        if (outside) return { data: null, error: outside }
      }
      rows.forEach((row) => Object.assign(row, this.values))
    } else {
      db[this.table] = db[this.table].filter((r) => !rows.includes(r))
    }
    return { data: this.columns || this.op === 'delete' ? rows.map((r) => this.pick(r)) : null, error: null }
  }
}

// ---------------------------------------------------------------------------------------------------
// Mocks

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`)
  }
}

const revalidatePath = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () =>
        authUserId
          ? { data: { user: { id: authUserId } }, error: null }
          : { data: { user: null }, error: { message: 'Auth session missing!' } },
    },
    from: (table: 'sessions' | 'catches') => new Query(table),
  }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => authCookies }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url)
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }))
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

const { createCatch, updateCatch, deleteCatch, removeCatchPosition } = await import('./catches')

type Outcome = { redirect: string } | { result: unknown }

async function run(call: () => Promise<unknown>): Promise<Outcome> {
  try {
    return { result: await call() }
  } catch (e) {
    if (e instanceof Redirect) return { redirect: e.url }
    throw e
  }
}

/** Test payloads are deliberately loose (wrong types included), like a request from a manipulated client. */
function newCatch(over: Record<string, unknown> = {}): CreateCatchActionInput {
  return {
    id: C_NEW,
    sessionId: S_RUN,
    caughtAt: '2026-09-12T18:20:45+02:00',
    species: 'pike',
    speciesOther: '',
    lengthCm: '68',
    weightG: '',
    bait: ' Gummifisch ',
    released: true,
    position: { latitude: 54.08512, longitude: 13.38741, accuracy: 11.6 },
    ...over,
  } as unknown as CreateCatchActionInput
}

function editOwn(over: Record<string, unknown> = {}): EditCatchActionInput {
  return {
    id: C_OWN,
    sessionId: S_END,
    caughtAt: '2026-09-11T19:30:00+02:00',
    species: 'zander',
    speciesOther: '',
    lengthCm: 55,
    weightG: 1800,
    bait: '',
    released: true,
    ...over,
  } as unknown as EditCatchActionInput
}

const INVALID = { status: 'error', message: 'Bitte prüfe deine Eingaben.' }
const saved = (sessionId: string) => ({ redirect: `/sessions/${sessionId}?notice=catch-saved` })
const GONE = { redirect: '/?notice=session-gone' }
const fieldError = (field: string, message: string) => ({ result: { status: 'error', fieldErrors: { [field]: message } } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  seed()
  authUserId = USER_A
  authCookies = []
  failures = []
  beforeCatchWrite = null
  revalidatePath.mockReset()
  consoleError.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------------------------------
// createCatch

describe('createCatch — saving (AC-20, AC-25, AC-26)', () => {
  it('saves a catch in a running session with the GPS fix, minute-exact, and opens the detail view', async () => {
    expect(await run(() => createCatch(newCatch()))).toEqual(saved(S_RUN))
    expect(byId('catches', C_NEW)).toMatchObject({
      session_id: S_RUN,
      user_id: USER_A,
      caught_at: '2026-09-12T16:20:00.000Z',
      species: 'pike',
      species_other: null,
      length_cm: 68,
      weight_g: null,
      bait: 'Gummifisch',
      released: true,
      latitude: 54.08512,
      longitude: 13.38741,
      accuracy_m: 12,
      position_source: 'gps',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('copies the session position when the browser sent none (AC-25)', async () => {
    expect(await run(() => createCatch(newCatch({ position: null })))).toEqual(saved(S_RUN))
    expect(byId('catches', C_NEW)).toMatchObject({ latitude: 54.1, longitude: 13.4, accuracy_m: 25, position_source: 'session' })
  })

  it('treats a partial or implausible fix as none and falls back to the session', async () => {
    await run(() => createCatch(newCatch({ position: { latitude: 91, longitude: 13, accuracy: 5 } })))
    expect(byId('catches', C_NEW)).toMatchObject({ position_source: 'session', latitude: 54.1 })
  })

  it('saves „Ohne Position" when neither the browser nor the session has one (AC-25)', async () => {
    Object.assign(byId('sessions', S_RUN)!, { latitude: null, longitude: null, accuracy_m: null })
    expect(await run(() => createCatch(newCatch({ position: undefined })))).toEqual(saved(S_RUN))
    expect(byId('catches', C_NEW)).toMatchObject({ latitude: null, longitude: null, accuracy_m: null, position_source: 'none' })
  })

  it('ignores a client position in an ended session and copies the session one (AC-26)', async () => {
    const input = newCatch({ sessionId: S_END, caughtAt: '2026-09-11T18:00:00+02:00' })
    expect(await run(() => createCatch(input))).toEqual(saved(S_END))
    expect(byId('catches', C_NEW)).toMatchObject({ latitude: 53.5, longitude: 10, accuracy_m: 30, position_source: 'session' })
  })

  it('saves an ended session without position as „Ohne Position", whatever the browser sent (AC-26)', async () => {
    const input = newCatch({ sessionId: S_END_NOPOS, caughtAt: '2026-09-10T11:00:00+02:00' })
    expect(await run(() => createCatch(input))).toEqual(saved(S_END_NOPOS))
    expect(byId('catches', C_NEW)).toMatchObject({ latitude: null, position_source: 'none' })
  })

  it('keeps the free species name for „Sonstige" and a weight', async () => {
    await run(() => createCatch(newCatch({ species: 'other', speciesOther: ' Quappe ', weightG: '1250' })))
    expect(byId('catches', C_NEW)).toMatchObject({ species: 'other', species_other: 'Quappe', weight_g: 1250 })
  })
})

describe('createCatch — rejected input (AC-22)', () => {
  it('answers a broken request with the general message and saves nothing', async () => {
    for (const input of [null, 'x', 42, [], newCatch({ id: 'not-a-uuid' }), newCatch({ caughtAt: '2026-09-12T18:20' })]) {
      expect(await run(() => createCatch(input as never))).toEqual({ result: INVALID })
    }
    // An empty object: the general message, plus the field messages the form can show
    expect(await run(() => createCatch({} as never))).toMatchObject({ result: INVALID })
    expect(db.catches).toHaveLength(2)
  })

  it('names the field for an invalid length, weight, species or release choice', async () => {
    const lengthMsg = 'Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).'
    expect(await run(() => createCatch(newCatch({ lengthCm: 0 })))).toEqual(fieldError('lengthCm', lengthMsg))
    expect(await run(() => createCatch(newCatch({ lengthCm: '251' })))).toEqual(fieldError('lengthCm', lengthMsg))
    expect(await run(() => createCatch(newCatch({ lengthCm: '12.5' })))).toEqual(fieldError('lengthCm', lengthMsg))
    expect(await run(() => createCatch(newCatch({ weightG: 150_001 })))).toEqual(
      fieldError('weightG', 'Bitte gib das Gewicht in ganzen Gramm ein (1 bis 150.000).'),
    )
    expect(await run(() => createCatch(newCatch({ species: 'shark' })))).toEqual(fieldError('species', 'Bitte wähle eine Fischart.'))
    expect(await run(() => createCatch(newCatch({ species: 'other', speciesOther: '  ' })))).toEqual(
      fieldError('speciesOther', 'Bitte gib die Fischart ein.'),
    )
    expect(await run(() => createCatch(newCatch({ released: undefined })))).toEqual(
      fieldError('released', 'Bitte wähle „Zurückgesetzt“ oder „Entnommen“.'),
    )
    expect(await run(() => createCatch(newCatch({ bait: 'x'.repeat(61) })))).toEqual(fieldError('bait', 'Höchstens 60 Zeichen.'))
    expect(db.catches).toHaveLength(2)
  })

  it('shows all field messages at once', async () => {
    const out = await run(() => createCatch(newCatch({ lengthCm: '', weightG: 'viel', species: undefined })))
    expect(out).toEqual({
      result: {
        status: 'error',
        fieldErrors: {
          lengthCm: 'Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).',
          weightG: 'Bitte gib das Gewicht in ganzen Gramm ein (1 bis 150.000).',
          species: 'Bitte wähle eine Fischart.',
        },
      },
    })
  })
})

describe('createCatch — login and ownership (AC-32, EC-5)', () => {
  it('sends a caller without login to /login and saves nothing', async () => {
    authUserId = null
    expect(await run(() => createCatch(newCatch()))).toEqual({ redirect: '/login' })
    authCookies = [{ name: 'sb-127-auth-token' }]
    expect(await run(() => createCatch(newCatch()))).toEqual({ redirect: '/login?notice=session-ended' })
    expect(db.catches).toHaveLength(2)
  })

  it('treats a missing or foreign session as gone and saves nothing', async () => {
    expect(await run(() => createCatch(newCatch({ sessionId: S_MISSING })))).toEqual(GONE)
    expect(await run(() => createCatch(newCatch({ sessionId: S_FOREIGN, caughtAt: '2026-09-12T13:00:00+02:00' })))).toEqual(GONE)
    expect(db.catches).toHaveLength(2)
  })

  it('never takes the owner from the input', async () => {
    await run(() => createCatch({ ...newCatch(), user_id: USER_B, userId: USER_B } as never))
    expect(byId('catches', C_NEW)?.user_id).toBe(USER_A)
  })
})

describe('createCatch — catch time (AC-24, EC-4)', () => {
  it('accepts the start and „now + 2 minutes" of a running session, both included', async () => {
    expect(await run(() => createCatch(newCatch({ caughtAt: '2026-09-12T14:05:00+02:00' })))).toEqual(saved(S_RUN))
    db.catches.pop()
    expect(await run(() => createCatch(newCatch({ caughtAt: '2026-09-12T18:42:00+02:00' })))).toEqual(saved(S_RUN))
  })

  it('names the allowed window for a time before the start or in the future', async () => {
    const msg = 'Die Fangzeit muss zwischen 14:05 und 18:40 liegen.'
    expect(await run(() => createCatch(newCatch({ caughtAt: '2026-09-12T14:04:00+02:00' })))).toEqual(fieldError('caughtAt', msg))
    expect(await run(() => createCatch(newCatch({ caughtAt: '2026-09-12T18:43:00+02:00' })))).toEqual(fieldError('caughtAt', msg))
    expect(db.catches).toHaveLength(2)
  })

  it('names the window of an ended session, with dates when it spans midnight', async () => {
    expect(await run(() => createCatch(newCatch({ sessionId: S_END, caughtAt: '2026-09-11T20:01:00+02:00' })))).toEqual(
      fieldError('caughtAt', 'Die Fangzeit muss zwischen 16:00 und 20:00 liegen.'),
    )
    expect(await run(() => createCatch(newCatch({ sessionId: S_NIGHT, caughtAt: '2026-09-09T05:00:00+02:00' })))).toEqual(
      fieldError('caughtAt', 'Die Fangzeit muss zwischen 08.09., 20:00 und 09.09., 04:00 liegen.'),
    )
  })

  it('says the session was ended meanwhile when the form was opened for a running one (EC-4)', async () => {
    Object.assign(byId('sessions', S_RUN)!, { ended_at: '2026-09-12T16:30:00Z' }) // ended at 18:30 on another device
    const late = newCatch({ caughtAt: '2026-09-12T18:38:00+02:00', sessionWasRunning: true })
    expect(await run(() => createCatch(late))).toEqual(fieldError('caughtAt', 'Die Session wurde inzwischen beendet (Ende 18:30).'))
    expect(db.catches).toHaveLength(2)

    const inside = newCatch({ caughtAt: '2026-09-12T18:25:00+02:00', sessionWasRunning: true })
    expect(await run(() => createCatch(inside))).toEqual(saved(S_RUN))
    // design.md EC-4: „Die Position bleibt die ermittelte" — the browser fix, not a copy of the session's
    expect(byId('catches', C_NEW)).toMatchObject({ position_source: 'gps' })
  })

  it('reports the end that another device set between check and save (EC-4, database guarantee)', async () => {
    beforeCatchWrite = () => Object.assign(byId('sessions', S_RUN)!, { ended_at: '2026-09-12T16:30:00Z' })
    const out = await run(() => createCatch(newCatch({ caughtAt: '2026-09-12T18:38:00+02:00' })))
    expect(out).toEqual(fieldError('caughtAt', 'Die Session wurde inzwischen beendet (Ende 18:30).'))
    expect(byId('catches', C_NEW)).toBeUndefined()
  })
})

describe('createCatch — double save and database refusals (EC-2, EC-5)', () => {
  it('creates one catch for a repeated save with the same id and answers both as saved', async () => {
    expect(await run(() => createCatch(newCatch()))).toEqual(saved(S_RUN))
    expect(await run(() => createCatch(newCatch()))).toEqual(saved(S_RUN))
    expect(db.catches.filter((c) => c.id === C_NEW)).toHaveLength(1)
  })

  it('rejects an id that belongs to someone else and leaves their catch alone', async () => {
    expect(await run(() => createCatch(newCatch({ id: C_FOREIGN })))).toEqual({ result: INVALID })
    expect(byId('catches', C_FOREIGN)).toMatchObject({ user_id: USER_B, session_id: S_FOREIGN, length_cm: 25 })
  })

  it('sends to the overview when the session was deleted between check and save', async () => {
    beforeCatchWrite = () => {
      db.sessions = db.sessions.filter((s) => s.id !== S_RUN)
    }
    expect(await run(() => createCatch(newCatch()))).toEqual(GONE)
    expect(byId('catches', C_NEW)).toBeUndefined()
  })

  it('turns an unknown database failure into „Keine Verbindung" and logs no input', async () => {
    failures.push({ table: 'catches', op: 'insert', error: { code: '08006', message: 'connection failure' } })
    expect(await run(() => createCatch(newCatch()))).toEqual({
      result: { status: 'error', message: 'Keine Verbindung. Bitte versuche es erneut.' },
    })
    expect(consoleError).toHaveBeenCalled()
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('54.08512')
    failures.push({ table: 'sessions', op: 'select', error: { code: '08006', message: 'connection failure' } })
    expect(await run(() => createCatch(newCatch()))).toEqual({
      result: { status: 'error', message: 'Keine Verbindung. Bitte versuche es erneut.' },
    })
  })
})

// ---------------------------------------------------------------------------------------------------
// updateCatch

describe('updateCatch (AC-27, EC-10)', () => {
  it('saves the changed fields, keeps position and session, and opens the detail view', async () => {
    expect(await run(() => updateCatch(editOwn()))).toEqual(saved(S_END))
    expect(byId('catches', C_OWN)).toMatchObject({
      session_id: S_END,
      caught_at: '2026-09-11T17:30:00.000Z',
      species: 'zander',
      length_cm: 55,
      weight_g: 1800,
      bait: null,
      released: true,
      latitude: 53.51,
      longitude: 10.01,
      accuracy_m: 8,
      position_source: 'gps',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('never moves a catch to another session or changes its position through an edit', async () => {
    const input = { ...editOwn({ sessionId: S_RUN }), position: { latitude: 1, longitude: 1, accuracy: 1 } }
    expect(await run(() => updateCatch(input as never))).toEqual(saved(S_END))
    expect(byId('catches', C_OWN)).toMatchObject({ session_id: S_END, latitude: 53.51, position_source: 'gps' })
  })

  it('applies the same input rules', async () => {
    expect(await run(() => updateCatch(null as never))).toEqual({ result: INVALID })
    expect(await run(() => updateCatch(editOwn({ lengthCm: 251 })))).toEqual(
      fieldError('lengthCm', 'Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).'),
    )
    expect(await run(() => updateCatch(editOwn({ species: 'other', speciesOther: '' })))).toEqual(
      fieldError('speciesOther', 'Bitte gib die Fischart ein.'),
    )
    expect(byId('catches', C_OWN)).toMatchObject({ species: 'pike', length_cm: 70 })
  })

  it('checks the time against the session as it is now (EC-10)', async () => {
    Object.assign(byId('sessions', S_END)!, { started_at: '2026-09-11T17:20:00Z' }) // start moved to 19:20 elsewhere
    expect(await run(() => updateCatch(editOwn({ caughtAt: '2026-09-11T19:10:00+02:00' })))).toEqual(
      fieldError('caughtAt', 'Die Fangzeit muss zwischen 19:20 und 20:00 liegen.'),
    )
    expect(byId('catches', C_OWN)).toMatchObject({ caught_at: '2026-09-11T17:00:00.000Z', species: 'pike' })
  })

  it('shows the current window when the database refuses after a change on another device', async () => {
    beforeCatchWrite = () => Object.assign(byId('sessions', S_END)!, { ended_at: '2026-09-11T17:30:00Z' })
    expect(await run(() => updateCatch(editOwn({ caughtAt: '2026-09-11T19:50:00+02:00' })))).toEqual(
      fieldError('caughtAt', 'Die Fangzeit muss zwischen 16:00 und 19:30 liegen.'),
    )
    expect(byId('catches', C_OWN)?.caught_at).toBe('2026-09-11T17:00:00.000Z')
  })

  it('sends a caller without login to /login', async () => {
    authUserId = null
    expect(await run(() => updateCatch(editOwn()))).toEqual({ redirect: '/login' })
    expect(byId('catches', C_OWN)?.species).toBe('pike')
  })

  it('treats a missing, foreign or meanwhile deleted catch as gone and changes nothing', async () => {
    expect(await run(() => updateCatch(editOwn({ id: C_NEW })))).toEqual(GONE)
    expect(await run(() => updateCatch(editOwn({ id: C_FOREIGN, sessionId: S_FOREIGN, caughtAt: '2026-09-12T13:00:00+02:00' })))).toEqual(GONE)
    expect(byId('catches', C_FOREIGN)).toMatchObject({ species: 'perch', length_cm: 25 })

    beforeCatchWrite = () => {
      db.catches = db.catches.filter((c) => c.id !== C_OWN)
    }
    expect(await run(() => updateCatch(editOwn()))).toEqual(GONE)
  })

  it('treats a catch whose session is gone as gone', async () => {
    db.sessions = db.sessions.filter((s) => s.id !== S_END)
    expect(await run(() => updateCatch(editOwn()))).toEqual(GONE)
  })
})

// ---------------------------------------------------------------------------------------------------
// deleteCatch

describe('deleteCatch (AC-28, AC-40)', () => {
  it('removes the catch for good and opens the detail view with the notice', async () => {
    expect(await run(() => deleteCatch({ id: C_OWN }))).toEqual({ redirect: `/sessions/${S_END}?notice=catch-deleted` })
    expect(byId('catches', C_OWN)).toBeUndefined()
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('leads a repeated delete back to its session while the session exists (BUG-5)', async () => {
    const input = { id: C_OWN, sessionId: S_END }
    expect(await run(() => deleteCatch(input))).toEqual({ redirect: `/sessions/${S_END}?notice=catch-deleted` })
    expect(await run(() => deleteCatch(input))).toEqual({ redirect: `/sessions/${S_END}?notice=catch-deleted` })
    // a foreign session named in the request is still „gone" — nothing about it is revealed
    expect(await run(() => deleteCatch({ id: C_OWN, sessionId: S_FOREIGN }))).toEqual(GONE)
  })

  it('treats a missing or foreign catch as gone and deletes nothing', async () => {
    expect(await run(() => deleteCatch({ id: C_NEW }))).toEqual(GONE)
    expect(await run(() => deleteCatch({ id: C_FOREIGN }))).toEqual(GONE)
    expect(byId('catches', C_FOREIGN)).toBeDefined()
  })

  it('rejects a broken request and a caller without login', async () => {
    expect(await run(() => deleteCatch({ id: 'x' }))).toEqual({ result: INVALID })
    expect(await run(() => deleteCatch(null as never))).toEqual({ result: INVALID })
    authUserId = null
    expect(await run(() => deleteCatch({ id: C_OWN }))).toEqual({ redirect: '/login' })
    expect(byId('catches', C_OWN)).toBeDefined()
  })

  it('turns a database failure into „Keine Verbindung"', async () => {
    failures.push({ table: 'catches', op: 'delete', error: { code: '08006', message: 'connection failure' } })
    expect(await run(() => deleteCatch({ id: C_OWN }))).toEqual({
      result: { status: 'error', message: 'Keine Verbindung. Bitte versuche es erneut.' },
    })
    expect(byId('catches', C_OWN)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------------------------------
// removeCatchPosition

describe('removeCatchPosition (AC-38)', () => {
  it('empties the position, sets the source to none and refreshes the affected pages', async () => {
    expect(await run(() => removeCatchPosition({ id: C_OWN }))).toEqual({ result: { status: 'success' } })
    expect(byId('catches', C_OWN)).toMatchObject({ latitude: null, longitude: null, accuracy_m: null, position_source: 'none' })
    expect(byId('sessions', S_END)).toMatchObject({ latitude: 53.5, longitude: 10, accuracy_m: 30 })
    expect(revalidatePath).toHaveBeenCalledWith(`/sessions/${S_END}`)
    expect(revalidatePath).toHaveBeenCalledWith(`/sessions/${S_END}/catches/${C_OWN}`)
  })

  it('treats a missing or foreign catch as gone and changes nothing', async () => {
    expect(await run(() => removeCatchPosition({ id: C_NEW }))).toEqual(GONE)
    expect(await run(() => removeCatchPosition({ id: C_FOREIGN }))).toEqual(GONE)
    expect(byId('catches', C_FOREIGN)).toMatchObject({ latitude: 50, position_source: 'session' })
  })

  it('rejects a broken request and a caller without login', async () => {
    expect(await run(() => removeCatchPosition({} as never))).toEqual({ result: INVALID })
    authUserId = null
    expect(await run(() => removeCatchPosition({ id: C_OWN }))).toEqual({ redirect: '/login' })
    expect(byId('catches', C_OWN)).toMatchObject({ latitude: 53.51, position_source: 'gps' })
  })
})
