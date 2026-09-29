// Shared by signup, "Mail erneut senden" and the expired-link page (PROJ-1 design.md): the account
// state of an address, and re-sending the confirmation mail — only ever to an unconfirmed account,
// never re-registering it, so its first password stays valid (EC-8).
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type AccountState = 'none' | 'unconfirmed' | 'confirmed'

export async function accountState(admin: SupabaseClient, email: string): Promise<AccountState> {
  const { data, error } = await admin.rpc('auth_account_state', { p_email: email })
  if (error) throw error
  return data as AccountState
}

/** Resends the confirmation mail when the account is unconfirmed; otherwise does nothing. */
export async function resendConfirmationIfUnconfirmed(admin: SupabaseClient, email: string): Promise<void> {
  if ((await accountState(admin, email)) !== 'unconfirmed') return
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  // Supabase's own 10-second spacing per account (EC-5) is not an error for the user.
  if (error && error.status !== 429) throw error
}
