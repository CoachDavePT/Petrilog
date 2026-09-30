// „ohne Wetter" marker on session cards and catch rows (PROJ-3: AC-17; design.md → NoWeatherMarker).
// Deliberately dumb: the page decides when to show it (isWithoutWeather). Server-compatible.
import { CloudOff } from 'lucide-react'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'

export type NoWeatherMarkerProps = {
  /** 'label': icon + text (session card meta line); 'icon': icon only, with screen-reader text (catch row). */
  variant: 'label' | 'icon'
}

export function NoWeatherMarker({ variant }: NoWeatherMarkerProps) {
  if (variant === 'icon') {
    return (
      <span role="img" aria-label={WEATHER_MESSAGES.marker} className="inline-flex shrink-0">
        <CloudOff aria-hidden className="size-3.5 text-ink-400 dark:text-sand-400" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] leading-tight text-muted-foreground">
      <CloudOff aria-hidden className="size-3 shrink-0" />
      {WEATHER_MESSAGES.marker}
    </span>
  )
}
