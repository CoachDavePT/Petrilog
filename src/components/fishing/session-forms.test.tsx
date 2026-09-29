// Session forms (PROJ-2: AC-6, AC-7, AC-13 – AC-15, AC-17, AC-36, AC-38, EC-2, EC-3). The Server Actions
// and the location hook are mocked: these tests pin what the forms send and when they ask for a position.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  startSession: vi.fn(),
  backfillSession: vi.fn(),
  updateSession: vi.fn(),
  removeSessionPosition: vi.fn(),
}))
vi.mock('@/lib/fishing/actions/sessions', () => actions)

const location = vi.hoisted(() => ({ requestPosition: vi.fn() }))
vi.mock('./use-location', () => ({
  useLocation: () => ({ requestPosition: location.requestPosition, locating: false, explainer: null }),
}))

const router = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

import { SessionBackfillForm } from './session-backfill-form'
import { SessionEditForm, type EditableSession } from './session-edit-form'
import { SessionStartForm } from './session-start-form'
import { matchWaterNames } from './water-name-input'

const HERE = { latitude: 54.08512, longitude: 13.38741, accuracy: 12 }
const NETWORK = 'Keine Verbindung. Bitte versuche es erneut.'
const offline = () => Promise.reject(new TypeError('Failed to fetch'))

const submitButton = (name: RegExp | string) => screen.getByRole('button', { name })
const field = (label: string) => screen.getByLabelText(label)
const type = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } })

// Radix Switch measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset()
  location.requestPosition.mockReset()
  router.refresh.mockReset()
})
afterEach(cleanup)

describe('SessionStartForm', () => {
  it('asks for the position only on submit and keeps id and position for a retry (EC-2, EC-3, AC-36)', async () => {
    location.requestPosition.mockResolvedValue(HERE)
    actions.startSession.mockImplementationOnce(offline).mockResolvedValue(undefined)
    render(<SessionStartForm suggestions={[]} />)
    expect(location.requestPosition).not.toHaveBeenCalled()

    type(field('Gewässername (optional)'), 'Bodden')
    fireEvent.click(submitButton('Starten'))
    await screen.findByText(NETWORK)
    expect(location.requestPosition).toHaveBeenCalledTimes(1)
    expect(field('Gewässername (optional)')).toHaveValue('Bodden')

    fireEvent.click(submitButton('Starten'))
    await waitFor(() => expect(actions.startSession).toHaveBeenCalledTimes(2))
    expect(location.requestPosition).toHaveBeenCalledTimes(1)
    const [first, second] = actions.startSession.mock.calls.map(([input]) => input)
    expect(first).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), waterName: 'Bodden', note: '', position: HERE })
    expect(second).toEqual(first)
  })

  it('remembers „no position" too: a retry after a failed fix does not ask again (EC-3)', async () => {
    location.requestPosition.mockResolvedValue(null)
    actions.startSession.mockImplementationOnce(offline).mockResolvedValue(undefined)
    render(<SessionStartForm suggestions={[]} />)
    fireEvent.click(submitButton('Starten'))
    await screen.findByText(NETWORK)
    fireEvent.click(submitButton('Starten'))
    await waitFor(() => expect(actions.startSession).toHaveBeenCalledTimes(2))
    expect(location.requestPosition).toHaveBeenCalledTimes(1)
    expect(actions.startSession.mock.calls[1][0].position).toBeNull()
  })

  it('checks the length rules in the browser and sends nothing (AC-7)', async () => {
    render(<SessionStartForm suggestions={[]} />)
    type(field('Gewässername (optional)'), 'x'.repeat(81))
    fireEvent.click(submitButton('Starten'))
    expect(await screen.findByText('Höchstens 80 Zeichen.')).toBeInTheDocument()
    expect(location.requestPosition).not.toHaveBeenCalled()
    expect(actions.startSession).not.toHaveBeenCalled()
  })
})

