'use client'

// Standort-Baustein (PROJ-2: AC-6, AC-8, AC-14, AC-20, AC-25, AC-36, AC-37). The forms call
// requestPosition() only when the user taps the save button — this hook never touches the
// geolocation API on mount, in the background or continuously (AC-36). Before the first request on
// a device it shows the explainer (AC-37) unless the browser already reports the permission as
// granted. Every failure (denied, unavailable, no API, 10 s ceiling, explainer dismissed) resolves
// to null: saving never waits on or fails because of the position (AC-8, AC-25).
// The form keeps the returned value for a retry after a lost connection (EC-3) — it must not call
// requestPosition() again for the same entry.
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LocationExplainer } from './location-explainer'

export type Position = {
  latitude: number
  longitude: number
  /** Radius in whole meters. */
  accuracy: number
}

export const LOCATION_EXPLAINED_KEY = 'petrilog.location-explained'
export const LOCATION_TIMEOUT_MS = 10_000
export const LOCATION_MAX_AGE_MS = 30_000

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: LOCATION_TIMEOUT_MS,
  maximumAge: LOCATION_MAX_AGE_MS,
}

// Browser storage may be missing or throw (private mode, blocked site data) — then the explainer
// simply shows again next time.
function wasExplained(): boolean {
  try {
    return window.localStorage.getItem(LOCATION_EXPLAINED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberExplained() {
  try {
    window.localStorage.setItem(LOCATION_EXPLAINED_KEY, '1')
  } catch {
    // ignore — comfort setting only
  }
}

async function permissionGranted(): Promise<boolean> {
  try {
    if (!navigator.permissions?.query) return false
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state === 'granted'
  } catch {
    return false
  }
}

// One position request with our own 10 s ceiling, in case the browser ignores `timeout`
// (it does not count the time the permission prompt is open, for example).
function readPosition(geolocation: Geolocation): Promise<Position | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: Position | null) => {
      if (settled) return
      settled = true
      clearTimeout(ceiling)
      resolve(value)
    }
    const ceiling = setTimeout(() => finish(null), LOCATION_TIMEOUT_MS)
    try {
      geolocation.getCurrentPosition(
        ({ coords }) =>
          finish({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: Math.round(coords.accuracy),
          }),
        () => finish(null),
        GEO_OPTIONS,
      )
    } catch {
      finish(null)
    }
  })
}

export function useLocation(): {
  requestPosition: () => Promise<Position | null>
  locating: boolean
  explainer: ReactNode
} {
  const [locating, setLocating] = useState(false)
  // Resolver of the open explainer; the dialog is open while it is set.
  const [explainerAnswer, setExplainerAnswer] = useState<((proceed: boolean) => void) | null>(null)
  const inFlight = useRef<Promise<Position | null> | null>(null)

  // A form that goes away while the explainer is open must not leave its save hanging. (This also
  // runs after an answer — resolving an already settled promise again is a no-op.)
  useEffect(() => {
    if (!explainerAnswer) return
    return () => explainerAnswer(false)
  }, [explainerAnswer])

  const requestPosition = useCallback((): Promise<Position | null> => {
    // A double tap shares the running request instead of asking twice.
    if (inFlight.current) return inFlight.current

    const run = async (): Promise<Position | null> => {
      const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation
      if (!geolocation) return null

      if (!wasExplained() && !(await permissionGranted())) {
        const proceed = await new Promise<boolean>((resolve) => {
          setExplainerAnswer(() => resolve)
        })
        if (!proceed) return null
        rememberExplained()
      }

      setLocating(true)
      try {
        return await readPosition(geolocation)
      } finally {
        setLocating(false)
      }
    }

    const request = run().finally(() => {
      inFlight.current = null
    })
    inFlight.current = request
    return request
  }, [])

  const answer = (proceed: boolean) => {
    explainerAnswer?.(proceed)
    setExplainerAnswer(null)
  }
  const explainer = createElement(LocationExplainer, {
    open: explainerAnswer !== null,
    onContinue: () => answer(true),
    onDismiss: () => answer(false),
  })

  return { requestPosition, locating, explainer }
}
