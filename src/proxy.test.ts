// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The Supabase session is the external dependency: each test decides whether the cookie carries
// claims and whether Supabase still accepts the session behind it.
let claims: object | null = null
let userStillValid = true
const signOut = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: claims ? { claims } : null }),
      getUser: async () =>
        userStillValid
          ? { data: { user: { id: 'u1' } }, error: null }
          : { data: { user: null }, error: { message: 'session_not_found' } },
      signOut,
    },
  }),
}))

const { proxy } = await import('./proxy')

function visit(path: string) {
  return proxy(new NextRequest(`http://localhost:3553${path}`))
}

function redirectTarget(response: Response) {
  const location = response.headers.get('location')
  return location ? new URL(location).pathname + new URL(location).search : null
}

beforeEach(() => {
  claims = null
  userStillValid = true
  signOut.mockReset()
})

describe('proxy — logged out (AC-13)', () => {
  it('lets the public pages through', async () => {
    for (const path of ['/login', '/register', '/forgot-password', '/auth/confirm?token_hash=x&type=email', '/auth/link-expired', '/privacy']) {
      expect(redirectTarget(await visit(path)), path).toBeNull()
    }
  })

  it('sends every other address to /login, without carrying the query along', async () => {
    for (const path of ['/', '/account', '/account/export', '/reset-password', '/does-not-exist', '/account?x=1']) {
      expect(redirectTarget(await visit(path)), path).toBe('/login')
    }
  })

  it('does not treat look-alike paths as public', async () => {
    for (const path of ['/loginx', '/privacy-admin', '/registerfoo', '/auth/confirmed', '/auth']) {
      expect(redirectTarget(await visit(path)), path).toBe('/login')
    }
  })
})

describe('proxy — logged in (AC-11, AC-22, EC-9)', () => {
  beforeEach(() => {
    claims = { sub: 'u1' }
  })

  it('sends a logged-in visitor of the login pages to the start page', async () => {
    for (const path of ['/login', '/register', '/forgot-password']) {
      expect(redirectTarget(await visit(path)), path).toBe('/')
    }
  })

  it('lets protected pages through and forbids the browser to store them', async () => {
    for (const path of ['/', '/account', '/reset-password']) {
      const response = await visit(path)
      expect(redirectTarget(response), path).toBeNull()
      expect(response.headers.get('cache-control'), path).toBe('private, no-store')
    }
  })

  it('does not mark public pages as no-store', async () => {
    expect((await visit('/privacy')).headers.get('cache-control')).toBeNull()
  })

  it('clears a cookie whose session ended elsewhere instead of bouncing between /login and /', async () => {
    userStillValid = false
    const response = await visit('/login')
    expect(redirectTarget(response)).toBeNull()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
