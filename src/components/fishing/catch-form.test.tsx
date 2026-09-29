// CatchForm (PROJ-2: AC-20, AC-21, AC-23, AC-24, AC-26, AC-27, EC-2, EC-3, EC-4). The Server Actions and
// the location building block are mocked: these tests check what the form sends, and when it asks for
// a position — never on open, only on save in a running session, once per entry, never when backfilling.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatchDetail } from '@/lib/fishing/queries'
import { CatchForm, type CatchFormProps } from './catch-form'

const actions = vi.hoisted(() => ({
  createCatch: vi.fn(),
  updateCatch: vi.fn(),
  deleteCatch: vi.fn(),
  removeCatchPosition: vi.fn(),
}))
vi.mock('@/lib/fishing/actions/catches', () => actions)

const location = vi.hoisted(() => ({ requestPosition: vi.fn() }))
vi.mock('./use-location', () => ({
  useLocation: () => ({ requestPosition: location.requestPosition, locating: false, explainer: null }),
}))

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const CATCH_ID = '22222222-2222-4222-8222-222222222222'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const running = { id: SESSION_ID, startedAt: '2026-09-12T12:05:00Z', endedAt: null }
const ended = { id: SESSION_ID, startedAt: '2026-09-12T12:05:00Z', endedAt: '2026-09-12T16:40:00Z' }
const GPS = { latitude: 54.08512, longitude: 13.38741, accuracy: 12 }

function renderForm(props: Partial<CatchFormProps> = {}) {
  const all = {
    mode: 'create',
    session: running,
    recentSpecies: [],
    prefill: null,
    initialNow: '2026-09-12T14:30:00+02:00',
    ...props,
  } as CatchFormProps
  return render(<CatchForm {...all} />)
}

function chooseSpecies(id: string) {
  // Radix renders a hidden native <select> inside a form; changing it changes the value.
  const select = document.querySelector('select') as HTMLSelectElement
  fireEvent.change(select, { target: { value: id } })
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function save(name = /speichern/i) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

// jsdom has no ResizeObserver; Radix (radio group, select) measures with it.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset()
  location.requestPosition.mockReset()
})

afterEach(cleanup)

