// Login brake, mail limit and signup limit (PROJ-1 design.md → „Die Login-Bremse").
//
// The login brake and the signup limit follow "insert first, then count": the attempt is logged
// before it is counted, so concurrent attempts see each other and a burst of parallel requests cannot
// slip through. The mail limit is decided in one step inside the database (claim_mail_request, under a
// lock per address), so a double tap gets exactly one 'send' (EC-5). Counting never depends on whether
// an account exists, so a lock reveals nothing either.
//
// The log lives in public.auth_throttle_events (server-only, service-role key). The store is an
// interface so the rules can be tested without a database.
import type { SupabaseClient } from '@supabase/supabase-js'

export const LIMITS = {
  /** AC-23: more than 5 failures per address in 15 min → locked for 15 min after the newest one. */
  loginPerEmail: 5,
  /** AC-24: more than 20 failures per IP in 15 min → locked the same way. */
  loginPerIp: 20,
  loginWindowMinutes: 15,
  lockMinutes: 15,
  /** AC-25: at most 3 mails per address and hour — enforced by claim_mail_request in the database. */
  mailPerEmail: 3,
  mailWindowMinutes: 60,
  /** EC-5: a second mail for the same address within 10 s is a double tap, not a new request. */
  mailDuplicateSeconds: 10,
  /** AC-26: at most 5 signups per IP and hour. */
  signupPerIp: 5,
  signupWindowMinutes: 60,
} as const

export type ThrottleKind = 'login_attempt' | 'mail_request' | 'signup'
export type ThrottleOutcome = 'pending' | 'failed' | 'succeeded' | 'allowed' | 'blocked' | 'duplicate'
/** claim_mail_request's answer: request the mail, drop it as a double tap, or refuse it (AC-25). */
export type MailClaim = 'send' | 'duplicate' | 'limit'

export interface ThrottleQuery {
  kind: ThrottleKind
  key: 'email' | 'ip'
  value: string
  outcomes: ThrottleOutcome[]
  /** Exclusive: an entry exactly `since` old no longer counts. */
  since: Date
  excludeId?: string
}

export interface ThrottleStore {
  insert(event: {
    kind: ThrottleKind
    email: string | null
    ip: string
    outcome: ThrottleOutcome
    createdAt: Date
  }): Promise<string>
  count(query: ThrottleQuery): Promise<number>
  newest(query: ThrottleQuery): Promise<Date | null>
  setOutcome(id: string, outcome: ThrottleOutcome): Promise<void>
  remove(id: string): Promise<void>
  /** Logs and decides a mail request in one atomic step (see claim_mail_request). */
  claimMail(email: string, ip: string): Promise<MailClaim>
}

const MINUTE = 60_000
const COUNTED_LOGIN: ThrottleOutcome[] = ['pending', 'failed']

export type LoginAttemptStart =
  | { ok: true; attemptId: string }
  | { ok: false; retryMinutes: number }

/**
 * Starts a password check for `email` from `ip`. Returns an attempt id to finish afterwards, or the
 * minutes until the lock ends — in which case the password must not be checked at all.
 */
export async function beginLoginAttempt(
  store: ThrottleStore,
  { email, ip }: { email: string; ip: string },
  now: Date = new Date(),
): Promise<LoginAttemptStart> {
  const attemptId = await store.insert({
    kind: 'login_attempt',
    email,
    ip,
    outcome: 'pending',
    createdAt: now,
  })
  const since = new Date(now.getTime() - LIMITS.loginWindowMinutes * MINUTE)
  const byEmail: ThrottleQuery = { kind: 'login_attempt', key: 'email', value: email, outcomes: COUNTED_LOGIN, since }
  const byIp: ThrottleQuery = { kind: 'login_attempt', key: 'ip', value: ip, outcomes: COUNTED_LOGIN, since }

  const [emailCount, ipCount] = await Promise.all([store.count(byEmail), store.count(byIp)])
  const emailLocked = emailCount > LIMITS.loginPerEmail
  const ipLocked = ipCount > LIMITS.loginPerIp
  if (!emailLocked && !ipLocked) return { ok: true, attemptId }

  await store.setOutcome(attemptId, 'blocked')
  // The wait runs from the newest real failure; checks still in flight are not failures (BUG-5).
  const failures = await Promise.all([
    emailLocked ? store.newest({ ...byEmail, outcomes: ['failed'], excludeId: attemptId }) : null,
    ipLocked ? store.newest({ ...byIp, outcomes: ['failed'], excludeId: attemptId }) : null,
  ])
  const times = failures.filter((d): d is Date => d instanceof Date).map((d) => d.getTime())
  // Locked only by concurrent checks: they finish within moments, so the promise is one minute.
  if (times.length === 0) return { ok: false, retryMinutes: 1 }
  // A timestamp from the future (a concurrent request's clock) counts as "now".
  const newestFailure = Math.min(Math.max(...times), now.getTime())
  const minutes = Math.ceil((newestFailure + LIMITS.lockMinutes * MINUTE - now.getTime()) / MINUTE)
  return { ok: false, retryMinutes: Math.min(LIMITS.lockMinutes, Math.max(1, minutes)) }
}

