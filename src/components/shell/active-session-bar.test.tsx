// ActiveSessionBar (PROJ-2: AC-4, AC-11). Fake timers drive the client clock; next/link is a plain anchor.
import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MESSAGES } from '@/lib/fishing/messages'
import type { RunningSession } from '@/lib/fishing/queries'
import { ActiveSessionBar } from './active-session-bar'

vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: unknown }) =>
    createElement('a', { href, ...rest }, children),
}))

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const START = '2026-09-12T12:00:00.000Z'
const START_MS = Date.parse(START)

function session(overrides: Partial<RunningSession> = {}): RunningSession {
  return { id: 's-1', waterName: 'Peenestrom', startedAt: START, catchCount: 3, ...overrides }
}

/** The running time as shown: „1:42 h" with the narrow no-break space. */
const duration = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')} h`

/** The element showing exactly this time — the default matcher would fold the narrow space into a blank. */
const timeText = (text: string) => screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === text)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ActiveSessionBar', () => {
  it('shows water name, running time and catch count, and links to detail and new catch (AC-4)', () => {
    vi.setSystemTime(START_MS + 1 * HOUR + 42 * MINUTE + 5_000)
    render(createElement(ActiveSessionBar, { session: session() }))

    expect(screen.getByText('Peenestrom')).toBeInTheDocument()
    expect(timeText(duration(1, 42))).toBeInTheDocument()
    expect(screen.getByText(/3 Fänge/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Peenestrom/ })).toHaveAttribute('href', '/sessions/s-1')
    expect(screen.getByRole('link', { name: 'Fang eintragen' })).toHaveAttribute('href', '/sessions/s-1/catches/new')
    expect(screen.queryByText(MESSAGES.runningLong)).not.toBeInTheDocument()
  })

  it('says „Ohne Gewässer" without a water name and „1 Fang" in the singular', () => {
    vi.setSystemTime(START_MS + 5 * MINUTE)
    render(createElement(ActiveSessionBar, { session: session({ waterName: null, catchCount: 1 }) }))

    expect(screen.getByText('Ohne Gewässer')).toBeInTheDocument()
    expect(screen.getByText(/· 1 Fang$/)).toBeInTheDocument()
  })

  it('ticks once a minute, at the full minute', () => {
    vi.setSystemTime(START_MS + 10 * MINUTE + 30_000)
    render(createElement(ActiveSessionBar, { session: session() }))
    expect(timeText(duration(0, 10))).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(29_000))
    expect(timeText(duration(0, 10))).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(1_000))
    expect(timeText(duration(0, 11))).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(MINUTE))
    expect(timeText(duration(0, 12))).toBeInTheDocument()
  })

  it('shows the 12-h hint with „Beenden" → ?end=1 from exactly 12 hours on (AC-11)', () => {
    vi.setSystemTime(START_MS + 12 * HOUR - MINUTE)
    render(createElement(ActiveSessionBar, { session: session() }))
    expect(screen.queryByText(MESSAGES.runningLong)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Session beenden' })).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(MINUTE))
    expect(screen.getByText(MESSAGES.runningLong)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Session beenden' })).toHaveAttribute('href', '/sessions/s-1?end=1')
    expect(timeText(duration(12, 0))).toBeInTheDocument()
  })

  it('renders the time on the server only when it gets the server time', () => {
    vi.setSystemTime(START_MS + 13 * HOUR)
    const withNow = renderToString(
      createElement(ActiveSessionBar, { session: session(), serverNow: new Date(START_MS + 13 * HOUR).toISOString() }),
    )
    expect(withNow).toContain(duration(13, 0))
    expect(withNow).toContain(MESSAGES.runningLong)

    const withoutNow = renderToString(createElement(ActiveSessionBar, { session: session() }))
    expect(withoutNow).not.toContain(duration(13, 0))
    expect(withoutNow).not.toContain(MESSAGES.runningLong)
  })
})
