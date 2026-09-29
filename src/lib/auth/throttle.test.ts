import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  allowSignup,
  beginLoginAttempt,
  claimMailRequest,
  finishLoginAttempt,
  supabaseThrottleStore,
  type ThrottleOutcome,
  type ThrottleQuery,
  type ThrottleStore,
} from './throttle'
import { atLeast } from './min-duration'

type Row = {
  id: string
  kind: string
  email: string | null
  ip: string
  outcome: ThrottleOutcome
  createdAt: Date
}

function memoryStore() {
  const rows: Row[] = []
  let seq = 0
  const match = (r: Row, q: ThrottleQuery) =>
    r.kind === q.kind &&
    (q.key === 'email' ? r.email === q.value : r.ip === q.value) &&
    q.outcomes.includes(r.outcome) &&
    r.createdAt > q.since &&
    r.id !== q.excludeId
  const store: ThrottleStore = {
    async insert(e) {
      const id = `r${++seq}`
      rows.push({ id, ...e })
      return id
    },
    async count(q) {
      return rows.filter((r) => match(r, q)).length
    },
    async newest(q) {
      const hits = rows.filter((r) => match(r, q)).map((r) => r.createdAt.getTime())
      return hits.length ? new Date(Math.max(...hits)) : null
    },
    async setOutcome(id, outcome) {
      rows.find((r) => r.id === id)!.outcome = outcome
    },
    async remove(id) {
      rows.splice(
        rows.findIndex((r) => r.id === id),
        1,
      )
    },
    async claimMail() {
      throw new Error('decided by claim_mail_request in the database — not part of these tests')
    },
  }
  return { store, rows }
}

const T0 = new Date('2026-09-29T10:00:00Z')
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000)

async function fail(store: ThrottleStore, email: string, ip: string, when: Date) {
  const r = await beginLoginAttempt(store, { email, ip }, when)
  if (r.ok) await finishLoginAttempt(store, r.attemptId, 'failed')
  return r
}

describe('login brake per address (AC-23)', () => {
  it('allows 5 failures and blocks the 6th attempt until 15 minutes after the 5th failure', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 5; i++) expect((await fail(store, 'a@b.de', `10.0.0.${i}`, at(i))).ok).toBe(true)
    const sixth = await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.1.1' }, at(5))
    // 5th failure at minute 4 → locked until minute 19 → 14 minutes left at minute 5
    expect(sixth).toEqual({ ok: false, retryMinutes: 14 })
  })

  it('does not check the password during the lock — the blocked attempt is not counted', async () => {
    const { store, rows } = memoryStore()
    for (let i = 0; i < 5; i++) await fail(store, 'a@b.de', '10.0.0.1', at(0))
    const blocked = await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(10))
    expect(blocked.ok).toBe(false)
    expect(rows.at(-1)!.outcome).toBe('blocked')
    // the lock ends 15 minutes after the newest failure, not after the blocked try
    expect((await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(15))).ok).toBe(true)
  })

  it('does not count successful or discarded checks', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 10; i++) {
      const r = await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(0))
      expect(r.ok).toBe(true)
      if (r.ok) await finishLoginAttempt(store, r.attemptId, i % 2 ? 'succeeded' : 'discard')
    }
  })

  it('forgets failures older than 15 minutes', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 5; i++) await fail(store, 'a@b.de', '10.0.0.1', at(0))
    expect((await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(16))).ok).toBe(true)
  })

  it('counts attempts still in flight, so a parallel burst cannot slip through', async () => {
    const { store } = memoryStore()
    const burst = await Promise.all(
      Array.from({ length: 10 }, () => beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(0))),
    )
    expect(burst.filter((r) => r.ok).length).toBeLessThanOrEqual(5)
  })
})

