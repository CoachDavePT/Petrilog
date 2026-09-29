// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyOtp = vi.fn()
const signOut = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp, signOut } }),
}))

const { GET } = await import('./route')

const HOUR = 60 * 60 * 1000

function call(query: string) {
  return GET(new NextRequest(`http://localhost:3553/auth/confirm${query}`))
}

function target(response: Response) {
  const url = new URL(response.headers.get('location')!)
  return url.pathname + url.search
}

beforeEach(() => {
  verifyOtp.mockReset()
  signOut.mockReset()
})

describe('/auth/confirm — rejected links (EC-1, EC-2)', () => {
  it('sends a link without token or with a foreign type to the expiry page without asking Supabase', async () => {
    expect(target(await call('?type=email'))).toBe('/auth/link-expired?type=signup')
    expect(target(await call('?token_hash=abc&type=magiclink'))).toBe('/auth/link-expired?type=signup')
    expect(target(await call('?token_hash=abc&type=signup'))).toBe('/auth/link-expired?type=signup')
    expect(target(await call('?token_hash=abc'))).toBe('/auth/link-expired?type=signup')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('keeps the link type on the expiry page when Supabase rejects the token', async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: { message: 'expired' } })
    expect(target(await call('?token_hash=abc&type=email'))).toBe('/auth/link-expired?type=signup')
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/auth/link-expired?type=recovery')
  })
})

describe('/auth/confirm — confirmation link (AC-3, EC-4)', () => {
  it('lands on the start page when the confirmation signs the user in', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 't' }, user: {} }, error: null })
    const response = await call('?token_hash=abc&type=email')
    expect(target(response)).toBe('/')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'abc' })
  })

  it('asks to log in when no session came out of it', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
    expect(target(await call('?token_hash=abc&type=email'))).toBe('/login?notice=email-confirmed')
  })
})

describe('/auth/confirm — recovery link, cut to 1 hour (AC-17)', () => {
  it('opens /reset-password when the mail is younger than 1 hour', async () => {
    const sentAt = new Date(Date.now() - 59 * 60 * 1000).toISOString()
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { recovery_sent_at: sentAt } }, error: null })
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/reset-password')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs the user out again and shows the expiry page when the mail is older than 1 hour', async () => {
    const sentAt = new Date(Date.now() - HOUR - 60 * 1000).toISOString()
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { recovery_sent_at: sentAt } }, error: null })
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/auth/link-expired?type=recovery')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('treats a missing send time as expired', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/auth/link-expired?type=recovery')
    expect(signOut).toHaveBeenCalled()
  })
})

describe('/auth/confirm — the token never survives the redirect', () => {
  it('drops token_hash from every target', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: {} }, error: null })
    for (const query of ['?token_hash=secret&type=email', '?token_hash=secret&type=recovery', '?token_hash=secret&type=x']) {
      expect(target(await call(query))).not.toContain('secret')
    }
  })
})
