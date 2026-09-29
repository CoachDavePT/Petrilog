// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createResetGrant, currentSessionId, removeResetGrant, resetGrantState } = await import('./reset-grant')

const NOW = new Date('2026-09-29T10:00:00Z')
const grant = (session_id: unknown, expires_at: unknown) => ({ app_metadata: { password_reset: { session_id, expires_at } } })

function adminMock(error: unknown = null) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error })
  return { admin: { auth: { admin: { updateUserById } } } as unknown as SupabaseClient, updateUserById }
}

describe('resetGrantState (AC-33, EC-13)', () => {
  it('is valid for the same session before the 15 minutes are up', () => {
    expect(resetGrantState(grant('s1', '2026-09-29T10:14:59Z'), 's1', NOW)).toBe('valid')
  })

  it('is expired for the same session once the 15 minutes are up', () => {
    expect(resetGrantState(grant('s1', '2026-09-29T10:00:00Z'), 's1', NOW)).toBe('expired')
    expect(resetGrantState(grant('s1', '2026-09-29T09:50:00Z'), 's1', NOW)).toBe('expired')
    expect(resetGrantState(grant('s1', 'kaputt'), 's1', NOW)).toBe('expired')
  })

  it('is none without a grant, for another session, or without a verified session', () => {
    expect(resetGrantState({ app_metadata: {} }, 's1', NOW)).toBe('none')
    expect(resetGrantState({ app_metadata: { password_reset: null } }, 's1', NOW)).toBe('none')
    expect(resetGrantState(grant('s1', '2026-09-29T10:10:00Z'), 's2', NOW)).toBe('none')
    expect(resetGrantState(grant('s1', '2026-09-29T10:10:00Z'), null, NOW)).toBe('none')
    expect(resetGrantState(grant(null, '2026-09-29T10:10:00Z'), '', NOW)).toBe('none')
  })
})

describe('createResetGrant / removeResetGrant', () => {
  it('writes the session and an expiry 15 minutes ahead into app_metadata', async () => {
    const { admin, updateUserById } = adminMock()
    await createResetGrant(admin, 'user-1', 'session-1', NOW)
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: { password_reset: { session_id: 'session-1', expires_at: '2026-09-29T10:15:00.000Z' } },
    })
  })

  it('removes the grant by setting it to null', async () => {
    const { admin, updateUserById } = adminMock()
    await removeResetGrant(admin, 'user-1')
    expect(updateUserById).toHaveBeenCalledWith('user-1', { app_metadata: { password_reset: null } })
  })

  it('throws when Supabase refuses, so no caller goes on without a grant', async () => {
    await expect(createResetGrant(adminMock({ message: 'down' }).admin, 'u', 's', NOW)).rejects.toEqual({ message: 'down' })
    await expect(removeResetGrant(adminMock({ message: 'down' }).admin, 'u')).rejects.toEqual({ message: 'down' })
  })
})

describe('currentSessionId', () => {
  const client = (result: unknown) => ({ auth: { getClaims: vi.fn().mockResolvedValue(result) } }) as unknown as SupabaseClient

  it('reads session_id from the verified claims', async () => {
    expect(await currentSessionId(client({ data: { claims: { session_id: 'abc' } }, error: null }))).toBe('abc')
  })

  it('returns null when the token cannot be verified or has no session id', async () => {
    expect(await currentSessionId(client({ data: null, error: { message: 'invalid' } }))).toBeNull()
    expect(await currentSessionId(client({ data: { claims: {} }, error: null }))).toBeNull()
    expect(await currentSessionId(client({ data: { claims: { session_id: 42 } }, error: null }))).toBeNull()
  })
})
