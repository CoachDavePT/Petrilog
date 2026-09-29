// One session in the overview (PROJ-2: AC-1, EC-8; design.md → Sessions-Übersicht). Server-compatible:
// no hooks, no browser APIs — the overview renders it on the server and again in the browser for
// „Weitere laden". Deliberately without coordinates: the list never shows positions.
import Link from 'next/link'
import { ChevronRight, Clock, Fish } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDate, formatDuration, formatNumber, formatTime } from '@/lib/fishing/format'
import type { SessionListItem } from '@/lib/fishing/queries'

/** „1 Fang" / „3 Fänge" / „0 Fänge". */
export function formatCatchCount(count: number): string {
  return count === 1 ? '1 Fang' : `${formatNumber(count)} Fänge`
}

/** Badge „Läuft" — status-active (Amber) with a dot (docs/design-system.md → Badge, Ton `live`). */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 gap-1.5 rounded-lg border-transparent bg-amber-100 px-2 text-xs font-semibold text-amber-700 dark:bg-amber-700 dark:text-sand-50',
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full bg-amber-500 dark:bg-amber-400" />
      Läuft
    </Badge>
  )
}

export type SessionCardProps = SessionListItem

export function SessionCard({ id, startedAt, endedAt, waterName, catchCount }: SessionCardProps) {
  return (
    <Link
      href={`/sessions/${id}`}
      className="group block rounded-[12px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      <Card className="flex min-h-[44px] items-center gap-3 rounded-[12px] border-0 p-4 transition-[box-shadow,background-color] duration-[120ms] ease-petrilog group-hover:shadow-md dark:shadow-none dark:group-hover:bg-moss-700">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[13px] font-medium text-muted-foreground">
            {/* EC-8: listed under its Berlin start date */}
            <time dateTime={startedAt}>
              {formatDate(startedAt)} · {formatTime(startedAt)}
            </time>
          </p>
          <p
            className={cn(
              'truncate text-[17px] font-semibold leading-tight',
              waterName ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {waterName ?? 'Ohne Gewässer'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            {endedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="size-4 text-ink-400 dark:text-sand-400" />
                <span className="sr-only">Dauer </span>
                {formatDuration(startedAt, endedAt)}
              </span>
            ) : (
              <LiveBadge />
            )}
            <span className="inline-flex items-center gap-1.5">
              <Fish aria-hidden className="size-4 text-ink-400 dark:text-sand-400" />
              {formatCatchCount(catchCount)}
            </span>
          </div>
        </div>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-400 dark:text-sand-400" />
      </Card>
    </Link>
  )
}
