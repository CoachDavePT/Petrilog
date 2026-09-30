// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown; error: unknown }

const calls: { table: string; method: string; args: unknown[] }[] = []
let results: Record<string, Result> = {}

// A chainable stand-in for the query builder: records every call, resolves to the table's result.
function builder(table: string) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'overrideTypes']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ table, method, args })
      return chain
    }
  }
  chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(results[table]).then(resolve, reject)
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (table: string) => builder(table) }),
}))
vi.mock('@/lib/auth/require-user', () => ({
  requireUser: async () => ({
    id: 'user-1',
    email: 'angler@example.com',
    created_at: '2026-09-01T08:00:00Z',
    email_confirmed_at: '2026-09-01T08:05:00Z',
    last_sign_in_at: '2026-09-30T06:00:00Z',
  }),
}))

const { GET } = await import('./route')

const catchRow = (over: Record<string, unknown>) => ({
  id: 'c-1',
  caught_at: '2026-09-29T17:10:00+00:00',
  species: 'pike',
  species_other: null,
  length_cm: 64,
  weight_g: 1800,
  bait: 'Gummifisch',
  released: true,
  latitude: 54.1,
  longitude: 13.4,
  accuracy_m: 12,
  position_source: 'gps',
  created_at: '2026-09-29T17:11:02.123+00:00',
  updated_at: '2026-09-29T17:11:02.123+00:00',
  ...over,
})

const sessionRows = [
  {
    id: 's-2',
    started_at: '2026-09-29T16:00:00+00:00',
    ended_at: '2026-09-29T19:30:00+00:00',
    water_name: 'Peenestrom',
    note: 'Wind aus West',
    latitude: 54.1,
    longitude: 13.4,
    accuracy_m: 12,
    created_at: '2026-09-29T16:00:05+00:00',
    updated_at: '2026-09-29T19:30:01+00:00',
    catches: [
      catchRow({}),
      catchRow({
        id: 'c-2',
        caught_at: '2026-09-29T18:00:00+00:00',
        species: 'other',
        species_other: 'Rapfen',
        weight_g: null,
        bait: null,
        latitude: null,
        longitude: null,
        accuracy_m: null,
        position_source: 'none',
      }),
    ],
  },
  {
    id: 's-1',
    started_at: '2026-09-20T05:00:00+00:00',
    ended_at: null,
    water_name: null,
    note: null,
    latitude: null,
    longitude: null,
    accuracy_m: null,
    created_at: '2026-09-20T05:00:03+00:00',
    updated_at: '2026-09-20T05:00:03+00:00',
    catches: [],
  },
]

beforeEach(() => {
  calls.length = 0
  results = {
    profiles: { data: { id: 'user-1', created_at: '2026-09-01T08:00:00+00:00' }, error: null },
    sessions: { data: sessionRows, error: null },
  }
})

describe('GET /account/export — version 2 (AC-35)', () => {
  it('keeps account and profile from version 1 and adds all sessions with their catches', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.format).toBe('petrilog-export')
    expect(body.version).toBe(2)
    expect(body.account).toEqual({
      email: 'angler@example.com',
      created_at: '2026-09-01T08:00:00Z',
      email_confirmed_at: '2026-09-01T08:05:00Z',
      last_sign_in_at: '2026-09-30T06:00:00Z',
    })
    expect(body.profile).toEqual({ id: 'user-1', created_at: '2026-09-01T08:00:00+00:00' })

    expect(body.sessions.map((s: { id: string }) => s.id)).toEqual(['s-2', 's-1'])
    const { catches, ...session } = body.sessions[0]
    const { catches: sourceCatches, ...sourceSession } = sessionRows[0]
    expect(session).toEqual(sourceSession)
    expect(sourceCatches).toHaveLength(2)
    expect(catches).toHaveLength(2)
    expect(catches[0]).toEqual({ ...catchRow({}), species_label: 'Hecht' })
    expect(catches[1]).toMatchObject({ species: 'other', species_label: 'Sonstige', species_other: 'Rapfen' })
    expect(catches[1].position_source).toBe('none')
    expect(body.sessions[1].catches).toEqual([])
    expect(body.sessions[1].ended_at).toBeNull()
  })

  it('keeps timestamps exactly as the database returns them (ISO with time zone)', async () => {
    const body = await (await GET()).json()
    expect(body.sessions[0].started_at).toBe('2026-09-29T16:00:00+00:00')
    expect(body.sessions[0].catches[0].caught_at).toBe('2026-09-29T17:10:00+00:00')
    expect(body.sessions[0].catches[0].created_at).toBe('2026-09-29T17:11:02.123+00:00')
  })

  it('never asks for or writes out user_id or session_id', async () => {
    const response = await GET()
    const text = await response.text()
    expect(text).not.toContain('user_id')
    expect(text).not.toContain('session_id')

    const select = calls.find((c) => c.table === 'sessions' && c.method === 'select')
    expect(select).toBeDefined()
    const columns = String(select!.args[0])
    expect(columns).not.toMatch(/user_id|session_id/)
    expect(columns).toMatch(/catches \(.*position_source.*\)/)
    for (const column of ['started_at', 'ended_at', 'water_name', 'note', 'accuracy_m', 'updated_at']) {
      expect(columns).toContain(column)
    }
  })

  it('loads sessions and catches in one query: sessions newest first, catches by catch time', async () => {
    await GET()
    const sessionCalls = calls.filter((c) => c.table === 'sessions')
    expect(sessionCalls.filter((c) => c.method === 'select')).toHaveLength(1)
    expect(calls.filter((c) => c.table === 'catches')).toHaveLength(0)
    expect(sessionCalls).toContainEqual({ table: 'sessions', method: 'eq', args: ['user_id', 'user-1'] })
    const orders = sessionCalls.filter((c) => c.method === 'order').map((c) => c.args)
    expect(orders[0]).toEqual(['started_at', { ascending: false }])
    expect(orders[1]).toEqual(['caught_at', { ascending: true, referencedTable: 'catches' }])
  })

  it('exports an empty session list for a user without sessions', async () => {
    results.sessions = { data: [], error: null }
    const body = await (await GET()).json()
    expect(body.sessions).toEqual([])
  })

  it('answers with the German error text when a query fails', async () => {
    results.sessions = { data: null, error: { message: 'boom' } }
    let response = await GET()
    expect(response.status).toBe(500)
    expect(await response.text()).toBe('Export fehlgeschlagen. Bitte versuche es erneut.')

    results.sessions = { data: sessionRows, error: null }
    results.profiles = { data: null, error: { message: 'boom' } }
    response = await GET()
    expect(response.status).toBe(500)
  })

  it('sends the file as a dated, never cached download', async () => {
    const response = await GET()
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="petrilog-export-\d{4}-\d{2}-\d{2}\.json"$/
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})
