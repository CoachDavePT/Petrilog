// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyOtp = vi.fn()
const signOut = vi.fn()
const getClaims = vi.fn()
const updateUserById = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp, signOut, getClaims } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { updateUserById } } }),
}))
vi.spyOn(console, 'error').mockImplementation(() => undefined)

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
  getClaims.mockReset().mockResolvedValue({ data: { claims: { session_id: 'sess-1' } }, error: null })
  updateUserById.mockReset().mockResolvedValue({ data: {}, error: null })
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
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: 'u1', recovery_sent_at: sentAt } }, error: null })
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

describe('/auth/confirm — grant to set a new password (AC-33)', () => {
  const recent = () => new Date(Date.now() - 5 * 60 * 1000).toISOString()

  it('creates the grant for the session the link just signed in, 15 minutes ahead', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: 'u1', recovery_sent_at: recent() } }, error: null })
    const before = Date.now()
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/reset-password')
    expect(updateUserById).toHaveBeenCalledTimes(1)
    const [userId, attrs] = updateUserById.mock.calls[0]
    expect(userId).toBe('u1')
    expect(attrs.app_metadata.password_reset.session_id).toBe('sess-1')
    const expires = Date.parse(attrs.app_metadata.password_reset.expires_at)
    expect(expires - before).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000)
    expect(expires - before).toBeLessThanOrEqual(15 * 60 * 1000 + 1000)
  })

  it('signs out and shows the expiry page when the grant cannot be saved', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: 'u1', recovery_sent_at: recent() } }, error: null })
    updateUserById.mockResolvedValue({ data: null, error: { message: 'down' } })
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/auth/link-expired?type=recovery')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('signs out when the new session cannot be verified', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: 'u1', recovery_sent_at: recent() } }, error: null })
    getClaims.mockResolvedValue({ data: null, error: { message: 'invalid' } })
    expect(target(await call('?token_hash=abc&type=recovery'))).toBe('/auth/link-expired?type=recovery')
    expect(updateUserById).not.toHaveBeenCalled()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('creates no grant for a confirmation link or an expired recovery link', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: 'u1' } }, error: null })
    await call('?token_hash=abc&type=email')
    const old = new Date(Date.now() - 2 * HOUR).toISOString()
    verifyOtp.mockResolvedValue({ data: { session: {}, user: { id: 'u1', recovery_sent_at: old } }, error: null })
    await call('?token_hash=abc&type=recovery')
    expect(updateUserById).not.toHaveBeenCalled()
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
