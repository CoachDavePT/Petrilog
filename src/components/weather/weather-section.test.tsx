// WeatherSection, WeatherGrid and NoWeatherMarker (PROJ-3: AC-7, AC-8, AC-14 – AC-17, EC-6). Pure
// presentational components: every state renders its texts from WEATHER_MESSAGES, the retry node shows
// only in the failed state, never without a position.
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { weatherLabel } from '@/lib/weather/core'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'
import type { WeatherSnapshot, WeatherValues } from '@/lib/weather/types'
import { NoWeatherMarker } from './no-weather-marker'
import { WeatherGrid } from './weather-grid'
import { WeatherSection } from './weather-section'

afterEach(cleanup)

// 12:00 UTC on 12 Sep 2026 = 14:00 in Berlin (CEST); the catch was at 14:20 Berlin.
const HOUR = '2026-09-12T12:00:00Z'
const REFERENCE = '2026-09-12T12:20:00Z'

const VALUES: WeatherValues = {
  temperatureC: 11.4,
  pressureHpa: 1018.3,
  windSpeedKmh: 14,
  windDirectionDeg: 225,
  cloudCoverPct: 40,
  precipitationMm: 0.2,
  weatherCode: 2,
}

function snapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return { status: 'ok', hour: HOUR, values: VALUES, fetchedAt: '2026-09-12T12:21:00Z', ...overrides }
}

const RETRY = <button type="button">{WEATHER_MESSAGES.retry}</button>
const retryButton = () => screen.queryByRole('button', { name: WEATHER_MESSAGES.retry })

function renderSection(weather: WeatherSnapshot, extra: { retry?: React.ReactNode; pendingFailed?: boolean } = {}) {
  return render(
    <WeatherSection heading={WEATHER_MESSAGES.catchHeading} weather={weather} referenceTime={REFERENCE} {...extra} />,
  )
}

