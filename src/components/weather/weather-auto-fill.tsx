'use client'

// Automatic fill after the page loaded (PROJ-3: AC-6, AC-9, EC-4; design.md → „Automatisch nach dem Laden").
// The page tells it whether anything of this session is missing (pending, or failed past the 60 s cooldown).
// Then it runs „fehlendes Wetter holen" once per page visit — saving never waited for it (AC-5) — and
// reloads the page data, so the tiles replace „Wetter wird abgerufen …" without a manual reload.
// When the call itself fails (the phone lost its connection), it shows `fallback` instead of `children`:
// the page passes the same section in its failed state there, with the retry button. Nothing is saved
// then; the entry stays pending and is tried again on the next open.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { fillMissingWeather } from '@/lib/weather/actions'

type WeatherAutoFillProps = {
  sessionId: string
  /** The catch whose page this is — fetched first (BUG-3). */
  catchId?: string
  /** Whether the session or one of its catches needs weather now (`needsAutoFill`). */
  needed: boolean
  /** The weather section as the page rendered it. */
  children?: ReactNode
  /** The same section in its failed state — shown when the call itself fails. */
  fallback?: ReactNode
}

export function WeatherAutoFill({ sessionId, catchId, needed, children, fallback }: WeatherAutoFillProps) {
  const router = useRouter()
  const started = useRef(false)
  const [callFailed, setCallFailed] = useState(false)

  useEffect(() => {
    if (!needed || started.current) return
    started.current = true
    fillMissingWeather(catchId ? { sessionId, catchId } : { sessionId })
      .then((result) => {
        if (result.status === 'ok') router.refresh()
        else setCallFailed(true)
      })
      .catch(() => setCallFailed(true))
  }, [needed, sessionId, catchId, router])

  return <>{callFailed && fallback !== undefined ? fallback : children}</>
}
