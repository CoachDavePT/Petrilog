'use server'

// Login and logout (PROJ-1: AC-7 – AC-9, AC-22 – AC-24). POST by design (Server Actions).
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logAuthError } from '../log'
import { MESSAGES, tooManyAttempts } from '../messages'
import { atLeast } from '../min-duration'
import { checkPassword, type PasswordCheck } from '../password-check'
import { fieldErrors, loginSchema, type ActionState, type LoginInput } from '../schemas'

export async function login(input: LoginInput): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', fieldErrors: fieldErrors(parsed.error) }
  const { email, password } = parsed.data

  const check = await atLeast<PasswordCheck | 'network'>(() =>
    checkPassword(email, password).catch((e) => {
      logAuthError('login', e)
      return 'network' as const
    }),
  )

  if (check === 'network') return { status: 'error', message: MESSAGES.network }
  switch (check.result) {
    case 'wrong':
      return { status: 'error', message: MESSAGES.invalidCredentials }
    case 'locked':
      return { status: 'error', message: tooManyAttempts(check.minutes) }
    case 'unconfirmed':
      return { status: 'error', message: MESSAGES.emailNotConfirmed, unconfirmed: true }
    case 'ok':
      revalidatePath('/', 'layout')
      redirect('/')
  }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  revalidatePath('/', 'layout')
  redirect('/login')
}
