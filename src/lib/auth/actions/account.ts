'use server'

// Account actions (PROJ-1: AC-17, AC-18, AC-20, AC-21, AC-27, AC-28, AC-33, EC-11 – EC-13).
// Every one of them re-checks the login with Supabase first (requireUser).
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logAuthError } from '../log'
import { MESSAGES, tooManyAttempts } from '../messages'
import { checkPassword } from '../password-check'
import { requireUser } from '../require-user'
import { currentSessionId, removeResetGrant, resetGrantState } from '../reset-grant'
import {
  changePasswordSchema,
  deleteAccountSchema,
  fieldErrors,
  newPasswordFormSchema,
  type ActionState,
  type ChangePasswordInput,
  type DeleteAccountInput,
  type NewPasswordInput,
} from '../schemas'

/**
 * Saves a new password with `supabase`'s session. Returns the form problem, or null when saved.
 * The caller signs out the other devices afterwards (AC-18, AC-20).
 */
async function saveNewPassword(supabase: SupabaseClient, password: string): Promise<ActionState | null> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error?.code === 'same_password') return { status: 'error', fieldErrors: { password: MESSAGES.samePassword, newPassword: MESSAGES.samePassword } }
  if (error?.code === 'weak_password') return { status: 'error', fieldErrors: { password: MESSAGES.passwordTooShort, newPassword: MESSAGES.passwordTooShort } }
  if (error) throw error
  return null
}

/**
 * /reset-password — only with a valid grant from the recovery link, in this very session (AC-17,
 * AC-18, AC-33). Expired → /account with the notice (EC-13); none → /account.
 */
export async function setNewPassword(input: NewPasswordInput): Promise<ActionState> {
  const user = await requireUser()

  let grant
  const supabase = await createClient()
  try {
    grant = resetGrantState(user, await currentSessionId(supabase))
    if (grant === 'expired') await removeResetGrant(createAdminClient(), user.id)
  } catch (e) {
    logAuthError('set-new-password', e)
    return { status: 'error', message: MESSAGES.network }
  }
  if (grant === 'expired') redirect('/account?notice=reset-expired')
  if (grant === 'none') redirect('/account')

  const parsed = newPasswordFormSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrors(parsed.error) }

  try {
    // Same password: nothing saved, the grant stays for the next try.
    const problem = await saveNewPassword(supabase, parsed.data.password)
    if (problem) return problem
    await removeResetGrant(createAdminClient(), user.id)
    await supabase.auth.signOut({ scope: 'others' })
  } catch (e) {
    logAuthError('set-new-password', e)
    return { status: 'error', message: MESSAGES.network }
  }
  revalidatePath('/', 'layout')
  redirect('/?notice=password-changed')
}

/** Konto → "Passwort ändern" (AC-20, AC-21). */
export async function changePassword(input: ChangePasswordInput): Promise<ActionState> {
  const user = await requireUser()
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrors(parsed.error) }

  try {
    const check = await checkPassword(user.email!, parsed.data.currentPassword)
    if (check.result === 'locked') return { status: 'error', message: tooManyAttempts(check.minutes) }
    if (check.result !== 'ok') return { status: 'error', fieldErrors: { currentPassword: MESSAGES.wrongCurrentPassword } }

    // The check just signed in anew on this device; saving with that fresh session also works when
    // the previous one is older than 24 h (secure_password_change, design.md).
    const problem = await saveNewPassword(check.supabase, parsed.data.newPassword)
    if (problem) return problem
    await check.supabase.auth.signOut({ scope: 'others' })
  } catch (e) {
    logAuthError('change-password', e)
    return { status: 'error', message: MESSAGES.network }
  }
  return { status: 'success', message: MESSAGES.passwordChanged }
}

/** Konto → "Konto löschen": everything tied to the account goes with it (AC-27, AC-28, EC-12). */
export async function deleteAccount(input: DeleteAccountInput): Promise<ActionState> {
  const user = await requireUser()
  const parsed = deleteAccountSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrors(parsed.error) }

  try {
    const check = await checkPassword(user.email!, parsed.data.password)
    if (check.result === 'locked') return { status: 'error', message: tooManyAttempts(check.minutes) }
    if (check.result !== 'ok') return { status: 'error', fieldErrors: { password: MESSAGES.wrongPassword } }

    const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
    if (error) throw error
  } catch (e) {
    logAuthError('delete-account', e)
    return { status: 'error', message: MESSAGES.network }
  }

  // The session no longer exists on the server; clear the auth cookies on this device.
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  const cookieStore = await cookies()
  cookieStore
    .getAll()
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    .forEach((c) => cookieStore.delete(c.name))
  revalidatePath('/', 'layout')
  redirect('/login?notice=account-deleted')
}
