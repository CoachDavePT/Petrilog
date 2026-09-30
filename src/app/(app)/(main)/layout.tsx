// Layout of the main pages `/` and `/account` (docs/app-shell.md → Rahmen-Bausteine; PROJ-2 design.md →
// Rahmen der App; AC-4, AC-5). Loads the running session once per request and places, after the page
// content, the ActiveSessionBar (only while a session runs) and the TabBar. Both bars are fixed and reserve
// their own height with an in-flow spacer (home indicator included), so they must follow the content.
// The content column (max. 440 px, 20 px gutter) and the large AppBar belong to each page, not to this
// layout. Sub-pages live outside `(main)` and therefore have neither bar.
import { ActiveSessionBar } from '@/components/shell/active-session-bar'
import { TabBar } from '@/components/shell/tab-bar'
import { requireUser } from '@/lib/auth/require-user'
import { getRunningSession } from '@/lib/fishing/queries'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // Layouts and pages render in parallel — this layout reads user data, so it checks the login itself
  // instead of relying on the parent layout (AC-33).
  await requireUser()
  const session = await getRunningSession()
  // Request time, so the server already renders the running time and SSR and hydration match.
  const serverNow = new Date().toISOString()

  return (
    <>
      {children}
      {session && <ActiveSessionBar session={session} serverNow={serverNow} />}
      <TabBar />
    </>
  )
}