describe('SessionBackfillForm', () => {
  function fillTimes() {
    type(field('Start: Datum'), '2026-09-12')
    type(field('Start: Uhrzeit'), '16:00')
    type(field('Ende: Uhrzeit'), '20:00')
  }

  it('without the switch never asks for a position and sends Berlin times with offset (AC-13, AC-36)', async () => {
    actions.backfillSession.mockResolvedValue(undefined)
    render(<SessionBackfillForm suggestions={[]} />)
    fillTimes()
    // The start date was copied into the empty end date.
    expect(field('Ende: Datum')).toHaveValue('2026-09-12')
    fireEvent.click(submitButton('Session speichern'))
    await waitFor(() => expect(actions.backfillSession).toHaveBeenCalledTimes(1))
    expect(location.requestPosition).not.toHaveBeenCalled()
    expect(actions.backfillSession.mock.calls[0][0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      waterName: '',
      note: '',
      startedAt: '2026-09-12T16:00:00+02:00',
      endedAt: '2026-09-12T20:00:00+02:00',
      useCurrentPosition: false,
      position: null,
    })
  })

  it('with „Ich bin noch am Gewässer" asks once and reuses the position on retry (AC-14, EC-3)', async () => {
    location.requestPosition.mockResolvedValue(HERE)
    actions.backfillSession.mockImplementationOnce(offline).mockResolvedValue(undefined)
    render(<SessionBackfillForm suggestions={[]} />)
    fillTimes()
    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(submitButton('Session speichern'))
    await screen.findByText(NETWORK)
    fireEvent.click(submitButton('Session speichern'))
    await waitFor(() => expect(actions.backfillSession).toHaveBeenCalledTimes(2))
    expect(location.requestPosition).toHaveBeenCalledTimes(1)
    const [first, second] = actions.backfillSession.mock.calls.map(([input]) => input)
    expect(first).toMatchObject({ useCurrentPosition: true, position: HERE })
    expect(second).toEqual(first)
  })

  it('shows the time rules at the fields before sending (AC-15)', async () => {
    render(<SessionBackfillForm suggestions={[]} />)
    type(field('Start: Datum'), '2026-09-12')
    type(field('Start: Uhrzeit'), '16:00')
    type(field('Ende: Uhrzeit'), '15:00')
    fireEvent.click(submitButton('Session speichern'))
    expect(await screen.findByText('Das Ende muss nach dem Start liegen.')).toBeInTheDocument()
    expect(actions.backfillSession).not.toHaveBeenCalled()
  })

  it('requires both times', async () => {
    render(<SessionBackfillForm suggestions={[]} />)
    fireEvent.click(submitButton('Session speichern'))
    expect(await screen.findAllByText('Bitte gib Datum und Uhrzeit ein.')).toHaveLength(2)
    expect(actions.backfillSession).not.toHaveBeenCalled()
  })

  it('puts server field errors at the field and the overlap as the notice, keeping the input (AC-15, AC-16)', async () => {
    actions.backfillSession.mockResolvedValue({
      status: 'error',
      message: 'Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.',
      fieldErrors: { endedAt: 'Dieser Zeitpunkt liegt in der Zukunft.' },
    })
    render(<SessionBackfillForm suggestions={[]} />)
    fillTimes()
    fireEvent.click(submitButton('Session speichern'))
    expect(await screen.findByText('Dieser Zeitpunkt liegt in der Zukunft.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.')
    expect(field('Ende: Uhrzeit')).toHaveValue('20:00')
    expect(field('Ende: Datum')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('SessionEditForm', () => {
  const ended: EditableSession = {
    id: '6f1c3c1e-8d0a-4b8e-9f3e-2a1b0c9d8e7f',
    startedAt: '2026-09-12T14:00:00.000Z',
    endedAt: '2026-09-12T18:00:00.000Z',
    waterName: 'Bodden',
    note: null,
    position: HERE,
  }

  it('prefills the fields in Berlin time and sends start and end, never a position (AC-17)', async () => {
    actions.updateSession.mockResolvedValue(undefined)
    render(<SessionEditForm session={ended} suggestions={[]} />)
    expect(field('Gewässername (optional)')).toHaveValue('Bodden')
    expect(field('Start: Uhrzeit')).toHaveValue('16:00')
    expect(field('Ende: Uhrzeit')).toHaveValue('20:00')
    fireEvent.click(submitButton('Speichern'))
    await waitFor(() => expect(actions.updateSession).toHaveBeenCalledTimes(1))
    expect(actions.updateSession.mock.calls[0][0]).toEqual({
      id: ended.id,
      waterName: 'Bodden',
      note: '',
      startedAt: '2026-09-12T16:00:00+02:00',
      endedAt: '2026-09-12T20:00:00+02:00',
    })
    expect(location.requestPosition).not.toHaveBeenCalled()
  })

  it('has no end field for a running session and sends no end (EC-13)', async () => {
    actions.updateSession.mockResolvedValue(undefined)
    render(<SessionEditForm session={{ ...ended, endedAt: null, position: null }} suggestions={[]} />)
    expect(screen.queryByLabelText('Ende: Datum')).not.toBeInTheDocument()
    expect(screen.getByText('Ohne Position')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Position entfernen' })).not.toBeInTheDocument()
    fireEvent.click(submitButton('Speichern'))
    await waitFor(() => expect(actions.updateSession).toHaveBeenCalledTimes(1))
    expect(actions.updateSession.mock.calls[0][0].endedAt).toBeUndefined()
  })

  it('removes the position after confirmation and shows „Ohne Position" (AC-38)', async () => {
    actions.removeSessionPosition.mockResolvedValue({ status: 'success' })
    render(<SessionEditForm session={ended} suggestions={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Position entfernen' }))
    const dialog = await screen.findByRole('alertdialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Entfernen' }))
    })
    await waitFor(() => expect(screen.getByText('Ohne Position')).toBeInTheDocument())
    expect(actions.removeSessionPosition).toHaveBeenCalledWith({ id: ended.id })
    expect(router.refresh).toHaveBeenCalled()
  })
})

describe('water name suggestions (AC-7)', () => {
  const names = ['Großer Müggelsee', 'Müritz', 'Kummerower See', 'Mühlenteich', 'Mulde', 'Main', 'Möhnesee', 'Müggel']

  it('matches the start of the name or of a word, ignoring case, in the given order, at most 5', () => {
    expect(matchWaterNames(names, 'mü')).toEqual(['Großer Müggelsee', 'Müritz', 'Mühlenteich', 'Müggel'])
    expect(matchWaterNames(names, 'see')).toEqual(['Kummerower See'])
    expect(matchWaterNames(names, 'm')).toHaveLength(5)
    expect(matchWaterNames(names, '  ')).toEqual([])
    expect(matchWaterNames(names, 'Müritz')).toEqual([])
  })

  it('fills the field on tap', () => {
    render(<SessionStartForm suggestions={['Müritz', 'Bodden']} />)
    const input = field('Gewässername (optional)')
    fireEvent.focus(input)
    type(input, 'mü')
    fireEvent.click(screen.getByRole('button', { name: 'Müritz' }))
    expect(input).toHaveValue('Müritz')
    expect(screen.queryByRole('button', { name: 'Bodden' })).not.toBeInTheDocument()
  })
})
