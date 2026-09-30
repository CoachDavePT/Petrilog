// Detail view of a session (PROJ-2: AC-10, AC-11, AC-19, AC-29 – AC-32, EC-6, EC-7, EC-8; design.md →
// Seiten und Adressen, Komponenten-Struktur, Session beenden, Detailansicht und Kennzahl). A sub-page:
// compact AppBar with back and a menu (Bearbeiten, Session löschen), no tab bar, no active-session bar.
// Someone else's, deleted or malformed ids show „Diese Seite gibt es nicht." — the answer never reveals
// whether the id exists (AC-32). `?end=1` opens „Session beenden" right away (from the 12-hour hint in
// the active-session bar); `?notice=` carries a short code only (success → toast, others in the content).
// PROJ-3 (design.md → Komponenten-Struktur): „Wetter beim Start" before „Fänge", filled once after loading
// when the session or a catch still needs weather; catches without weather carry a small marker.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, MapPinOff, TriangleAlert } from 'lucide-react'
import { FormNotice } from '@/components/auth/form-notice'
import { CatchCard } from '@/components/fishing/catch-card'
import { EndSessionSheet } from '@/components/fishing/end-session-sheet'
import { LiveBadge } from '@/components/fishing/session-card'
import { SessionDetailMenu } from '@/components/fishing/session-detail-menu'
import { SessionStats } from '@/components/fishing/session-stats'
import { NoticeToast } from '@/components/notice-toast'
import { AppBar } from '@/components/shell/app-bar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { requireUser } from '@/lib/auth/require-user'
import {
  formatAccuracy,
  formatCoordinates,
  formatDate,
  formatDuration,
  formatEndLabel,
  formatTime,
  isLongRunning,
} from '@/lib/fishing/format'
import { MESSAGES, noticeFor } from '@/lib/fishing/messages'
import { getSessionDetail } from '@/lib/fishing/queries'
import { RetryWeatherButton } from '@/components/weather/retry-weather-button'
import { WeatherAutoFill } from '@/components/weather/weather-auto-fill'
import { WeatherSection } from '@/components/weather/weather-section'
import { needsAutoFill } from '@/lib/weather/format'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'

export const metadata: Metadata = { title: 'Session · Petrilog' }

type SessionDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** The server's clock for this render — passed on so time-dependent client parts start from it. */
function serverClock(): Date {
  return new Date()
}

