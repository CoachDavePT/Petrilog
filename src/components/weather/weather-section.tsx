// „Wetter beim Start" / „Wetter beim Fang" (PROJ-3: AC-6, AC-7, AC-8, AC-14 – AC-16; design.md →
// Komponenten-Struktur, WeatherSection). Heading plus exactly one of four states: values, pending,
// failed (with the retry button the page passes in) or without position (never a retry). Rendered on
// the server — no hooks; only the retry button is a browser component.
import type { ReactNode } from 'react'
import { Cloud, CloudOff } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatWeatherHourNote } from '@/lib/weather/format'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'
import type { WeatherSnapshot } from '@/lib/weather/types'
import { WeatherGrid } from './weather-grid'

export type WeatherSectionProps = {
  /** WEATHER_MESSAGES.sessionHeading or .catchHeading. */
  heading: string
  weather: WeatherSnapshot
  /** ISO start or catch time — for the „Werte für 14:00 Uhr" note. */
  referenceTime: string
  /** The retry button; rendered only in the failed state. */
  retry?: ReactNode
  /** The page's own fill-in call failed: show a pending snapshot as failed. */
  pendingFailed?: boolean
}

// surface-sunken with text-body (design-system: text-muted is too weak on Sand 200).
const SUNKEN = 'flex items-start gap-3 rounded-[12px] border-0 bg-sand-200 p-4 text-ink-700 shadow-none dark:bg-[#10160E] dark:text-sand-100'
const ICON = 'mt-0.5 size-5 shrink-0 text-ink-500 dark:text-sand-300'

export function WeatherSection({ heading, weather, referenceTime, retry, pendingFailed = false }: WeatherSectionProps) {
  // Stable, hook-free id from the heading („Wetter beim Start" → weather-wetter-beim-start); one section per heading and page.
  const headingId = `weather-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-[20px] font-medium leading-tight text-foreground">
        {heading}
      </h2>
      <WeatherBody weather={weather} referenceTime={referenceTime} retry={retry} pendingFailed={pendingFailed} />
    </section>
  )
}

function WeatherBody({
  weather,
  referenceTime,
  retry,
  pendingFailed,
}: Omit<WeatherSectionProps, 'heading'> & { pendingFailed: boolean }) {
  if (weather.status === 'ok' && weather.values) {
    return (
      <div className="flex flex-col gap-2">
        <WeatherGrid values={weather.values} />
        {weather.hour ? (
          <p className="text-[12px] leading-tight text-muted-foreground">
            {formatWeatherHourNote(weather.hour, referenceTime)}
          </p>
        ) : null}
      </div>
    )
  }

  if (weather.status === 'pending' && !pendingFailed) {
    return (
      <Card role="status" className={cn(SUNKEN, 'items-center')}>
        <Cloud aria-hidden className={cn(ICON, 'mt-0 motion-safe:animate-pulse')} />
        <p className="text-[15px] leading-snug">{WEATHER_MESSAGES.pending}</p>
      </Card>
    )
  }

  if (weather.status === 'no_position') {
    return <NoWeather reason={WEATHER_MESSAGES.noPositionReason} />
  }

  // failed, pending whose fill-in call failed, or an 'ok' without values (treated as failed)
  return <NoWeather reason={WEATHER_MESSAGES.failedReason} action={retry} />
}

function NoWeather({ reason, action }: { reason: string; action?: ReactNode }) {
  return (
    <Card className={SUNKEN}>
      <CloudOff aria-hidden className={ICON} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[15px] font-semibold leading-tight">{WEATHER_MESSAGES.noWeather}</p>
        <p className="text-[13px] leading-snug">{reason}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </Card>
  )
}