describe('CatchForm — Fang eintragen (running session)', () => {
  it('prefills „jetzt", „Zurückgesetzt" and an empty bait without asking for a position on open', () => {
    renderForm()
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-12')
    expect(screen.getByLabelText('Uhrzeit')).toHaveValue('14:30')
    expect(screen.getByRole('radio', { name: 'Zurückgesetzt' })).toBeChecked()
    expect(screen.getByLabelText(/Köder/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Fang speichern' })).toBeEnabled()
    expect(location.requestPosition).not.toHaveBeenCalled()
  })

  it('takes bait and released/kept from the last catch of the session (AC-23)', () => {
    renderForm({ prefill: { bait: 'Gummifisch', released: false } })
    expect(screen.getByLabelText(/Köder/)).toHaveValue('Gummifisch')
    expect(screen.getByRole('radio', { name: 'Entnommen' })).toBeChecked()
  })

  it('asks for the position only on save and sends it with the id (AC-20, EC-4)', async () => {
    location.requestPosition.mockResolvedValue(GPS)
    actions.createCatch.mockResolvedValue(undefined)
    renderForm()
    chooseSpecies('pike')
    type('Länge', '62')
    expect(location.requestPosition).not.toHaveBeenCalled()

    await save()
    expect(location.requestPosition).toHaveBeenCalledTimes(1)
    expect(actions.createCatch).toHaveBeenCalledTimes(1)
    const input = actions.createCatch.mock.calls[0][0]
    expect(input).toMatchObject({
      sessionId: SESSION_ID,
      caughtAt: '2026-09-12T14:30:00+02:00',
      species: 'pike',
      lengthCm: '62',
      released: true,
      position: GPS,
      sessionWasRunning: true,
    })
    expect(input.id).toMatch(UUID)
  })

  it('retries after a lost connection with the same id and the remembered position (EC-2, EC-3)', async () => {
    location.requestPosition.mockResolvedValue(null)
    actions.createCatch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(undefined)
    renderForm()
    chooseSpecies('perch')
    type('Länge', '31')

    await save()
    expect(await screen.findByText('Keine Verbindung. Bitte versuche es erneut.')).toBeInTheDocument()
    expect(screen.getByLabelText('Länge')).toHaveValue('31')

    await save()
    expect(location.requestPosition).toHaveBeenCalledTimes(1)
    expect(actions.createCatch).toHaveBeenCalledTimes(2)
    const [first, second] = actions.createCatch.mock.calls.map((c) => c[0])
    expect(second.id).toBe(first.id)
    expect(second.position).toBeNull()
    expect(second.caughtAt).toBe(first.caughtAt)
  })

  it('shows the browser check at the fields and sends nothing', async () => {
    renderForm()
    type('Länge', '251')
    await save()
    expect(screen.getByText('Bitte wähle eine Fischart.')).toBeInTheDocument()
    expect(screen.getByText('Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).')).toBeInTheDocument()
    expect(actions.createCatch).not.toHaveBeenCalled()
    expect(location.requestPosition).not.toHaveBeenCalled()
  })

  it('puts the server message at the time field (AC-24, EC-4)', async () => {
    location.requestPosition.mockResolvedValue(null)
    actions.createCatch.mockResolvedValue({
      status: 'error',
      fieldErrors: { caughtAt: 'Die Session wurde inzwischen beendet (Ende 16:40).' },
    })
    renderForm()
    chooseSpecies('zander')
    type('Länge', '48')
    await save()
    expect(await screen.findByText('Die Session wurde inzwischen beendet (Ende 16:40).')).toBeInTheDocument()
    expect(screen.getByLabelText('Uhrzeit')).toHaveValue('14:30')
  })

  it('asks for a species name only with „Sonstige" (AC-21)', async () => {
    renderForm()
    expect(screen.queryByLabelText('Artname')).not.toBeInTheDocument()
    chooseSpecies('other')
    expect(await screen.findByLabelText('Artname')).toBeInTheDocument()
    type('Länge', '20')
    await save()
    expect(screen.getByText('Bitte gib die Fischart ein.')).toBeInTheDocument()
    expect(actions.createCatch).not.toHaveBeenCalled()
  })
})

describe('CatchForm — Fang nachtragen (ended session)', () => {
  it('starts with an empty time and never asks for a position (AC-26)', async () => {
    actions.createCatch.mockResolvedValue(undefined)
    renderForm({ session: ended, initialNow: undefined })
    expect(screen.getByLabelText('Datum')).toHaveValue('')
    expect(screen.getByLabelText('Uhrzeit')).toHaveValue('')

    chooseSpecies('eel')
    type('Länge', '55')
    await save()
    expect(screen.getByText('Bitte gib die Uhrzeit ein.')).toBeInTheDocument()
    expect(actions.createCatch).not.toHaveBeenCalled()

    type('Datum', '2026-09-12')
    type('Uhrzeit', '17:10')
    await save()
    await waitFor(() => expect(actions.createCatch).toHaveBeenCalledTimes(1))
    const input = actions.createCatch.mock.calls[0][0]
    expect(input).toMatchObject({ caughtAt: '2026-09-12T17:10:00+02:00', species: 'eel', lengthCm: '55' })
    expect(input).not.toHaveProperty('position')
    expect(input).not.toHaveProperty('sessionWasRunning')
    expect(location.requestPosition).not.toHaveBeenCalled()
  })
})

describe('CatchForm — Fang bearbeiten', () => {
  const entry: CatchDetail = {
    id: CATCH_ID,
    sessionId: SESSION_ID,
    caughtAt: '2026-09-12T13:20:00Z',
    species: 'other',
    speciesOther: 'Quappe',
    lengthCm: 40,
    weightG: 900,
    bait: 'Tauwurm',
    released: false,
    position: GPS,
    positionSource: 'session',
    createdAt: '2026-09-12T13:20:00Z',
    updatedAt: '2026-09-12T13:20:00Z',
  }

  it('prefills the catch, shows its position and saves without asking for one (AC-27)', async () => {
    actions.updateCatch.mockResolvedValue(undefined)
    renderForm({ mode: 'edit', session: ended, catch: entry, prefill: undefined, initialNow: undefined })
    expect(screen.getByLabelText('Uhrzeit')).toHaveValue('15:20')
    expect(screen.getByLabelText('Artname')).toHaveValue('Quappe')
    expect(screen.getByLabelText(/Gewicht/)).toHaveValue('900')
    expect(screen.getByRole('radio', { name: 'Entnommen' })).toBeChecked()
    expect(screen.getByText(/von der Session/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Position entfernen/ })).toBeInTheDocument()

    type('Länge', '41')
    await save(/^Speichern$/)
    expect(actions.updateCatch).toHaveBeenCalledWith({
      id: CATCH_ID,
      sessionId: SESSION_ID,
      caughtAt: '2026-09-12T15:20:00+02:00',
      species: 'other',
      speciesOther: 'Quappe',
      lengthCm: '41',
      weightG: '900',
      bait: 'Tauwurm',
      released: false,
    })
    expect(actions.createCatch).not.toHaveBeenCalled()
    expect(location.requestPosition).not.toHaveBeenCalled()
  })

  it('shows „Ohne Position" and no remove button without a position', () => {
    renderForm({
      mode: 'edit',
      session: ended,
      catch: { ...entry, position: null, positionSource: 'none' },
      prefill: undefined,
    })
    expect(screen.getByText('Ohne Position')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Position entfernen/ })).not.toBeInTheDocument()
  })
})
