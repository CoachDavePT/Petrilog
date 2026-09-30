// Browser parts of the weather fill (PROJ-3: AC-6, AC-9, AC-10, EC-4). The Server Action and the router are
// mocked: these tests pin when the fill runs, how often, and what the user sees when it fails.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const action = vi.hoisted(() => ({ fillMissingWeather: vi.fn() }))
vi.mock('@/lib/weather/actions', () => action)

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { RetryWeatherButton } from './retry-weather-button'
import { WeatherAutoFill } from './weather-auto-fill'

const SESSION = '3f2b8c1e-4d5a-4b6c-8e7f-1a2b3c4d5e6f'
const UNAVAILABLE = 'Wetter gerade nicht verfügbar. Versuche es später erneut.'

beforeEach(() => {
  action.fillMissingWeather.mockReset()
  router.refresh.mockReset()
})
afterEach(cleanup)

describe('WeatherAutoFill (AC-6, AC-9)', () => {
  it('fills once after the page loaded and reloads the page data', async () => {
    action.fillMissingWeather.mockResolvedValue({ status: 'ok', filled: 2, failed: false })
    render(
      <StrictMode>
        <WeatherAutoFill sessionId={SESSION} needed>
          <p>Wetter wird abgerufen …</p>
        </WeatherAutoFill>
      </StrictMode>,
    )
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1))
    // StrictMode runs effects twice in development — the call still happens once (no request flood)
    expect(action.fillMissingWeather).toHaveBeenCalledTimes(1)
    expect(action.fillMissingWeather).toHaveBeenCalledWith({ sessionId: SESSION })
    expect(screen.getByText('Wetter wird abgerufen …')).toBeInTheDocument()
  })

  it('does nothing when nothing is missing', async () => {
    render(<WeatherAutoFill sessionId={SESSION} needed={false}><p>Kacheln</p></WeatherAutoFill>)
    await act(async () => {})
    expect(action.fillMissingWeather).not.toHaveBeenCalled()
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('shows the failed state when the call itself fails (no connection) and saves nothing', async () => {
    action.fillMissingWeather.mockRejectedValue(new TypeError('Failed to fetch'))
    render(
      <WeatherAutoFill sessionId={SESSION} needed fallback={<p>Wetter konnte nicht abgerufen werden.</p>}>
        <p>Wetter wird abgerufen …</p>
      </WeatherAutoFill>,
    )
    expect(await screen.findByText('Wetter konnte nicht abgerufen werden.')).toBeInTheDocument()
    expect(screen.queryByText('Wetter wird abgerufen …')).not.toBeInTheDocument()
    expect(router.refresh).not.toHaveBeenCalled()
  })

  it('shows the failed state when the action answers with an error', async () => {
    action.fillMissingWeather.mockResolvedValue({ status: 'error' })
    render(
      <WeatherAutoFill sessionId={SESSION} needed fallback={<p>fehlgeschlagen</p>}>
        <p>ausstehend</p>
      </WeatherAutoFill>,
    )
    expect(await screen.findByText('fehlgeschlagen')).toBeInTheDocument()
  })
})

describe('RetryWeatherButton (AC-10)', () => {
  it('retries as a button press, is locked while running and reloads the page data', async () => {
    let resolve!: (value: unknown) => void
    action.fillMissingWeather.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<RetryWeatherButton sessionId={SESSION} />)

    fireEvent.click(screen.getByRole('button', { name: 'Wetter erneut abrufen' }))
    const busy = await screen.findByRole('button', { name: 'Wird abgerufen …' })
    expect(busy).toBeDisabled()
    expect(action.fillMissingWeather).toHaveBeenCalledWith({ sessionId: SESSION, manual: true })

    await act(async () => resolve({ status: 'ok', filled: 1, failed: false }))
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument()
  })

  it('says the weather is not available when the retry failed again', async () => {
    action.fillMissingWeather.mockResolvedValue({ status: 'ok', filled: 0, failed: true })
    render(<RetryWeatherButton sessionId={SESSION} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wetter erneut abrufen' }))
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Wetter erneut abrufen' })).toBeEnabled()
  })

  it('says the same without a connection', async () => {
    action.fillMissingWeather.mockRejectedValue(new TypeError('Failed to fetch'))
    render(<RetryWeatherButton sessionId={SESSION} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wetter erneut abrufen' }))
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument()
  })
})
