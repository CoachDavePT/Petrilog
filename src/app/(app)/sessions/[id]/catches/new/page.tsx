// „Fang eintragen“ (running session) / „Fang nachtragen“ (ended session) — PROJ-2 design.md → Seiten und
// Adressen, Komponenten-Struktur, Fang eintragen, nachtragen, bearbeiten (AC-20 – AC-26, AC-32).
// A sub-page: compact AppBar with close back to the session, no TabBar, no ActiveSessionBar. An unknown,
// foreign or deleted session id shows „Diese Seite gibt es nicht.“ without telling which (AC-32).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatchForm } from '@/components/fishing/catch-form'
import { AppBar } from '@/components/shell/app-bar'
import { requireUser } from '@/lib/auth/require-user'
import { getCatchPrefill, getRecentSpecies, getSessionDetail } from '@/lib/fishing/queries'

export const metadata: Metadata = { title: 'Fang · Petrilog' }

const MINUTE_MS = 60_000

/** The server's current minute as an ISO timestamp (seconds = 0) — the default catch time. */
function currentMinuteIso(): string {
  return new Date(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS).toISOString()
}

export default async function NewCatchPage({ params }: { params: Promise<{ id: string }> }) {
  // Layouts and pages render in parallel — the page checks the login itself before reading data.
  await requireUser()
  const { id } = await params

  const [session, recentSpecies, prefill] = await Promise.all([
    getSessionDetail(id),
    getRecentSpecies(),
    getCatchPrefill(id),
  ])
  if (!session) notFound()

  const running = session.endedAt === null
  // Running session: the catch time defaults to the minute the page was loaded (server time).
  const initialNow = running ? currentMinuteIso() : undefined

  return (
    <>
      <AppBar
        variant="compact"
        title={running ? 'Fang eintragen' : 'Fang nachtragen'}
        nav={{ href: `/sessions/${session.id}`, kind: 'close' }}
      />
      <main className="mx-auto w-full max-w-[440px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-4">
        <CatchForm
          mode="create"
          session={{ id: session.id, startedAt: session.startedAt, endedAt: session.endedAt }}
          recentSpecies={recentSpecies}
          prefill={prefill}
          initialNow={initialNow}
        />
      </main>
    </>
  )
}
