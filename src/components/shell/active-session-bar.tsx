'use client'
// The floating bar of the running session on main pages (docs/app-shell.md → Layout-Bereiche;
// PROJ-2 AC-4, AC-11). Water name or „Ohne Gewässer", running time, catch count and the Amber shortcut
// „Fang eintragen". Tapping the rest opens the detail view. From 12 h on it asks „Vergessen zu beenden?"
// with „Beenden" → /sessions/<id>?end=1 (the detail page opens its end sheet for `end=1`).
// The running time follows the client clock and ticks once a minute; start values come from the server.
// No coordinates here. Renders an in-flow spacer of its own height (see ACTIVE_SESSION_BAR_*).
import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { Plus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration, isLongRunning } from '@/lib/fishing/format'
import { MESSAGES } from '@/lib/fishing/messages'
import type { RunningSession } from '@/lib/fishing/queries'
import { cn } from '@/lib/utils'

/** Height of the bar's main row. */
export const ACTIVE_SESSION_BAR_HEIGHT_PX = 64
/** Extra height of the „Vergessen zu beenden?" row from 12 h on. */
export const ACTIVE_SESSION_BAR_HINT_HEIGHT_PX = 56
/** Gap between the bar and the tab bar below it (and between content and bar). */
export const ACTIVE_SESSION_BAR_GAP_PX = 8

const MINUTE_MS = 60_000

const floorToMinute = (ms: number) => Math.floor(ms / MINUTE_MS) * MINUTE_MS

/** The current minute. Stable within a minute, so React re-renders only when the minute changes. */
function getMinute(): number {
  return floorToMinute(Date.now())
}

/**
 * Notifies at every full minute of the clock — start times are stored to the minute (seconds = 0), so
 * that is exactly when the shown duration changes — and when the page becomes visible again (a phone
 * waking up throttles timers).
 */
function subscribeToMinute(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>
  const schedule = () => {
    timer = setTimeout(() => {
      onChange()
      schedule()
    }, MINUTE_MS - (Date.now() % MINUTE_MS))
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  schedule()
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

function catchCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'Fang' : 'Fänge'}`
}

export type ActiveSessionBarProps = {
  /** The running session, as `getRunningSession()` returns it. */
  session: RunningSession
  /**
   * Time of the request on the server (ISO). With it the server already renders the running time and the
   * 12-h hint, and hydration matches; the client then switches to its own clock. Without it, both appear
   * right after mount.
   */
  serverNow?: string
}

export function ActiveSessionBar({ session, serverNow }: ActiveSessionBarProps) {
  const serverMs = serverNow === undefined ? NaN : Date.parse(serverNow)
  const serverMinute = Number.isFinite(serverMs) ? floorToMinute(serverMs) : null
  const nowMs = useSyncExternalStore<number | null>(subscribeToMinute, getMinute, () => serverMinute)

  const now = nowMs === null ? null : new Date(nowMs)
  const longRunning = now !== null && isLongRunning(session.startedAt, null, now)
  const detailHref = `/sessions/${session.id}`

  return (
    <>
      {/* Keeps the end of the content above the floating bar. The TabBar reserves its own height. */}
      <div aria-hidden className={cn('shrink-0', longRunning ? 'h-[136px]' : 'h-20')} />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 px-3">
        <section
          aria-label="Laufende Session"
          className="paper-texture pointer-events-auto mx-auto max-w-[416px] overflow-hidden rounded-xl bg-moss-800 text-sand-50 shadow-lg dark:bg-moss-700"
        >
          {longRunning && (
            <div className="flex h-14 items-center gap-2 border-b border-sand-50/15 pl-4 pr-2">
              <TriangleAlert className="hidden size-5 shrink-0 text-amber-400 min-[360px]:block" aria-hidden />
              <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight">{MESSAGES.runningLong}</p>
              <Button
                asChild
                variant="ghost"
                className="shrink-0 border border-sand-50/40 px-3 text-sand-50 hover:bg-sand-50/10 hover:text-sand-50 focus-visible:ring-lake-300"
              >
                <Link href={`${detailHref}?end=1`} aria-label="Session beenden">
                  Beenden
                </Link>
              </Button>
            </div>
          )}
          <div className="flex h-16 items-stretch gap-2 py-2 pl-1 pr-2">
            <Link
              href={detailHref}
              className="flex min-w-0 flex-1 flex-col justify-center rounded-lg px-3 transition-colors duration-[120ms] hover:bg-sand-50/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-lake-300"
            >
              <span className="flex items-center gap-2 text-[15px] font-semibold leading-tight">
                <span className="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                <span className="truncate">{session.waterName ?? 'Ohne Gewässer'}</span>
              </span>
              <span className="mt-1 text-[13px] leading-tight text-sand-200 tabular-nums">
                {now === null ? (
                  // Same width as a real value, so nothing jumps when the time appears after mount.
                  <span className="invisible">0:00 h</span>
                ) : (
                  <span>{formatDuration(session.startedAt, now)}</span>
                )}
                {' · '}
                {catchCountLabel(session.catchCount)}
              </span>
            </Link>
            <Button asChild className="shrink-0 self-center focus-visible:ring-lake-300">
              <Link href={`${detailHref}/catches/new`}>
                <Plus aria-hidden />
                Fang eintragen
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
