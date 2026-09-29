import { describe, expect, it } from 'vitest'
import {
  allowMailRequest,
  allowSignup,
  beginLoginAttempt,
  finishLoginAttempt,
  type ThrottleOutcome,
  type ThrottleQuery,
  type ThrottleStore,
} from './throttle'
import { clientIp } from './client-ip'
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

describe('login brake per IP (AC-24)', () => {
  it('blocks the 21st attempt from one IP across different addresses', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 20; i++) expect((await fail(store, `u${i}@b.de`, '1.2.3.4', at(0))).ok).toBe(true)
    const r = await beginLoginAttempt(store, { email: 'neu@b.de', ip: '1.2.3.4' }, at(3))
    expect(r).toEqual({ ok: false, retryMinutes: 12 })
    expect((await beginLoginAttempt(store, { email: 'neu@b.de', ip: '9.9.9.9' }, at(3))).ok).toBe(true)
  })
})

describe('mail limit (AC-25)', () => {
  it('allows 3 mails per address and hour, then blocks — whether or not the account exists', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 3; i++) expect(await allowMailRequest(store, { email: 'x@y.de', ip: '1.1.1.1' }, at(i))).toBe(true)
    expect(await allowMailRequest(store, { email: 'x@y.de', ip: '1.1.1.1' }, at(10))).toBe(false)
    expect(await allowMailRequest(store, { email: 'other@y.de', ip: '1.1.1.1' }, at(10))).toBe(true)
    expect(await allowMailRequest(store, { email: 'x@y.de', ip: '1.1.1.1' }, at(61))).toBe(true)
  })

  it('does not let blocked requests extend the limit', async () => {
    const { store } = memoryStore()
    for (let i = 0; i < 3; i++) await allowMailRequest(store, { email: 'x@y.de', ip: '1.1.1.1' }, at(0))
    for (let i = 0; i < 5; i++) await allowMailRequest(store, { email: 'x@y.de', ip: '1.1.1.1' }, at(30))
    expect(await allowMailRequest(store, { email: 'x@y.de', ip: '1.1.1.1' }, at(60))).toBe(true)
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

describe('clientIp', () => {
  const h = (values: Record<string, string>) => ({ get: (n: string) => values[n] ?? null })
  it('takes the first x-forwarded-for entry, then x-real-ip, else "unknown"', () => {
    expect(clientIp(h({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientIp(h({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientIp(h({}))).toBe('unknown')
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
