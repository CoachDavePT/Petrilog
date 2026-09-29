'use server'

// Signup (PROJ-1: AC-1, AC-2, AC-4 – AC-6, AC-25, AC-26, EC-5, EC-8). Whatever the address's state,
// the visitor sees the same "Prüfe dein Postfach" result — nothing reveals an existing account.
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { clientIp } from '../client-ip'
import { accountState, resendConfirmationIfUnconfirmed } from '../confirmation-mail'
import { logAuthError } from '../log'
import { MESSAGES } from '../messages'
import { atLeast } from '../min-duration'
import { fieldErrors, registerSchema, type ActionState, type RegisterInput } from '../schemas'
import { allowSignup, claimMailRequest, supabaseThrottleStore } from '../throttle'

export async function register(input: RegisterInput): Promise<ActionState> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrors(parsed.error) }
  const { email, password } = parsed.data

  return atLeast(async (): Promise<ActionState> => {
    try {
      const ip = clientIp(await headers())
      const admin = createAdminClient()
      const store = supabaseThrottleStore(admin)

      if (!(await allowSignup(store, { ip }))) return { status: 'error', message: MESSAGES.tooManySignups }
      const mail = await claimMailRequest(store, { email, ip })
      if (mail === 'limit') return { status: 'error', message: MESSAGES.mailWait }
      // A double tap: the first request is already creating the account and sending the mail (EC-5).
      if (mail === 'duplicate') return { status: 'success' }

      const state = await accountState(admin, email)
      if (state === 'none') {
        const supabase = await createClient()
        const { error } = await supabase.auth.signUp({ email, password })
        // Whatever Supabase says, a parallel signup may have won the race (BUG-6): if the account
        // exists now, same answer as for any existing one. Only without an account is it an error.
        if (error && (await accountState(admin, email)) === 'none') throw error
      } else if (state === 'unconfirmed') {
        await resendConfirmationIfUnconfirmed(admin, email)
      }
      // 'confirmed': nothing happens, not even a mail (AC-6).
      return { status: 'success' }
    } catch (e) {
      logAuthError('register', e)
      return { status: 'error', message: MESSAGES.network }
    }
  })
}
