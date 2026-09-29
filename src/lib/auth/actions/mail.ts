'use server'

// Mail requests (PROJ-1: AC-2, AC-9, AC-16, AC-25, EC-1, EC-2): "Mail erneut senden",
// "Passwort vergessen" and "Neue Mail anfordern". Every answer is the same whether or not an
// account exists; the mail limit counts either way.
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { clientIp } from '../client-ip'
import { resendConfirmationIfUnconfirmed } from '../confirmation-mail'
import { MESSAGES } from '../messages'
import { atLeast } from '../min-duration'
import { emailOnlySchema, fieldErrors, type ActionState, type EmailOnlyInput } from '../schemas'
import { allowMailRequest, supabaseThrottleStore } from '../throttle'

type MailKind = 'confirmation' | 'recovery'

async function requestMail(input: EmailOnlyInput, kind: MailKind, sentMessage: string): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(input)
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrors(parsed.error) }
  const { email } = parsed.data

  return atLeast(async (): Promise<ActionState> => {
    try {
      const ip = clientIp(await headers())
      const admin = createAdminClient()
      if (!(await allowMailRequest(supabaseThrottleStore(admin), { email, ip }))) {
        return { status: 'error', message: MESSAGES.mailWait }
      }
      if (kind === 'confirmation') {
        await resendConfirmationIfUnconfirmed(admin, email)
      } else {
        // Supabase sends only if the account exists and answers the same either way.
        const supabase = await createClient()
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error && error.status !== 429) throw error
      }
      return { status: 'success', message: sentMessage }
    } catch {
      return { status: 'error', message: MESSAGES.network }
    }
  })
}

/** From "Prüfe dein Postfach" and the unconfirmed-login hint. */
export async function resendConfirmation(input: EmailOnlyInput): Promise<ActionState> {
  return requestMail(input, 'confirmation', MESSAGES.mailResent)
}

/** /forgot-password (AC-16). */
export async function requestPasswordReset(input: EmailOnlyInput): Promise<ActionState> {
  return requestMail(input, 'recovery', MESSAGES.resetLinkSent)
}

/** /auth/link-expired: a fresh confirmation or recovery mail (EC-1, EC-2). */
export async function requestNewLink(input: EmailOnlyInput & { type: 'signup' | 'recovery' }): Promise<ActionState> {
  const kind: MailKind = input.type === 'recovery' ? 'recovery' : 'confirmation'
  return requestMail({ email: input.email }, kind, MESSAGES.newLinkSent)
}
