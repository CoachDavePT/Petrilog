'use client'

// „Wetter erneut abrufen" (PROJ-3: AC-10; design.md → „Wetter erneut abrufen"). Rendered by WeatherSection
// only in the failed state. Runs „fehlendes Wetter holen" as a button press (10 s cooldown instead of 60),
// is locked while it runs, then reloads the page data. When nothing could be fetched, a warning says so
// right below the button.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { FormNotice } from '@/components/auth/form-notice'
import { Button } from '@/components/ui/button'
import { fillMissingWeather } from '@/lib/weather/actions'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'

export function RetryWeatherButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [unavailable, setUnavailable] = useState(false)

  const retry = () =>
    startTransition(async () => {
      setUnavailable(false)
      let fetched = false
      try {
        const result = await fillMissingWeather({ sessionId, manual: true })
        fetched = result.status === 'ok' && result.filled > 0 && !result.failed
      } catch {
        // no connection to our own server — same message: the weather is not available right now
      }
      if (!fetched) setUnavailable(true)
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="h-11 self-start" disabled={pending} onClick={retry}>
        <RefreshCw aria-hidden className={pending ? 'motion-safe:animate-spin' : undefined} />
        {pending ? WEATHER_MESSAGES.retrying : WEATHER_MESSAGES.retry}
      </Button>
      {unavailable && !pending && <FormNotice tone="warning">{WEATHER_MESSAGES.retryFailed}</FormNotice>}
    </div>
  )
}
