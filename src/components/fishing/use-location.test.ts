// useLocation (PROJ-2: AC-8, AC-25, AC-36, AC-37). Geolocation, Permissions API and localStorage are
// mocked; fake timers drive the 10 s ceiling.
import { createElement, Fragment, useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCATION_EXPLAINED_KEY, useLocation, type Position } from './use-location'

type Api = ReturnType<typeof useLocation>
let api: Api

function Harness() {
  const location = useLocation()
  useEffect(() => {
    api = location
  })
  return createElement(Fragment, null, location.explainer)
}

const getCurrentPosition = vi.fn()
const watchPosition = vi.fn()
const permissionsQuery = vi.fn()

function setNavigator(key: 'geolocation' | 'permissions', value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true })
}

function succeedWith(latitude: number, longitude: number, accuracy: number) {
  getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({ coords: { latitude, longitude, accuracy } } as GeolocationPosition),
  )
}

function failWith(code: number) {
  getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
    fail({ code, message: 'x' } as GeolocationPositionError),
  )
}

const flush = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0)
})

// Starts a request and lets the hook run up to its first real wait (explainer or GPS).
async function start(): Promise<{ result: () => Position | null | undefined; promise: Promise<Position | null> }> {
  let value: Position | null | undefined
  let promise!: Promise<Position | null>
  await act(async () => {
    promise = api.requestPosition()
    promise.then((v) => {
      value = v
    })
  })
  await flush()
  return { result: () => value, promise }
}

beforeEach(() => {
  vi.useFakeTimers()
  getCurrentPosition.mockReset()
  watchPosition.mockReset()
  permissionsQuery.mockReset().mockResolvedValue({ state: 'prompt' })
  setNavigator('geolocation', { getCurrentPosition, watchPosition, clearWatch: vi.fn() })
  setNavigator('permissions', { query: permissionsQuery })
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useLocation — only on request (AC-36)', () => {
  it('does not touch geolocation or permissions on mount or while idle', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    render(createElement(Harness))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(watchPosition).not.toHaveBeenCalled()
    expect(permissionsQuery).not.toHaveBeenCalled()
    expect(getItem).not.toHaveBeenCalled()

    window.localStorage.setItem(LOCATION_EXPLAINED_KEY, '1')
    succeedWith(54.1, 13.4, 5)
    const { promise } = await start()
    await expect(promise).resolves.toEqual({ latitude: 54.1, longitude: 13.4, accuracy: 5 })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(watchPosition).not.toHaveBeenCalled()
  })
})

describe('useLocation — result (AC-8, AC-25)', () => {
  beforeEach(() => {
    window.localStorage.setItem(LOCATION_EXPLAINED_KEY, '1')
    render(createElement(Harness))
  })

  it('resolves the position with accuracy rounded to whole meters and the agreed options', async () => {
    succeedWith(53.5511, 9.9937, 12.6)
    const { promise } = await start()
    await expect(promise).resolves.toEqual({ latitude: 53.5511, longitude: 9.9937, accuracy: 13 })
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 30_000,
    })
  })

  it('resolves null when permission is denied', async () => {
    failWith(1)
    const { promise } = await start()
    await expect(promise).resolves.toBeNull()
  })

  it('resolves null when the position is unavailable', async () => {
    failWith(2)
    const { promise } = await start()
    await expect(promise).resolves.toBeNull()
  })

  it('resolves null without a geolocation API and without asking anything', async () => {
    setNavigator('geolocation', undefined)
    window.localStorage.removeItem(LOCATION_EXPLAINED_KEY)
    const { promise } = await start()
    await expect(promise).resolves.toBeNull()
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()
  })

  it('gives up after 10 s even if the browser never answers, and ignores a late answer', async () => {
    let lateOk: PositionCallback | undefined
    getCurrentPosition.mockImplementation((ok: PositionCallback) => {
      lateOk = ok
    })
    const { result } = await start()
    expect(api.locating).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999)
    })
    expect(result()).toBeUndefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(result()).toBeNull()
    expect(api.locating).toBe(false)

    lateOk?.({ coords: { latitude: 1, longitude: 2, accuracy: 3 } } as GeolocationPosition)
    await flush()
    expect(result()).toBeNull()
  })

  it('shares one request when called twice (double tap)', async () => {
    getCurrentPosition.mockImplementation(() => {})
    const first = await start()
    const second = await start()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(first.result()).toBeNull()
    expect(second.result()).toBeNull()
  })
})

describe('useLocation — explainer before the first request (AC-37)', () => {
  beforeEach(() => {
    render(createElement(Harness))
  })

  it('shows the explainer once, asks only after "Weiter", then remembers it on this device', async () => {
    succeedWith(54, 13, 8)
    const first = await start()

    expect(screen.getByText(/Nur du kannst sie sehen\./)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/privacy')
    expect(getCurrentPosition).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    await flush()
    await expect(first.promise).resolves.toEqual({ latitude: 54, longitude: 13, accuracy: 8 })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(LOCATION_EXPLAINED_KEY)).toBe('1')
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()

    const second = await start()
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()
    await expect(second.promise).resolves.toEqual({ latitude: 54, longitude: 13, accuracy: 8 })
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
  })

  it('treats closing the explainer without "Weiter" as no position and asks again next time', async () => {
    succeedWith(54, 13, 8)
    const { promise } = await start()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    await flush()
    await expect(promise).resolves.toBeNull()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(LOCATION_EXPLAINED_KEY)).toBeNull()

    await start()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy()
  })

  it('resolves null when the form unmounts while the explainer is open', async () => {
    const { promise } = await start()
    cleanup()
    await flush()
    await expect(promise).resolves.toBeNull()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('skips the explainer when the browser reports the permission as granted', async () => {
    permissionsQuery.mockResolvedValue({ state: 'granted' })
    succeedWith(54, 13, 8)
    const { promise } = await start()
    expect(screen.queryByRole('button', { name: 'Weiter' })).toBeNull()
    await expect(promise).resolves.toEqual({ latitude: 54, longitude: 13, accuracy: 8 })
    expect(permissionsQuery).toHaveBeenCalledWith({ name: 'geolocation' })
  })

  it('still shows the explainer when the Permissions API fails', async () => {
    permissionsQuery.mockRejectedValue(new Error('unsupported'))
    succeedWith(54, 13, 8)
    await start()
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeTruthy()
  })

  it('works when browser storage throws: explainer shows, the position still comes back', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    succeedWith(54, 13, 8)
    const { promise } = await start()
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    await flush()
    await expect(promise).resolves.toEqual({ latitude: 54, longitude: 13, accuracy: 8 })
    expect(setItem).toHaveBeenCalled()
  })
})
