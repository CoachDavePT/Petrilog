// The authoritative login check for protected pages and endpoints (PROJ-1 design.md): asks Supabase
// whether the session is still valid rather than trusting the cookie alone, so a session ended on
// another device — password reset or changed, account deleted — is noticed on the next page (EC-9).
import 'server-only'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (!error && data.user) return data.user

  const cookieStore = await cookies()
  const hadSession = cookieStore.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  redirect(hadSession ? '/login?notice=session-ended' : '/login')
}
