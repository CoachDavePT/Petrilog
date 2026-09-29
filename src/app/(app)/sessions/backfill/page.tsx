// „Session nachtragen" (PROJ-2: AC-13 – AC-16; design.md → Seiten und Adressen, Session nachtragen und
// bearbeiten). A sub-page: compact AppBar with close, no tab bar, no active-session bar.
import type { Metadata } from 'next'
import { AppBar } from '@/components/shell/app-bar'
import { SessionBackfillForm } from '@/components/fishing/session-backfill-form'
import { requireUser } from '@/lib/auth/require-user'
import { getWaterNameSuggestions } from '@/lib/fishing/queries'

export const metadata: Metadata = { title: 'Session nachtragen · Petrilog' }

export default async function BackfillSessionPage() {
  // Layout and page render in parallel — the page checks the login itself before reading data.
  await requireUser()
  const suggestions = await getWaterNameSuggestions()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar variant="compact" title="Session nachtragen" nav={{ href: '/', kind: 'close' }} />
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4">
        <SessionBackfillForm suggestions={suggestions} />
      </main>
    </div>
  )
}
