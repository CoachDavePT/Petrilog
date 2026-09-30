// One catch in the session detail view (PROJ-2: AC-29, EC-7; design.md → Komponenten-Struktur,
// Detailansicht). Server-compatible: no hooks, no browser APIs. A tap opens „Fang bearbeiten".
// PROJ-3 (AC-17): a small cloud-off symbol next to the species when the catch has no weather; the page
// passes its clock (`now`).
import Link from 'next/link'
import { ChevronRight, MapPin, MapPinOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatAccuracy, formatCoordinates, formatEndTime, formatLength, formatTime, formatWeight } from '@/lib/fishing/format'
import type { CatchDetail, PositionSource } from '@/lib/fishing/queries'
import { catchSpeciesName } from '@/lib/fishing/species'
import { NoWeatherMarker } from '@/components/weather/no-weather-marker'
import { isWithoutWeather } from '@/lib/weather/format'

/** Badge „Zurückgesetzt" (status-released, Moss) / „Entnommen" (status-kept, Lake). */
export function CatchStatusBadge({ released, className }: { released: boolean; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 rounded-lg border-transparent px-2 text-xs font-semibold',
        released
          ? 'bg-moss-100 text-moss-700 dark:bg-moss-700 dark:text-moss-200'
          : 'bg-lake-100 text-lake-700 dark:bg-lake-800 dark:text-lake-300',
        className,
      )}
    >
      {released ? 'Zurückgesetzt' : 'Entnommen'}
    </Badge>
  )
}

const SOURCE_LABELS: Record<Exclude<PositionSource, 'none'>, string> = {
  gps: 'GPS',
  session: 'von der Session',
}

export type CatchCardProps = {
  sessionId: string
  catch: CatchDetail
  /**
   * Start of the session. When given and the catch falls on a later Berlin day (a session over
   * midnight), the time carries the date: „13.09., 02:10".
   */
  sessionStartedAt?: string
  /** The clock for „ohne Wetter" — a pending fetch younger than 5 minutes shows no marker (AC-17). */
  now: Date
}

export function CatchCard({ sessionId, catch: entry, sessionStartedAt, now }: CatchCardProps) {
  const time = sessionStartedAt ? formatEndTime(sessionStartedAt, entry.caughtAt) : formatTime(entry.caughtAt)
  const species = catchSpeciesName({ species: entry.species, species_other: entry.speciesOther })
  const details = [
    formatLength(entry.lengthCm),
    entry.weightG !== null ? formatWeight(entry.weightG) : null,
    entry.bait,
  ].filter((part): part is string => Boolean(part))
  const position = entry.positionSource !== 'none' ? entry.position : null

  return (
    <Link
      href={`/sessions/${sessionId}/catches/${entry.id}`}
      className="group block rounded-[12px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
    >
      <Card className="flex items-start gap-3 rounded-[12px] border-0 p-4 transition-[box-shadow,background-color] duration-[120ms] ease-petrilog group-hover:shadow-md dark:shadow-none dark:group-hover:bg-moss-700">
        <time dateTime={entry.caughtAt} className="w-14 shrink-0 pt-0.5 text-[13px] font-medium tabular-nums text-muted-foreground">
          {time}
        </time>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-[17px] font-semibold leading-tight text-foreground">{species}</p>
            <div className="flex shrink-0 items-center gap-2">
              {isWithoutWeather(entry.weatherState, now) && <NoWeatherMarker variant="icon" />}
              <CatchStatusBadge released={entry.released} />
            </div>
          </div>
          <p className="break-words text-[15px] text-foreground/85">{details.join(' · ')}</p>
          {position ? (
            <div className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ink-400 dark:text-sand-400" />
              <div className="flex min-w-0 flex-col">
                <span className="font-mono text-[13px] leading-[1.25] text-foreground">
                  {formatCoordinates(position.latitude, position.longitude)}
                </span>
                <span>
                  {formatAccuracy(position.accuracy)} · {SOURCE_LABELS[entry.positionSource as keyof typeof SOURCE_LABELS]}
                </span>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <MapPinOff aria-hidden className="size-3.5 shrink-0 text-ink-400 dark:text-sand-400" />
              Ohne Position
            </p>
          )}
        </div>
        <ChevronRight aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-400 dark:text-sand-400" />
      </Card>
    </Link>
  )
}