/**
 * Records how the password check ended. `discard` removes the attempt (a technical failure is not
 * the user's fault and must not count toward the lock).
 */
export async function finishLoginAttempt(
  store: ThrottleStore,
  attemptId: string,
  result: 'failed' | 'succeeded' | 'discard',
): Promise<void> {
  if (result === 'discard') return store.remove(attemptId)
  return store.setOutcome(attemptId, result)
}

/**
 * AC-25, EC-5: may another mail go to `email`? 'send' → request it; 'duplicate' → a mail went out
 * moments ago, answer as if sent; 'limit' → refuse. Counted whether or not an account exists.
 */
export function claimMailRequest(store: ThrottleStore, { email, ip }: { email: string; ip: string }): Promise<MailClaim> {
  return store.claimMail(email, ip)
}

/** AC-26: may `ip` register another account? The address is not stored (data minimisation). */
export async function allowSignup(store: ThrottleStore, { ip }: { ip: string }, now: Date = new Date()): Promise<boolean> {
  const id = await store.insert({ kind: 'signup', email: null, ip, outcome: 'allowed', createdAt: now })
  const since = new Date(now.getTime() - LIMITS.signupWindowMinutes * MINUTE)
  const count = await store.count({ kind: 'signup', key: 'ip', value: ip, outcomes: ['allowed'], since })
  if (count <= LIMITS.signupPerIp) return true
  await store.setOutcome(id, 'blocked')
  return false
}

/** The production store: public.auth_throttle_events through the service-role client. */
export function supabaseThrottleStore(db: SupabaseClient): ThrottleStore {
  const table = () => db.from('auth_throttle_events')

  return {
    async insert(event) {
      const { data, error } = await table()
        .insert({
          kind: event.kind,
          email: event.email,
          ip: event.ip,
          outcome: event.outcome,
          created_at: event.createdAt.toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    async count(q) {
      let query = table()
        .select('id', { count: 'exact', head: true })
        .eq('kind', q.kind)
        .eq(q.key, q.value)
        .in('outcome', q.outcomes)
        .gt('created_at', q.since.toISOString())
      if (q.excludeId) query = query.neq('id', q.excludeId)
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    },
    async newest(q) {
      let query = table()
        .select('created_at')
        .eq('kind', q.kind)
        .eq(q.key, q.value)
        .in('outcome', q.outcomes)
        .gt('created_at', q.since.toISOString())
      if (q.excludeId) query = query.neq('id', q.excludeId)
      const { data, error } = await query.order('created_at', { ascending: false }).limit(1)
      if (error) throw error
      return data && data.length > 0 ? new Date(data[0].created_at as string) : null
    },
    async setOutcome(id, outcome) {
      const { error } = await table().update({ outcome }).eq('id', id)
      if (error) throw error
    },
    async remove(id) {
      const { error } = await table().delete().eq('id', id)
      if (error) throw error
    },
    async claimMail(email, ip) {
      const { data, error } = await db.rpc('claim_mail_request', { p_email: email, p_ip: ip })
      if (error) throw error
      if (data !== 'send' && data !== 'duplicate' && data !== 'limit') {
        throw new Error(`claim_mail_request: unexpected answer ${String(data)}`)
      }
      return data
    },
  }
}