describe('waiting time in the lock message (AC-23, BUG-5)', () => {
  it('ignores checks still in flight: a lock only from a parallel burst promises 1 minute', async () => {
    const { store } = memoryStore()
    const burst = await Promise.all(
      Array.from({ length: 10 }, () => beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(0))),
    )
    const refused = burst.filter((r) => !r.ok)
    expect(refused.length).toBeGreaterThan(0)
    for (const r of refused) expect(r).toEqual({ ok: false, retryMinutes: 1 })
  })

  it('runs from the newest real failure, not from a newer check still in flight', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 4; i++) await fail(store, 'a@b.de', '10.0.0.1', at(0))
    const inFlight = await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(8))
    expect(inFlight.ok).toBe(true) // still pending — counts toward the lock, but is no failure
    expect(await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(10))).toEqual({
      ok: false,
      retryMinutes: 5,
    })
  })

  it('never promises more than 15 minutes, even for a failure stamped in the future', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 5; i++) await fail(store, 'a@b.de', '10.0.0.1', at(2)) // clock ahead of ours
    expect(await beginLoginAttempt(store, { email: 'a@b.de', ip: '10.0.0.1' }, at(0))).toEqual({
      ok: false,
      retryMinutes: 15,
    })
  })

  it('takes the longer wait when address and IP are both locked', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 20; i++) await fail(store, `u${i}@b.de`, '1.2.3.4', at(0))
    for (let i = 0; i < 5; i++) await fail(store, 'a@b.de', '9.9.9.9', at(6))
    const r = await beginLoginAttempt(store, { email: 'a@b.de', ip: '1.2.3.4' }, at(7))
    expect(r).toEqual({ ok: false, retryMinutes: 14 })
  })
})

describe('login brake per IP (AC-24)', () => {
  it('blocks the 21st attempt from one IP across different addresses', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 20; i++) expect((await fail(store, `u${i}@b.de`, '1.2.3.4', at(0))).ok).toBe(true)
    const r = await beginLoginAttempt(store, { email: 'neu@b.de', ip: '1.2.3.4' }, at(3))
    expect(r).toEqual({ ok: false, retryMinutes: 12 })
    expect((await beginLoginAttempt(store, { email: 'neu@b.de', ip: '9.9.9.9' }, at(3))).ok).toBe(true)
  })
})

describe('mail limit (AC-25, EC-5) — decided by claim_mail_request', () => {
  function rpcClient(answer: unknown) {
    const rpc = vi.fn().mockResolvedValue({ data: answer, error: null })
    return { db: { rpc } as unknown as SupabaseClient, rpc }
  }

  it('asks the database function with address and IP and returns its answer', async () => {
    for (const answer of ['send', 'duplicate', 'limit'] as const) {
      const { db, rpc } = rpcClient(answer)
      expect(await claimMailRequest(supabaseThrottleStore(db), { email: 'a@b.de', ip: '2.2.2.2' })).toBe(answer)
      expect(rpc).toHaveBeenCalledWith('claim_mail_request', { p_email: 'a@b.de', p_ip: '2.2.2.2' })
    }
  })

  it('refuses an answer outside the contract instead of sending a mail', async () => {
    await expect(claimMailRequest(supabaseThrottleStore(rpcClient(true).db), { email: 'a@b.de', ip: 'x' })).rejects.toThrow(
      'unexpected answer',
    )
  })

  it('passes a database error on (the action shows the connection notice)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } })
    await expect(
      claimMailRequest(supabaseThrottleStore({ rpc } as unknown as SupabaseClient), { email: 'a@b.de', ip: 'x' }),
    ).rejects.toEqual({ message: 'down' })
  })
})

describe('signup limit (AC-26)', () => {
  it('allows 5 signups per IP and hour and stores no address', async () => {
    const { store, rows } = memoryStore()
    for (let i = 0; i < 5; i++) expect(await allowSignup(store, { ip: '5.5.5.5' }, at(i))).toBe(true)
    expect(await allowSignup(store, { ip: '5.5.5.5' }, at(30))).toBe(false)
    expect(await allowSignup(store, { ip: '6.6.6.6' }, at(30))).toBe(true)
    expect(rows.every((r) => r.email === null)).toBe(true)
  })
})

describe('atLeast (equal response time)', () => {
  it('waits for the minimum even when the work is instant or throws', async () => {
    let t = Date.now()
    await atLeast(async () => 1, 120)
    expect(Date.now() - t).toBeGreaterThanOrEqual(110)
    t = Date.now()
    await expect(
      atLeast(async () => {
        throw new Error('x')
      }, 120),
    ).rejects.toThrow('x')
    expect(Date.now() - t).toBeGreaterThanOrEqual(110)
  })
})
