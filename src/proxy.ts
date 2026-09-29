// Auth boundary (PROJ-1 design.md → Zugriffsschutz): refreshes the Supabase session on every
// request, sends logged-out visitors of non-public pages to /login and logged-in visitors of the
// login pages to /. The authoritative "is this session still valid?" check happens in the protected
// pages themselves (src/lib/auth/require-user.ts); here the cookie is enough, except on the login
// pages, where a stale session must be cleared instead of bouncing between /login and /.
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/** Reachable without login (AC-13). */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/auth/confirm', '/auth/link-expired', '/privacy']
/** Only for logged-out visitors — logged-in ones land on / (AC-11). */
const LOGGED_OUT_ONLY = ['/login', '/register', '/forgot-password']

const matches = (pathname: string, paths: string[]) =>
  paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { pathname } = request.nextUrl
  const { data } = await supabase.auth.getClaims() // refreshes an expired session, writes new cookies
  let loggedIn = Boolean(data?.claims)

  if (loggedIn && matches(pathname, LOGGED_OUT_ONLY)) {
    // The cookie may outlive a session ended elsewhere (EC-9): ask Supabase, and clear it if so.
    const { data: userData, error } = await supabase.auth.getUser()
    if (error || !userData.user) {
      await supabase.auth.signOut({ scope: 'local' })
      loggedIn = false
    }
  }

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (!loggedIn && !matches(pathname, PUBLIC_PATHS)) return redirectTo('/login')
  if (loggedIn && matches(pathname, LOGGED_OUT_ONLY)) return redirectTo('/')

  // Pages of the logged-in area are never stored by the browser (AC-22: back button after logout).
  if (!matches(pathname, PUBLIC_PATHS)) response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
