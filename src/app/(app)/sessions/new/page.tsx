// „Session starten" (PROJ-2: AC-6 – AC-9, AC-36, AC-37; design.md → Seiten und Adressen, Session
// starten). A sub-page: compact AppBar with close, no tab bar, no active-session bar. With a session
// already running there is nothing to start — straight to that session with the notice (AC-9).
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppBar } from '@/components/shell/app-bar'
import { SessionStartForm } from '@/components/fishing/session-start-form'
import { requireUser } from '@/lib/auth/require-user'
import { getRunningSession, getWaterNameSuggestions } from '@/lib/fishing/queries'

export const metadata: Metadata = { title: 'Session starten · Petrilog' }

export default async function NewSessionPage() {
  // Layout and page render in parallel — the page checks the login itself before reading data.
  await requireUser()
  const [running, suggestions] = await Promise.all([getRunningSession(), getWaterNameSuggestions()])
  if (running) redirect(`/sessions/${running.id}?notice=session-running`)

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar variant="compact" title="Session starten" nav={{ href: '/', kind: 'close' }} />
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4">
        <SessionStartForm suggestions={suggestions} />
      </main>
    </div>
  )
}