export default async function SessionDetailPage({ params, searchParams }: SessionDetailPageProps) {
  // Layout and page render in parallel — the page checks the login itself before reading data.
  await requireUser()
  const [{ id }, query] = await Promise.all([params, searchParams])
  const session = await getSessionDetail(id)
  if (!session) notFound()

  const now = serverClock()
  const serverNow = now.toISOString()
  const running = session.endedAt === null
  const catchCount = session.catches.length
  // catches come ordered by catch time, so the last one is the latest (AC-12, EC-6)
  const lastCatchAt = catchCount > 0 ? session.catches[catchCount - 1].caughtAt : null
  const duration = formatDuration(session.startedAt, session.endedAt ?? now)
  const longRunning = isLongRunning(session.startedAt, session.endedAt, now)

  const notice = noticeFor(query.notice, { duration: session.endedAt ? duration : undefined })
  const toastMessage = notice?.tone === 'success' ? notice.text : null
  const inlineNotice = notice && notice.tone !== 'success' ? notice : null
  const openEndSheet = running && query.end === '1'

  const catchHref = `/sessions/${session.id}/catches/new`
  const sheetSession = { id: session.id, startedAt: session.startedAt }

  // PROJ-3: fetch missing weather of the session and its catches once after the page loaded (AC-9)
  const weatherNeeded = [session.weatherState, ...session.catches.map((c) => c.weatherState)].some((state) =>
    needsAutoFill(state, now),
  )
  const weatherSection = (pendingFailed: boolean) => (
    <WeatherSection
      heading={WEATHER_MESSAGES.sessionHeading}
      weather={session.weather}
      referenceTime={session.startedAt}
      retry={<RetryWeatherButton sessionId={session.id} />}
      pendingFailed={pendingFailed}
    />
  )

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar
        variant="compact"
        title={session.waterName ?? 'Session'}
        nav={{ href: '/', kind: 'back' }}
        action={<SessionDetailMenu id={session.id} catchCount={catchCount} />}
      />
      <NoticeToast message={toastMessage} />

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-5 px-5 pt-4">
        {inlineNotice && <FormNotice tone={inlineNotice.tone}>{inlineNotice.text}</FormNotice>}

        {/* Kopf: Datum, Start – Ende bzw. „Läuft", Dauer (EC-8: Berlin dates, end with date after midnight) */}
        <section aria-label="Zeit" className="flex flex-col gap-1">
          <p className="text-[13px] font-medium text-muted-foreground">
            <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[17px] font-semibold tabular-nums text-foreground">
              {session.endedAt ? (
                <>
                  {formatTime(session.startedAt)} {formatEndLabel(session.startedAt, session.endedAt)}
                </>
              ) : (
                <>seit {formatTime(session.startedAt)}</>
              )}
            </p>
            {running && <LiveBadge />}
          </div>
          <p className="text-[15px] tabular-nums text-foreground/85">
            <span className="sr-only">Dauer </span>
            {duration}
          </p>
        </section>

        {/* AC-11: from 12 h on, the same hint as in the active-session bar, with „Beenden" */}
        {longRunning && (
          <Alert variant="warning" role="status" className="flex items-center gap-3">
            {/* wrapped, so the Alert's absolute-icon layout does not apply to this row */}
            <span aria-hidden className="shrink-0">
              <TriangleAlert className="size-5" />
            </span>
            <AlertDescription className="min-w-0 flex-1 text-[13px] leading-snug">{MESSAGES.runningLong}</AlertDescription>
            <EndSessionSheet
              session={sheetSession}
              lastCatchAt={lastCatchAt}
              serverNow={serverNow}
              trigger={
                <Button type="button" variant="outline" className="shrink-0 bg-transparent" aria-label="Session beenden">
                  Beenden
                </Button>
              }
            />
          </Alert>
        )}

        <SessionStats
          startedAt={session.startedAt}
          endedAt={session.endedAt}
          catchCount={catchCount}
          serverNow={serverNow}
        />

        {/* Position (EC-7): coordinates in mono + accuracy, or „Ohne Position" */}
        <section aria-label="Position" className="flex flex-col gap-2">
          {session.position ? (
            <div className="flex items-start gap-2">
              <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-400 dark:text-sand-400" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[15px] leading-[1.25] text-foreground">
                  {formatCoordinates(session.position.latitude, session.position.longitude)}
                </span>
                <span className="text-[13px] text-muted-foreground">{formatAccuracy(session.position.accuracy)}</span>
              </div>
            </div>
          ) : (
            <>
              <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <MapPinOff aria-hidden className="size-4 shrink-0 text-ink-400 dark:text-sand-400" />
                Ohne Position
              </p>
              {/* AC-8: a running session started without a position says so */}
              {running && <FormNotice tone="info">{MESSAGES.positionMissing}</FormNotice>}
            </>
          )}
        </section>

        {session.note && (
          <section aria-labelledby="session-note" className="flex flex-col gap-1">
            <h2 id="session-note" className="text-[13px] font-medium text-muted-foreground">
              Notiz
            </h2>
            <p className="whitespace-pre-line break-words text-[15px] text-foreground">{session.note}</p>
          </section>
        )}

        {/* PROJ-3: „Wetter beim Start" (AC-14, AC-16), filled automatically after loading (AC-6, AC-9) */}
        <WeatherAutoFill sessionId={session.id} needed={weatherNeeded} fallback={weatherSection(true)}>
          {weatherSection(false)}
        </WeatherAutoFill>

        {/* Fänge nach Uhrzeit, älteste zuerst (AC-29) — or the empty state (AC-31) */}
        <section aria-labelledby="session-catches" className="flex flex-col gap-3">
          <h2 id="session-catches" className="text-[20px] font-medium leading-tight text-foreground">
            Fänge
          </h2>
          {catchCount > 0 ? (
            <ul className="flex flex-col gap-3">
              {session.catches.map((entry) => (
                <li key={entry.id}>
                  <CatchCard sessionId={session.id} catch={entry} sessionStartedAt={session.startedAt} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[12px] bg-card p-4 text-[15px] text-muted-foreground shadow-sm dark:shadow-none">
              {MESSAGES.noCatches}
            </p>
          )}
        </section>

        {/* Hauptaktion unten im Daumenbereich; „Session beenden" als Zweitaktion (nur laufend) */}
        <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85">
          <Link href={catchHref} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
            {running ? 'Fang eintragen' : 'Fang nachtragen'}
          </Link>
          {running && (
            <EndSessionSheet
              session={sheetSession}
              lastCatchAt={lastCatchAt}
              serverNow={serverNow}
              defaultOpen={openEndSheet}
            />
          )}
        </div>
      </main>
    </div>
  )
}
