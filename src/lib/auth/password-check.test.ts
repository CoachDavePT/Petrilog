// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThrottleOutcome, ThrottleQuery, ThrottleStore } from './throttle'

type Row = { id: string; kind: string; email: string | null; ip: string; outcome: ThrottleOutcome; createdAt: Date }

const rows: Row[] = []
let seq = 0
const matches = (r: Row, q: ThrottleQuery) =>
  r.kind === q.kind &&
  (q.key === 'email' ? r.email === q.value : r.ip === q.value) &&
  q.outcomes.includes(r.outcome) &&
  r.createdAt > q.since &&
  r.id !== q.excludeId

// Stands in for public.auth_throttle_events — the brake logic itself stays real.
const store: ThrottleStore = {
  async insert(e) {
    const id = `r${++seq}`
    rows.push({ id, ...e })
    return id
  },
  async count(q) {
    return rows.filter((r) => matches(r, q)).length
  },
  async newest(q) {
    const times = rows.filter((r) => matches(r, q)).map((r) => r.createdAt.getTime())
    return times.length ? new Date(Math.max(...times)) : null
  },
  async setOutcome(id, outcome) {
    rows.find((r) => r.id === id)!.outcome = outcome
  },
  async remove(id) {
    rows.splice(rows.findIndex((r) => r.id === id), 1)
  },
  async claimMail() {
    return 'send'
  },
}

const signInWithPassword = vi.fn()
const serverClient = { auth: { signInWithPassword } }

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => serverClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('./throttle', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./throttle')>()),
  supabaseThrottleStore: () => store,
}))

const { checkPassword } = await import('./password-check')

const EMAIL = 'angler@beispiel.de'
const outcomes = () => rows.map((r) => r.outcome)

beforeEach(() => {
  rows.length = 0
  signInWithPassword.mockReset()
})

describe('checkPassword — result of one check (AC-7, AC-8, AC-9, AC-21)', () => {
  it('returns the signed-in client on the right password and records a success', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const check = await checkPassword(EMAIL, 'Angel1234')
    expect(check).toEqual({ result: 'ok', supabase: serverClient })
    expect(signInWithPassword).toHaveBeenCalledWith({ email: EMAIL, password: 'Angel1234' })
    expect(outcomes()).toEqual(['succeeded'])
  })

  it('reports a wrong password and counts it as a failure', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } })
    expect(await checkPassword(EMAIL, 'falsch123')).toEqual({ result: 'wrong' })
    expect(outcomes()).toEqual(['failed'])
  })

  it('reports an unconfirmed account without counting it as a failure', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'email_not_confirmed', status: 400 } })
    expect(await checkPassword(EMAIL, 'Angel1234')).toEqual({ result: 'unconfirmed' })
    expect(outcomes()).toEqual(['succeeded'])
  })
})

describe('checkPassword — passwords over 72 bytes (AC-34 counterpart, T41)', () => {
  it('rejects 37 umlauts (74 bytes) as wrong without asking Supabase, and the attempt counts', async () => {
    expect(await checkPassword(EMAIL, 'ä'.repeat(37))).toEqual({ result: 'wrong' })
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(outcomes()).toEqual(['failed'])
  })

  it('still asks Supabase for exactly 72 bytes (36 umlauts)', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    expect((await checkPassword(EMAIL, 'ä'.repeat(36))).result).toBe('ok')
    expect(signInWithPassword).toHaveBeenCalledTimes(1)
  })
})

describe('checkPassword — login brake (AC-23, EC-11)', () => {
  it('locks after 5 failures: the 6th check is refused even with the right password, without asking Supabase', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400 } })
    for (let i = 0; i < 5; i++) expect((await checkPassword(EMAIL, 'falsch123')).result).toBe('wrong')

    signInWithPassword.mockReset().mockResolvedValue({ error: null })
    expect(await checkPassword(EMAIL, 'Angel1234')).toEqual({ result: 'locked', minutes: 15 })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('counts over-long passwords toward the lock too', async () => {
    for (let i = 0; i < 5; i++) await checkPassword(EMAIL, '😀'.repeat(19))
    expect((await checkPassword(EMAIL, 'Angel1234')).result).toBe('locked')
    expect(signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('checkPassword — technical failures do not count (EC-6)', () => {
  it('discards the attempt and re-throws when Supabase is unreachable', async () => {
    const down = new Error('fetch failed')
    signInWithPassword.mockRejectedValue(down)
    await expect(checkPassword(EMAIL, 'Angel1234')).rejects.toBe(down)
    expect(rows).toHaveLength(0)
  })

  it("turns Supabase's own rate limit (429) into a 5-minute lock and discards the attempt", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'over_request_rate_limit', status: 429 } })
    expect(await checkPassword(EMAIL, 'Angel1234')).toEqual({ result: 'locked', minutes: 5 })
    expect(rows).toHaveLength(0)
  })

  it('discards and re-throws any other Supabase error', async () => {
    const odd = { code: 'unexpected_failure', status: 500 }
    signInWithPassword.mockResolvedValue({ error: odd })
    await expect(checkPassword(EMAIL, 'Angel1234')).rejects.toBe(odd)
    expect(rows).toHaveLength(0)
  })
})
