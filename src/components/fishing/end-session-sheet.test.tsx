// EndSessionSheet (PROJ-2: AC-10, AC-12, EC-6). The Server Action is mocked; `serverNow` fixes the
// sheet's clock, so no fake timers are needed.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const endSession = vi.fn()
vi.mock('@/lib/fishing/actions/sessions', () => ({ endSession: (input: unknown) => endSession(input) }))

import { EndSessionSheet } from './end-session-sheet'

const ID = '6f1c1d5e-4a57-4c8e-9a3b-2f4e5d6c7b8a'
const HOUR = 60 * 60 * 1000
const SERVER_NOW = '2026-09-14T12:00:00.000Z'
const hoursBefore = (h: number) => new Date(Date.parse(SERVER_NOW) - h * HOUR).toISOString()

function renderSheet({ startedHoursAgo, lastCatchAt }: { startedHoursAgo: number; lastCatchAt: string | null }) {
  return render(
    <EndSessionSheet
      session={{ id: ID, startedAt: hoursBefore(startedHoursAgo) }}
      lastCatchAt={lastCatchAt}
      serverNow={SERVER_NOW}
      defaultOpen
    />,
  )
}

const radio = (name: RegExp) => screen.getByRole('radio', { name })
const submitButton = () => screen.getByRole('button', { name: 'Beenden' })
/** Waits until the button is back (label and enabled) — a click right after a previous attempt would
 * otherwise hit the pending state and do nothing on a busy machine. */
const readySubmit = async () => {
  const button = await screen.findByRole('button', { name: 'Beenden' })
  await waitFor(() => expect(button).toBeEnabled())
  return button
}

beforeAll(() => {
  // Radix measures the radio items; jsdom has no ResizeObserver
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

beforeEach(() => {
  endSession.mockReset()
  endSession.mockResolvedValue(undefined) // success redirects
})

afterEach(cleanup)

describe('EndSessionSheet', () => {
  it('preselects „Jetzt" and sends mode now within 48 hours (AC-10)', async () => {
    renderSheet({ startedHoursAgo: 3, lastCatchAt: hoursBefore(1) })

    expect(radio(/^Jetzt/)).toBeEnabled()
    expect(radio(/^Jetzt/)).toHaveAttribute('aria-checked', 'true')
    expect(radio(/^Zeit des letzten Fangs/)).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(await readySubmit())
    await waitFor(() => expect(endSession).toHaveBeenCalledWith({ id: ID, mode: 'now' }))
  })

  it('offers „Zeit des letzten Fangs" only when there are catches', () => {
    renderSheet({ startedHoursAgo: 3, lastCatchAt: null })
    expect(screen.queryByRole('radio', { name: /^Zeit des letzten Fangs/ })).toBeNull()
  })

  it('disables „Jetzt" after 48 hours and preselects the last catch (EC-6)', async () => {
    renderSheet({ startedHoursAgo: 50, lastCatchAt: hoursBefore(30) })

    expect(radio(/^Jetzt/)).toBeDisabled()
    expect(radio(/^Jetzt/)).toHaveAttribute('aria-checked', 'false')
    expect(radio(/^Zeit des letzten Fangs/)).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(await readySubmit())
    await waitFor(() => expect(endSession).toHaveBeenCalledWith({ id: ID, mode: 'last-catch' }))
  })

  it('preselects nothing after 48 hours without catches (EC-6)', () => {
    renderSheet({ startedHoursAgo: 50, lastCatchAt: null })

    expect(radio(/^Jetzt/)).toBeDisabled()
    expect(radio(/^Eigene Uhrzeit/)).toHaveAttribute('aria-checked', 'false')
    expect(submitButton()).toBeDisabled()
  })

  it('converts the custom Berlin date and time into an instant with offset', async () => {
    renderSheet({ startedHoursAgo: 3, lastCatchAt: null })

    fireEvent.click(radio(/^Eigene Uhrzeit/))
    fireEvent.change(await screen.findByLabelText('Datum'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '13:30' } })
    fireEvent.click(await readySubmit())

    await waitFor(() =>
      expect(endSession).toHaveBeenCalledWith({ id: ID, mode: 'custom', endedAt: '2026-09-14T13:30:00+02:00' }),
    )
  })

  it('asks for a time before sending a custom end without one', async () => {
    renderSheet({ startedHoursAgo: 3, lastCatchAt: null })

    fireEvent.click(radio(/^Eigene Uhrzeit/))
    fireEvent.change(await screen.findByLabelText('Uhrzeit'), { target: { value: '' } })
    fireEvent.click(await readySubmit())

    expect(await screen.findByText('Bitte gib Datum und Uhrzeit ein.')).toBeInTheDocument()
    expect(endSession).not.toHaveBeenCalled()
  })

  it('shows the server error for a custom time at the field (AC-12)', async () => {
    endSession.mockResolvedValue({ status: 'error', fieldErrors: { endedAt: 'Das Ende muss nach dem Start liegen.' } })
    renderSheet({ startedHoursAgo: 3, lastCatchAt: null })

    fireEvent.click(radio(/^Eigene Uhrzeit/))
    fireEvent.change(await screen.findByLabelText('Datum'), { target: { value: '2026-09-14' } })
    fireEvent.change(screen.getByLabelText('Uhrzeit'), { target: { value: '08:00' } })
    fireEvent.click(await readySubmit())

    expect(await screen.findByText('Das Ende muss nach dem Start liegen.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull() // at the field, not as a notice
  })

  it('shows a general message and a lost connection as a warning notice', async () => {
    endSession.mockResolvedValueOnce({ status: 'error', message: 'Eine Session dauert höchstens 48 Stunden.' })
    renderSheet({ startedHoursAgo: 3, lastCatchAt: null })

    fireEvent.click(await readySubmit())
    expect(await screen.findByRole('alert')).toHaveTextContent('Eine Session dauert höchstens 48 Stunden.')

    endSession.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(await readySubmit())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Keine Verbindung.'))
  })
})
