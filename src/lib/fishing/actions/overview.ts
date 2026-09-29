'use server'

// "Weitere laden" on the sessions overview — PROJ-2 design.md → Sessions-Übersicht (AC-1, EC-12).
// Returns the next section of 20: id, dates, water name and catch count only, never positions.
// Re-checks the login with Supabase first (requireUser), like every protected action of PROJ-1.
import { requireUser } from '@/lib/auth/require-user'
import { MESSAGES } from '../messages'
import { listSessions, parseSessionCursor, type SessionPage } from '../queries'

export type LoadMoreResult = { status: 'ok'; page: SessionPage } | { status: 'error'; message: string }

/** The section after `before` (the previous section's `nextCursor`). */
export async function loadMoreSessions(before: string): Promise<LoadMoreResult> {
  await requireUser()

  const cursor = parseSessionCursor(before)
  if (!cursor) return { status: 'error', message: MESSAGES.invalidInput }

  try {
    return { status: 'ok', page: await listSessions({ before: cursor }) }
  } catch (e) {
    const err = e as { message?: string } | null
    console.error('[fishing] load-more-sessions failed:', err?.message ?? String(e))
    return { status: 'error', message: MESSAGES.network }
  }
}
