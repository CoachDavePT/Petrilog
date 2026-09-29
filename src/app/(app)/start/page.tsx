// `/start` is no page but the action behind the „Start" tab (docs/app-shell.md → Hauptbereiche; AC-3):
// with a running session to its detail view, otherwise to „Session starten". The answer depends on the
// moment, so it is never cached: the login check reads the cookies, which already makes every request
// dynamic, and `force-dynamic` states it explicitly. The TabBar does not prefetch this link.
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { getRunningSession } from '@/lib/fishing/queries'

export const dynamic = 'force-dynamic'

export default async function StartPage() {
  await requireUser()
  const session = await getRunningSession()
  redirect(session ? `/sessions/${session.id}` : '/sessions/new')
}
