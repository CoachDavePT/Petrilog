import { act, renderHook, waitFor } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { useAuthAction } from '@/components/auth/use-auth-action'
import { useServerAction, type ServerActionResult } from './use-server-action'

type Values = { name: string }

function setup<R extends ServerActionResult>(
  action: (values: Values) => Promise<R | void>,
  options?: Parameters<typeof useServerAction<Values, R>>[2],
) {
  return renderHook(() => {
    const form = useForm<Values>({ defaultValues: { name: 'Hecht' } })
    return { form, ...useServerAction(form, action, options) }
  })
}

describe('useServerAction', () => {
  it('sends the form values and calls onSuccess with the result', async () => {
    const action = vi.fn(async () => ({ status: 'success' as const, message: 'ok' }))
    const onSuccess = vi.fn()
    const { result } = setup(action, { onSuccess })
    await act(() => result.current.submit())
    expect(action).toHaveBeenCalledWith({ name: 'Hecht' })
    expect(onSuccess).toHaveBeenCalledWith({ status: 'success', message: 'ok' }, { name: 'Hecht' })
    expect(result.current.notice).toBeNull()
  })

  it('maps field errors onto known fields, shows the message and never clears the fields', async () => {
    const action = vi.fn(async () => ({
      status: 'error' as const,
      message: 'Bitte prüfe deine Eingaben.',
      fieldErrors: { name: 'Zu lang', unknown: 'x' },
    }))
    const { result } = setup(action)
    await act(() => result.current.submit())
    expect(result.current.form.getFieldState('name').error?.message).toBe('Zu lang')
    expect(result.current.notice).toEqual({ tone: 'warning', text: 'Bitte prüfe deine Eingaben.' })
    expect(result.current.form.getValues()).toEqual({ name: 'Hecht' })
  })

  it('turns a thrown error into the network notice (German default, overridable)', async () => {
    const action = vi.fn(async (): Promise<ServerActionResult> => {
      throw new TypeError('Failed to fetch')
    })
    const { result } = setup(action)
    await act(() => result.current.submit())
    expect(result.current.notice).toEqual({ tone: 'warning', text: 'Keine Verbindung. Bitte versuche es erneut.' })

    const custom = setup(action, { networkMessage: 'Offline' })
    await act(() => custom.result.current.submit())
    expect(custom.result.current.notice).toEqual({ tone: 'warning', text: 'Offline' })
  })

  it('stays pending (button locked) while the action runs', async () => {
    let release!: () => void
    const action = vi.fn(() => new Promise<ServerActionResult>((resolve) => (release = () => resolve({ status: 'success' }))))
    const { result } = setup(action)
    act(() => void result.current.submit())
    await waitFor(() => expect(action).toHaveBeenCalled())
    const lockedWhileRunning = result.current.pending
    await act(async () => release()) // release first, so a failure here never leaks into the next test
    expect(lockedWhileRunning).toBe(true)
    await waitFor(() => expect(result.current.pending).toBe(false))
  })

  it('sends what prepare returns; a failing prepare sends nothing and keeps its own notice', async () => {
    const action = vi.fn(async (_payload: Values & { id: string }): Promise<ServerActionResult> => ({ status: 'success' }))
    const ok = renderHook(() => {
      const form = useForm<Values>({ defaultValues: { name: 'Hecht' } })
      return useServerAction(form, action, { prepare: async (values) => ({ ...values, id: 'abc' }) })
    })
    await act(() => ok.result.current.submit())
    expect(action).toHaveBeenCalledWith({ name: 'Hecht', id: 'abc' })

    action.mockClear()
    const failing = renderHook(() => {
      const form = useForm<Values>({ defaultValues: { name: 'Hecht' } })
      const hook = useServerAction(form, action, {
        prepare: async (): Promise<Values & { id: string }> => {
          hook.setNotice({ tone: 'info', text: 'Ohne Position' })
          throw new Error('cancelled')
        },
      })
      return hook
    })
    await act(() => failing.result.current.submit())
    expect(action).not.toHaveBeenCalled()
    expect(failing.result.current.notice).toEqual({ tone: 'info', text: 'Ohne Position' })
  })
})

describe('useAuthAction (PROJ-1 binding)', () => {
  it('keeps the unconfirmed flag on the notice', async () => {
    const { result } = renderHook(() => {
      const form = useForm<{ email: string }>({ defaultValues: { email: 'a@b.de' } })
      return useAuthAction(form, async () => ({ status: 'error', message: 'Bestätige zuerst', unconfirmed: true }))
    })
    await act(() => result.current.submit())
    expect(result.current.notice).toEqual({ tone: 'warning', text: 'Bestätige zuerst', unconfirmed: true })
  })
})
