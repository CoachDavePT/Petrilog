// One password check for login, "Passwort ändern" and "Konto löschen" (PROJ-1 design.md): every
// check goes through the login brake, so failures in any of the three count toward the same lock
// (AC-23, AC-24, EC-11). A successful check signs the user in on this device (session cookies).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { clientIp } from './client-ip'
import { PASSWORD_MAX_BYTES, utf8Length } from './schemas'
import { beginLoginAttempt, finishLoginAttempt, supabaseThrottleStore } from './throttle'

export type PasswordCheck =
  /** `supabase` holds the session this check just created — save a new password with it (secure_password_change). */
  | { result: 'ok'; supabase: SupabaseClient }
  | { result: 'wrong' }
  | { result: 'unconfirmed' }
  | { result: 'locked'; minutes: number }

/** Throws on technical failures (Supabase unreachable) — callers show the connection notice. */
export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const ip = clientIp(await headers())
  const store = supabaseThrottleStore(createAdminClient())

  const attempt = await beginLoginAttempt(store, { email, ip })
  if (!attempt.ok) return { result: 'locked', minutes: attempt.retryMinutes }

  // No stored password can be longer than 72 bytes: wrong without asking Supabase, but it counts.
  if (utf8Length(password) > PASSWORD_MAX_BYTES) {
    await finishLoginAttempt(store, attempt.attemptId, 'failed')
    return { result: 'wrong' }
  }

  const supabase = await createClient()
  let error
  try {
    ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
  } catch (e) {
    await finishLoginAttempt(store, attempt.attemptId, 'discard')
    throw e
  }

  if (!error) {
    await finishLoginAttempt(store, attempt.attemptId, 'succeeded')
    return { result: 'ok', supabase }
  }
  // Supabase reports "not confirmed" only after a correct password — it reveals nothing (AC-9).
  if (error.code === 'email_not_confirmed') {
    await finishLoginAttempt(store, attempt.attemptId, 'succeeded')
    return { result: 'unconfirmed' }
  }
  if (error.code === 'invalid_credentials') {
    await finishLoginAttempt(store, attempt.attemptId, 'failed')
    return { result: 'wrong' }
  }
  await finishLoginAttempt(store, attempt.attemptId, 'discard')
  // Supabase's own per-IP limit (5-minute window) — report it as a lock, not as a network problem.
  if (error.status === 429) return { result: 'locked', minutes: 5 }
  throw error
}
