// The grant to set a new password without the current one (PROJ-1 design.md → „Freigabe zum
// Festlegen", AC-33, EC-13). A valid recovery link creates it for exactly the session it signed in,
// for 15 minutes; /reset-password and its Server Action accept a new password only while it holds.
// It lives in the account's app_metadata, which only the service-role key can write.
import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export const RESET_GRANT_MINUTES = 15

export type ResetGrantState = 'valid' | 'expired' | 'none'

/** After a valid recovery link (/auth/confirm). A new grant replaces an older one. */
export async function createResetGrant(
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  const expiresAt = new Date(now.getTime() + RESET_GRANT_MINUTES * 60_000).toISOString()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { password_reset: { session_id: sessionId, expires_at: expiresAt } },
  })
  if (error) throw error
}

/** Supabase drops an app_metadata key that is set to null. */
export async function removeResetGrant(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { password_reset: null } })
  if (error) throw error
}

/**
 * `user` must come from Supabase itself (getUser), `sessionId` from the verified session
 * (currentSessionId) — never from anything the browser sends. A grant of another session is 'none'.
 */
export function resetGrantState(
  user: Pick<User, 'app_metadata'>,
  sessionId: string | null,
  now: Date = new Date(),
): ResetGrantState {
  const grant = user.app_metadata?.password_reset as { session_id?: unknown; expires_at?: unknown } | null | undefined
  if (!grant || !sessionId || grant.session_id !== sessionId) return 'none'
  const expiresAt = typeof grant.expires_at === 'string' ? Date.parse(grant.expires_at) : NaN
  return Number.isFinite(expiresAt) && now.getTime() < expiresAt ? 'valid' : 'expired'
}

/** The id of the signed-in session, from its verified access token (getClaims checks the signature). */
export async function currentSessionId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims()
  const id = data?.claims.session_id
  return !error && typeof id === 'string' && id ? id : null
}
