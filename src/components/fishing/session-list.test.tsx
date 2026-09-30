// SessionList (PROJ-2: AC-1, EC-12). The Server Action is mocked: these tests pin the first section,
// „Weitere laden" (append, locked while loading, gone at the end) and the failure notice that keeps
// what is already loaded. next/link is a plain anchor.
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionListItem, SessionPage } from '@/lib/fishing/queries'

const actions = vi.hoisted(() => ({ loadMoreSessions: vi.fn() }))
vi.mock('@/lib/fishing/actions/overview', () => actions)

vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: ReactNode; prefetch?: unknown }) =>
    createElement('a', { href, ...rest }, children),
}))

import { SessionList } from './session-list'

const NETWORK = 'Keine Verbindung. Bitte versuche es erneut.'

function item(n: number, overrides: Partial<SessionListItem> = {}): SessionListItem {
  const start = new Date(Date.UTC(2026, 8, 20 - n, 12, 0))
  return {
    id: `s-${n}`,
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    waterName: `Gewässer ${n}`,
    catchCount: n,
    weatherState: { status: 'ok', requestedAt: start.toISOString(), attemptedAt: start.toISOString() },
    ...overrides,
  }
}

const links = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'))
const loadMoreButton = () => screen.queryByRole('button', { name: 'Weitere laden' })

beforeEach(() => actions.loadMoreSessions.mockReset())
afterEach(cleanup)

describe('SessionList', () => {
  it('shows the first section in the given order, each card linking to its session (AC-1)', () => {
    render(<SessionList initialPage={{ items: [item(1), item(2, { endedAt: null, waterName: null })], nextCursor: null }} />)
    expect(links()).toEqual(['/sessions/s-1', '/sessions/s-2'])
    expect(screen.getByText('Gewässer 1')).toBeInTheDocument()
    expect(screen.getByText('Ohne Gewässer')).toBeInTheDocument()
    expect(screen.getByText('Läuft')).toBeInTheDocument()
    expect(loadMoreButton()).not.toBeInTheDocument()
  })

  it('renders nothing for an empty first section', () => {
    const { container } = render(<SessionList initialPage={{ items: [], nextCursor: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('appends the next section with the cursor and hides the button at the end (EC-12)', async () => {
    const first: SessionPage = { items: [item(1)], nextCursor: item(1).startedAt }
    actions.loadMoreSessions.mockResolvedValueOnce({ status: 'ok', page: { items: [item(2)], nextCursor: item(2).startedAt } })
    actions.loadMoreSessions.mockResolvedValueOnce({ status: 'ok', page: { items: [item(3)], nextCursor: null } })
    render(<SessionList initialPage={first} />)

    fireEvent.click(loadMoreButton()!)
    await waitFor(() => expect(links()).toEqual(['/sessions/s-1', '/sessions/s-2']))
    expect(actions.loadMoreSessions).toHaveBeenLastCalledWith(item(1).startedAt)

    await waitFor(() => expect(loadMoreButton()).toBeEnabled())
    fireEvent.click(loadMoreButton()!)
    await waitFor(() => expect(links()).toEqual(['/sessions/s-1', '/sessions/s-2', '/sessions/s-3']))
    expect(actions.loadMoreSessions).toHaveBeenLastCalledWith(item(2).startedAt)
    expect(loadMoreButton()).not.toBeInTheDocument()
  })

  it('locks the button while loading, so a double tap loads once', async () => {
    let resolve!: (value: unknown) => void
    actions.loadMoreSessions.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    render(<SessionList initialPage={{ items: [item(1)], nextCursor: item(1).startedAt }} />)

    fireEvent.click(loadMoreButton()!)
    await waitFor(() => expect(loadMoreButton()).toBeDisabled())
    fireEvent.click(loadMoreButton()!)
    expect(actions.loadMoreSessions).toHaveBeenCalledTimes(1)

    resolve({ status: 'ok', page: { items: [item(2)], nextCursor: null } })
    await waitFor(() => expect(links()).toHaveLength(2))
  })

  it('shows the returned message as a warning and keeps what is loaded; a retry works', async () => {
    actions.loadMoreSessions.mockResolvedValueOnce({ status: 'error', message: NETWORK })
    render(<SessionList initialPage={{ items: [item(1)], nextCursor: item(1).startedAt }} />)

    fireEvent.click(loadMoreButton()!)
    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK)
    expect(links()).toEqual(['/sessions/s-1'])
    await waitFor(() => expect(loadMoreButton()).toBeEnabled())

    actions.loadMoreSessions.mockResolvedValueOnce({ status: 'ok', page: { items: [item(2)], nextCursor: null } })
    fireEvent.click(loadMoreButton()!)
    await waitFor(() => expect(links()).toEqual(['/sessions/s-1', '/sessions/s-2']))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows „Keine Verbindung" when the action call itself fails', async () => {
    actions.loadMoreSessions.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<SessionList initialPage={{ items: [item(1)], nextCursor: item(1).startedAt }} />)

    fireEvent.click(loadMoreButton()!)
    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK)
    expect(links()).toEqual(['/sessions/s-1'])
  })

  it('never shows coordinates', () => {
    render(<SessionList initialPage={{ items: [item(1)], nextCursor: null }} />)
    expect(document.body.textContent).not.toMatch(/\d+,\d{3,}/)
    expect(document.body.textContent).not.toMatch(/±/)
  })
})
