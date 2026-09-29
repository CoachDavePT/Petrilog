// Target of the links in confirmation and recovery mails (PROJ-1: AC-3, AC-17, AC-33, EC-1 – EC-4,
// EC-10). Checks the one-time token and always redirects to an address without it.
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createResetGrant, currentSessionId } from '@/lib/auth/reset-grant'
import { logAuthError } from '@/lib/auth/log'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** Supabase has one link lifetime (24 h); the recovery link is cut to 1 hour here (AC-17). */
const RECOVERY_LINK_MAX_AGE_MS = 60 * 60 * 1000
const ALLOWED_TYPES: EmailOtpType[] = ['email', 'recovery']

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null

  const to = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path.split('?')[0]
    url.search = path.includes('?') ? `?${path.split('?')[1]}` : ''
    return NextResponse.redirect(url)
  }
  const expired = to(`/auth/link-expired?type=${type === 'recovery' ? 'recovery' : 'signup'}`)

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return expired

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return expired

  if (type === 'recovery') {
    const sentAt = data.user?.recovery_sent_at ? Date.parse(data.user.recovery_sent_at) : NaN
    if (!Number.isFinite(sentAt) || Date.now() - sentAt > RECOVERY_LINK_MAX_AGE_MS) {
      await supabase.auth.signOut({ scope: 'local' })
      return expired
    }
    // The grant to set a new password, for exactly this new session (AC-33). Without it, no way in.
    try {
      const sessionId = await currentSessionId(supabase)
      if (!sessionId || !data.user) throw new Error('recovery link signed in without a session')
      await createResetGrant(createAdminClient(), data.user.id, sessionId)
    } catch (e) {
      logAuthError('confirm:reset-grant', e)
      await supabase.auth.signOut({ scope: 'local' })
      return expired
    }
    return to('/reset-password')
  }

  // Confirmation: signed in → start page; otherwise ask to log in (EC-4).
  return data.session ? to('/') : to('/login?notice=email-confirmed')
}