describe('WeatherSection', () => {
  it('renders the heading as h2 and labels the section with it', () => {
    renderSection(snapshot())
    const heading = screen.getByRole('heading', { level: 2, name: 'Wetter beim Fang' })
    expect(screen.getByRole('region', { name: 'Wetter beim Fang' })).toContainElement(heading)
  })

  it('ok: six tiles with values and the hour note (AC-14, AC-15)', () => {
    renderSection(snapshot(), { retry: RETRY })
    const terms = screen.getAllByRole('term').map((dt) => dt.textContent)
    expect(terms).toEqual(['Luft', 'Luftdruck', 'Wind', 'Bewölkung', 'Niederschlag', 'Wetter'])
    expect(screen.getByText('11,4')).toBeInTheDocument()
    expect(screen.getByText('1018')).toBeInTheDocument()
    expect(screen.getByText('km/h SW')).toBeInTheDocument()
    expect(screen.getByText('Werte für 14:00 Uhr · Open-Meteo')).toBeInTheDocument()
    expect(retryButton()).not.toBeInTheDocument()
    expect(screen.queryByText(WEATHER_MESSAGES.noWeather)).not.toBeInTheDocument()
  })

  it('ok: each reading carries the full text for screen readers', () => {
    renderSection(snapshot())
    const readings = screen.getAllByRole('definition')
    expect(readings).toHaveLength(6)
    expect(within(readings[0]).getByText('11,4 °C')).toHaveClass('sr-only')
    expect(within(readings[2]).getByText('14 km/h SW')).toHaveClass('sr-only')
  })

  it('ok: a missing value shows „–" without a unit (EC-6)', () => {
    renderSection(snapshot({ values: { ...VALUES, temperatureC: null, weatherCode: null } }))
    const readings = screen.getAllByRole('definition')
    expect(readings[0].textContent).toBe('––')
    expect(within(readings[0]).queryByText('°C')).not.toBeInTheDocument()
    expect(readings[5].textContent).toBe('––')
    expect(within(readings[1]).getByText('1018')).toBeInTheDocument()
  })

  it('pending: status text with role=status, no retry (AC-7)', () => {
    renderSection(snapshot({ status: 'pending', hour: null, values: null, fetchedAt: null }), { retry: RETRY })
    expect(screen.getByRole('status')).toHaveTextContent(WEATHER_MESSAGES.pending)
    expect(retryButton()).not.toBeInTheDocument()
    expect(screen.queryByRole('term')).not.toBeInTheDocument()
  })

  it('failed: „Ohne Wetterdaten", the reason and the retry node (AC-8, AC-16)', () => {
    renderSection(snapshot({ status: 'failed', hour: null, values: null, fetchedAt: null }), { retry: RETRY })
    expect(screen.getByText(WEATHER_MESSAGES.noWeather)).toBeInTheDocument()
    expect(screen.getByText(WEATHER_MESSAGES.failedReason)).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('failed without a retry node renders no button', () => {
    renderSection(snapshot({ status: 'failed', hour: null, values: null, fetchedAt: null }))
    expect(screen.getByText(WEATHER_MESSAGES.failedReason)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pendingFailed turns a pending snapshot into the failed state with retry', () => {
    renderSection(snapshot({ status: 'pending', hour: null, values: null, fetchedAt: null }), {
      retry: RETRY,
      pendingFailed: true,
    })
    expect(screen.queryByText(WEATHER_MESSAGES.pending)).not.toBeInTheDocument()
    expect(screen.getByText(WEATHER_MESSAGES.noWeather)).toBeInTheDocument()
    expect(screen.getByText(WEATHER_MESSAGES.failedReason)).toBeInTheDocument()
    expect(retryButton()).toBeInTheDocument()
  })

  it('no_position: the no-position reason and never the retry node (AC-16)', () => {
    renderSection(snapshot({ status: 'no_position', hour: null, values: null, fetchedAt: null }), { retry: RETRY })
    expect(screen.getByText(WEATHER_MESSAGES.noWeather)).toBeInTheDocument()
    expect(screen.getByText(WEATHER_MESSAGES.noPositionReason)).toBeInTheDocument()
    expect(screen.queryByText(WEATHER_MESSAGES.failedReason)).not.toBeInTheDocument()
    expect(retryButton()).not.toBeInTheDocument()
  })

  it('no_position stays no_position even with pendingFailed', () => {
    renderSection(snapshot({ status: 'no_position', hour: null, values: null, fetchedAt: null }), {
      retry: RETRY,
      pendingFailed: true,
    })
    expect(screen.getByText(WEATHER_MESSAGES.noPositionReason)).toBeInTheDocument()
    expect(retryButton()).not.toBeInTheDocument()
  })
})

describe('WeatherGrid', () => {
  it('lets a long condition text wrap instead of overflowing (375 px)', () => {
    render(<WeatherGrid values={{ ...VALUES, weatherCode: 56 }} />)
    const label = weatherLabel(56)!
    const visible = screen.getByText(label, { ignore: '.sr-only' })
    expect(visible.closest('[aria-hidden]')).toHaveClass('flex-wrap', 'break-words')
    expect(visible.closest('dd')!.parentElement).toHaveClass('min-w-0')
  })
})

describe('NoWeatherMarker', () => {
  it('label: icon plus the text „ohne Wetter" (AC-17)', () => {
    render(<NoWeatherMarker variant="label" />)
    expect(screen.getByText(WEATHER_MESSAGES.marker)).toBeInTheDocument()
  })

  it('icon: only an icon, with the accessible name „ohne Wetter" (AC-17)', () => {
    render(<NoWeatherMarker variant="icon" />)
    expect(screen.getByRole('img', { name: 'ohne Wetter' })).toBeInTheDocument()
    expect(screen.queryByText(WEATHER_MESSAGES.marker)).not.toBeInTheDocument()
  })
})
