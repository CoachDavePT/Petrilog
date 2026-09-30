// „Session bearbeiten" incl. „Position entfernen" (PROJ-2: AC-17, AC-18, AC-38; design.md → Seiten und
// Adressen, Session nachtragen und bearbeiten). A sub-page: compact AppBar with close back to the
// detail view. Someone else's, deleted or malformed ids show „Diese Seite gibt es nicht." (AC-32).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppBar } from '@/components/shell/app-bar'
import { SessionEditForm } from '@/components/fishing/session-edit-form'
import { requireUser } from '@/lib/auth/require-user'
import { getSessionDetail, getWaterNameSuggestions } from '@/lib/fishing/queries'

export const metadata: Metadata = { title: 'Session bearbeiten · Petrilog' }

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  // Layout and page render in parallel — the page checks the login itself before reading data.
  await requireUser()
  const { id } = await params
  const [session, suggestions] = await Promise.all([getSessionDetail(id), getWaterNameSuggestions()])
  if (!session) notFound()

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar variant="compact" title="Session bearbeiten" nav={{ href: `/sessions/${session.id}`, kind: 'close' }} />
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4">
        <SessionEditForm
          session={{
            id: session.id,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            waterName: session.waterName,
            note: session.note,
            position: session.position,
          }}
          suggestions={suggestions}
        />
      </main>
    </div>
  )
}
