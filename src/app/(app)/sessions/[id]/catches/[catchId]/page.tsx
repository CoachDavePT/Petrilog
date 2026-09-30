// „Fang bearbeiten“ — PROJ-2 design.md → Seiten und Adressen, Komponenten-Struktur, Fang eintragen,
// nachtragen, bearbeiten · Position entfernen (AC-27, AC-28, AC-32, AC-38).
// A sub-page: compact AppBar with close back to the session and „Fang löschen“ on the right, no TabBar,
// no ActiveSessionBar. An unknown, foreign or deleted catch — or one that belongs to a different session
// than the address says — shows „Diese Seite gibt es nicht.“ without telling which (AC-32).
// PROJ-3 (AC-15, AC-16): „Wetter beim Fang“ above the form, filled once after loading when it is missing.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatchForm } from '@/components/fishing/catch-form'
import { DeleteCatchDialog } from '@/components/fishing/delete-catch-dialog'
import { AppBar } from '@/components/shell/app-bar'
import { RetryWeatherButton } from '@/components/weather/retry-weather-button'
import { WeatherAutoFill } from '@/components/weather/weather-auto-fill'
import { WeatherSection } from '@/components/weather/weather-section'
import { requireUser } from '@/lib/auth/require-user'
import { getCatch, getRecentSpecies } from '@/lib/fishing/queries'
import { needsAutoFill } from '@/lib/weather/format'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'

export const metadata: Metadata = { title: 'Fang bearbeiten · Petrilog' }

/** The server's clock for this render — decides whether the weather still needs fetching. */
function serverClock(): Date {
  return new Date()
}

export default async function EditCatchPage({ params }: { params: Promise<{ id: string; catchId: string }> }) {
  // Layouts and pages render in parallel — the page checks the login itself before reading data.
  await requireUser()
  const { id, catchId } = await params

  const [found, recentSpecies] = await Promise.all([getCatch(catchId), getRecentSpecies()])
  if (!found || found.session.id !== id) notFound()

  const { catch: entry, session, weather } = found
  const weatherSection = (pendingFailed: boolean) => (
    <WeatherSection
      heading={WEATHER_MESSAGES.catchHeading}
      weather={weather}
      referenceTime={entry.caughtAt}
      retry={<RetryWeatherButton sessionId={session.id} />}
      pendingFailed={pendingFailed}
    />
  )

  return (
    <>
      <AppBar
        variant="compact"
        title="Fang bearbeiten"
        nav={{ href: `/sessions/${session.id}`, kind: 'close' }}
        action={<DeleteCatchDialog catchId={entry.id} sessionId={found.session.id} />}
      />
      <main className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-4">
        <WeatherAutoFill
          sessionId={session.id}
          needed={needsAutoFill(entry.weatherState, serverClock())}
          fallback={weatherSection(true)}
        >
          {weatherSection(false)}
        </WeatherAutoFill>
        <CatchForm
          mode="edit"
          session={{ id: session.id, startedAt: session.startedAt, endedAt: session.endedAt }}
          recentSpecies={recentSpecies}
          catch={entry}
        />
      </main>
    </>
  )
}
